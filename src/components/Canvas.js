/**
 * ============================================================
 * 文件：Canvas.js
 * 作用：画布控制器（核心调度中心）
 * ============================================================
 *
 * 这个文件是整个应用的"大脑"，负责把所有模块串联起来：
 *
 *   MaterialSticker  ──→  Canvas  ←──  TouchDetector
 *                            │
 *                            ↓
 *                     BluetoothManager（发送数据给 MCU）
 *
 * 具体职责：
 *   1. 管理画布上的所有材质贴纸（增加、删除、清空）
 *   2. 接收 TouchDetector 的触摸/鼠标事件回调
 *   3. 把触摸结果（材质 + 面积）发送给蓝牙
 *   4. 控制触点指示圆圈的显示和位置
 *   5. 加载模板（一键布局多个贴纸）
 *   6. 控制"空白提示文字"的显示/隐藏
 * ============================================================
 */

import { MaterialSticker } from './MaterialSticker.js';
import { TouchDetector }   from '../touch/TouchDetector.js';
import { TEMPLATES }       from '../data/templates.js';

export class Canvas {
  /**
   * 构造函数 —— 初始化画布
   *
   * @param {HTMLElement}      el         画布 DOM 元素（#canvas）
   * @param {BluetoothManager} bluetooth  蓝牙管理器实例
   */
  constructor(el, bluetooth) {
    this._el  = el;           // 画布 DOM 元素
    this._ble = bluetooth;    // 蓝牙管理器

    // 当前画布上所有贴纸的数组（MaterialSticker 实例列表）
    this._stickers = [];

    // 上次发送的材质 ID（备用，目前用于调试）
    this._lastMat = null;

    // 触点指示圆圈：手指/鼠标按下时显示的视觉反馈元素
    this._indicator = document.getElementById('touch-indicator');
    // 指示圆圈里显示材质名称的文字元素
    this._indLabel  = document.getElementById('touch-material-label');

    // 空白提示（画布没有贴纸时显示的引导文字）
    this._hint = document.getElementById('empty-hint');

    // 创建触控检测器
    // 传入两个回调函数：有触碰时 → _onTouch，松开时 → _onRelease
    this._detector = new TouchDetector(
      el,
      this._onTouch.bind(this),   // bind(this) 确保回调里的 this 指向 Canvas 实例
      this._onRelease.bind(this),
    );

    // 监听贴纸的"自我删除"事件
    // 当用户点击贴纸上的 ✕ 按钮时，贴纸会触发 'sticker:remove' 事件
    // Canvas 捕获这个事件，从 _stickers 数组中移除对应贴纸
    el.addEventListener('sticker:remove', (e) => {
      this._removeSticker(e.detail.sticker);
    });
  }

  // ─── 贴纸管理 ─────────────────────────────────────────────────────────────

  /**
   * 在画布上添加一个材质贴纸
   *
   * @param {string} materialId  材质 ID，例如 "glass"
   * @param {number} xPx         贴纸中心横坐标（相对于画布，单位 px）
   * @param {number} yPx         贴纸中心纵坐标（相对于画布，单位 px）
   * @returns {MaterialSticker}  新创建的贴纸实例
   */
  addSticker(materialId, xPx, yPx) {
    // 创建贴纸实例（同时创建 DOM 元素）
    const sticker = new MaterialSticker(materialId, xPx, yPx);

    // 把贴纸的 DOM 元素插入画布
    this._el.appendChild(sticker.el);

    // 把贴纸加入管理数组
    this._stickers.push(sticker);

    // 通知 TouchDetector 更新贴纸列表（命中检测需要知道所有贴纸位置）
    this._detector.updateStickers(this._stickers);

    // 更新空白提示的显示状态
    this._updateHint();

    return sticker;
  }

  /**
   * 从画布上移除指定贴纸（内部方法）
   * 由 'sticker:remove' 事件触发，不直接调用。
   *
   * @param {MaterialSticker} sticker  要移除的贴纸实例
   */
  _removeSticker(sticker) {
    // filter：过滤掉被删除的那个贴纸，保留其他所有贴纸
    this._stickers = this._stickers.filter((s) => s !== sticker);

    // 同步更新 TouchDetector 的贴纸列表
    this._detector.updateStickers(this._stickers);

    // 更新空白提示
    this._updateHint();
  }

  /**
   * 清空画布上的所有贴纸
   * 加载新模板前会先调用这个方法。
   */
  clearStickers() {
    // 展开数组再遍历（避免在遍历过程中数组被修改）
    [...this._stickers].forEach((s) => {
      s.el.remove(); // 从 DOM 删除
    });
    this._stickers = []; // 清空数组
    this._detector.updateStickers([]); // 通知 TouchDetector
    this._updateHint(); // 显示空白提示
  }

  /**
   * 加载一个预设模板
   * 先清空画布，再按模板定义的百分比位置摆放贴纸。
   *
   * 百分比 → 像素的转换：
   *   画布的实际像素宽度 = W
   *   贴纸的实际 X = xPct × W
   *
   * @param {string} templateId  模板 ID，对应 templates.js 里的 id 字段
   */
  loadTemplate(templateId) {
    // 找到对应的模板数据
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return; // 没找到就直接返回

    // 先清空画布
    this.clearStickers();

    // 获取画布的实际像素尺寸
    const { width: W, height: H } = this._el.getBoundingClientRect();

    // 按模板定义，依次添加每个贴纸
    tpl.stickers.forEach(({ materialId, xPct, yPct }) => {
      // 百分比 × 实际尺寸 = 实际像素坐标
      this.addSticker(materialId, xPct * W, yPct * H);
    });
  }

  // ─── 触摸/鼠标事件处理 ────────────────────────────────────────────────────

  /**
   * 有触碰时的回调（由 TouchDetector 调用）
   *
   * @param {string} materialId  触碰到的材质 ID，空白区域为 "none"
   * @param {number} area        接触面积（px²）
   * @param {number} x           触点屏幕横坐标
   * @param {number} y           触点屏幕纵坐标
   * @param {number} touchW      触点宽度（用于画指示圆）
   * @param {number} touchH      触点高度
   */
  _onTouch(materialId, area, x, y, touchW, touchH) {
    // 高亮被触碰的贴纸，取消其他贴纸的高亮
    this._stickers.forEach((s) => {
      // 只有当前材质匹配 且 不是空白区域时才高亮
      s.setActiveTouchStyle(s.materialId === materialId && materialId !== 'none');
    });

    // 显示触点指示圆圈
    this._showIndicator(materialId, x, y, touchW, touchH);

    // 通过蓝牙发送数据给 MCU
    this._ble.send(materialId, area);

    // 记录最后一次触碰的材质（调试用）
    this._lastMat = materialId;
  }

  /**
   * 触摸/鼠标松开时的回调（由 TouchDetector 调用）
   * 清除所有高亮，隐藏指示圆圈，并发送"无触碰"信号给 MCU。
   */
  _onRelease() {
    // 取消所有贴纸的高亮
    this._stickers.forEach((s) => s.setActiveTouchStyle(false));

    // 隐藏触点指示圆圈
    this._hideIndicator();

    // 发送"松开"信号给 MCU：material = "none"，area = 0
    this._ble.send('none', 0);

    this._lastMat = null;
  }

  // ─── 触点指示圆圈 ──────────────────────────────────────────────────────────

  /**
   * 显示触点指示圆圈
   * 在触点位置显示一个圆圈（大小根据接触面积动态变化），
   * 并在圆圈下方显示当前触碰的材质名称。
   *
   * @param {string} materialId  触碰的材质 ID
   * @param {number} x          触点横坐标
   * @param {number} y          触点纵坐标
   * @param {number} touchW     触点宽度（用于设置圆圈大小）
   * @param {number} touchH     触点高度
   */
  _showIndicator(materialId, x, y, touchW, touchH) {
    const ind  = this._indicator;
    const ring = ind.querySelector('.touch-ring');

    // 圆圈大小 = 触点宽高的最大值 × 3 倍放大，最小 30px
    // 放大 3 倍的原因：radiusX 原始值只有几像素，不放大时手指轻按和用力按的圆圈
    // 大小差异几乎看不出来，放大后变化才明显
    const size = Math.max((touchW || 20) * 3, (touchH || 20) * 3, 30);
    ring.style.width  = `${size}px`;
    ring.style.height = `${size}px`;

    // 把圆圈定位到触点坐标
    // #touch-indicator 的 CSS 设置了 transform: translate(-50%, -50%)
    // 所以设置 left/top 为触点坐标时，圆圈会以自身中心对准触点
    ind.style.left = `${x}px`;
    ind.style.top  = `${y}px`;

    // 更新材质名称标签
    this._indLabel.textContent = materialId === 'none'
      ? '无材质'              // 触碰空白区域
      : this._matLabel(materialId); // 触碰材质贴纸

    // 添加 visible 类来显示（CSS 里通过 opacity: 1 实现淡入）
    ind.classList.add('visible');
  }

  /**
   * 隐藏触点指示圆圈
   */
  _hideIndicator() {
    this._indicator.classList.remove('visible');
  }

  /**
   * 根据材质 ID 获取中文名称（用于指示圆圈的文字标签）
   *
   * @param {string} id  材质 ID
   * @returns {string}   中文名称
   */
  _matLabel(id) {
    const labels = {
      glass:  '玻璃',
      wood:   '木头',
      metal:  '金属',
      rubber: '橡胶',
      fabric: '布料',
      stone:  '石头',
    };
    // ?? id：如果 labels 里没找到，就直接显示 id 本身（兜底处理）
    return labels[id] ?? id;
  }

  // ─── 空白提示 ──────────────────────────────────────────────────────────────

  /**
   * 根据画布上是否有贴纸，控制空白提示的显示/隐藏
   * 有贴纸时隐藏提示，没有贴纸时显示提示。
   */
  _updateHint() {
    // classList.toggle(name, force)：
    //   _stickers.length > 0（有贴纸）→ force = true → 添加 hidden 类 → 隐藏提示
    //   _stickers.length === 0（无贴纸）→ force = false → 移除 hidden 类 → 显示提示
    this._hint?.classList.toggle('hidden', this._stickers.length > 0);
  }
}
