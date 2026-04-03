/**
 * ============================================================
 * 文件：MaterialDrawer.js
 * 作用：材质库侧边抽屉
 * ============================================================
 *
 * 这个文件控制右侧滑入的"材质库"面板，包括：
 *   1. 材质贴纸面板：显示所有可用材质的圆形贴纸，支持拖拽到画布
 *   2. 模板列表：显示预设模板，点击后一键加载到画布
 *   3. 抽屉的开关动画（滑入/滑出效果）
 *
 * 拖拽实现原理（材质库 → 画布）：
 *   用户按住材质库里的小圆贴纸后，创建一个"幽灵元素"（drag ghost）
 *   跟随手指/鼠标移动。松开时，如果落点在画布范围内，
 *   就在那个位置创建一个真实的材质贴纸。幽灵元素随即删除。
 *
 * 为什么用"幽灵元素"而不是直接拖动原贴纸？
 *   因为原贴纸在抽屉里（CSS overflow hidden），拖出边界会被裁剪看不见。
 *   幽灵元素直接附加在 document.body 上，不受任何裁剪限制。
 * ============================================================
 */

import { MATERIALS } from '../data/materials.js';
import { TEMPLATES } from '../data/templates.js';

export class MaterialDrawer {
  /**
   * 构造函数
   *
   * @param {Canvas} canvas  画布实例，用于添加贴纸和加载模板
   */
  constructor(canvas) {
    this._canvas  = canvas; // 画布实例

    // 获取 DOM 元素
    this._drawer  = document.getElementById('material-drawer');  // 抽屉面板
    this._overlay = document.getElementById('drawer-overlay');   // 半透明遮罩（点击关闭抽屉）
    this._toggle  = document.getElementById('drawer-toggle');    // 三角形开关按钮
    this._close   = document.getElementById('drawer-close');     // 抽屉内的 ✕ 关闭按钮
    this._palette = document.getElementById('material-palette'); // 材质贴纸网格容器
    this._tplList = document.getElementById('template-list');    // 模板列表容器

    // 拖拽时跟随手指/鼠标的幽灵元素（null = 当前没有拖拽进行中）
    this._ghost = null;

    // 构建 UI 内容
    this._buildPalette();   // 生成材质贴纸网格
    this._buildTemplates(); // 生成模板列表
    this._bindUI();         // 绑定开关事件
  }

  // ─── 抽屉开关 ─────────────────────────────────────────────────────────────

  /**
   * 绑定抽屉开关相关的事件
   */
  _bindUI() {
    // 点击三角按钮 → 打开抽屉
    this._toggle.addEventListener('click', () => this.open());
    // 点击抽屉内的 ✕ → 关闭抽屉
    this._close.addEventListener('click',  () => this.close());
    // 点击遮罩层 → 关闭抽屉（遮罩在抽屉背后，点击空白区域时触发）
    this._overlay.addEventListener('click', () => this.close());
  }

  /**
   * 打开抽屉
   * CSS 的 .open 类会让抽屉从右侧滑入（transform: translateX(0)）
   */
  open() {
    this._drawer.classList.add('open');
    this._drawer.setAttribute('aria-hidden', 'false'); // 无障碍访问：告知屏幕阅读器面板已显示
    this._overlay.classList.add('visible');            // 显示半透明遮罩
    this._toggle.classList.add('open');                // 三角按钮旋转 180° 变成向左箭头
  }

  /**
   * 关闭抽屉
   */
  close() {
    this._drawer.classList.remove('open');
    this._drawer.setAttribute('aria-hidden', 'true');
    this._overlay.classList.remove('visible');
    this._toggle.classList.remove('open');
  }

  // ─── 材质贴纸面板 ─────────────────────────────────────────────────────────

  /**
   * 构建材质贴纸网格
   * 读取 materials.js 里的 MATERIALS 数组，
   * 为每个材质创建一个可拖拽的小圆贴纸元素。
   */
  _buildPalette() {
    MATERIALS.forEach((mat) => {
      // 创建材质项容器
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.setAttribute('draggable', 'true'); // 标记为可拖拽（辅助属性）
      item.dataset.materialId = mat.id;       // 记录材质 ID

      // 内部结构：圆形 + 名称
      item.innerHTML = `
        <div class="palette-circle ${mat.cssClass}">
          <span>${mat.icon}</span>
        </div>
        <span class="palette-name">${mat.label}</span>
      `;

      // 绑定拖拽逻辑
      this._bindPaletteItemDrag(item, mat);

      // 加入材质网格容器
      this._palette.appendChild(item);
    });
  }

  /**
   * 为材质项绑定拖拽事件（同时支持触摸和鼠标）
   *
   * @param {HTMLElement} item  材质项 DOM 元素
   * @param {Object}      mat   材质数据对象（来自 materials.js）
   */
  _bindPaletteItemDrag(item, mat) {

    // ── 触摸拖拽（手机 / iPad）──────────────────────────────────────────────

    // 手指按下：创建幽灵元素
    item.addEventListener('touchstart', (e) => {
      e.preventDefault(); // 防止触摸时触发 click 或页面滚动
      const touch = e.touches[0];
      this._startGhost(mat, touch.clientX, touch.clientY);
    }, { passive: false });

    // 手指移动：幽灵跟随手指
    item.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this._moveGhost(touch.clientX, touch.clientY);
    }, { passive: false });

    // 手指抬起：在落点创建真实贴纸（如果在画布内）
    item.addEventListener('touchend', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0]; // changedTouches：刚刚抬起的手指列表
      this._dropGhost(mat, touch.clientX, touch.clientY);
    }, { passive: false });

    // ── 鼠标拖拽（Windows Chrome / 桌面浏览器）──────────────────────────────

    // 鼠标按下：创建幽灵元素
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this._startGhost(mat, e.clientX, e.clientY);

      // 把 move 和 up 事件绑定到 document，确保鼠标移出元素时不会中断
      const onMove = (ev) => this._moveGhost(ev.clientX, ev.clientY);
      const onUp   = (ev) => {
        // 移除全局监听器
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        // 在落点创建贴纸
        this._dropGhost(mat, ev.clientX, ev.clientY);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  /**
   * 创建拖拽幽灵元素
   * 幽灵是一个跟随手指/鼠标的圆形视觉元素，直接附加在 body 上。
   * 同时关闭抽屉，让画布露出来，用户可以把幽灵拖到画布上。
   *
   * @param {Object} mat  材质数据
   * @param {number} x    初始横坐标（手指/鼠标位置）
   * @param {number} y    初始纵坐标
   */
  _startGhost(mat, x, y) {
    const ghost = document.createElement('div');

    // drag-ghost 类在 main.css 里定义：固定定位、圆形、半透明、较大尺寸
    ghost.className = `drag-ghost ${mat.cssClass}`;
    ghost.textContent = mat.icon; // 显示材质图标

    // 幽灵以自身中心对准手指（幽灵宽高 80px，所以减去 40）
    ghost.style.left = `${x - 40}px`;
    ghost.style.top  = `${y - 40}px`;

    // 附加到 body 最顶层，避免被任何容器裁剪
    document.body.appendChild(ghost);
    this._ghost = ghost;

    // 关闭抽屉，让用户看到画布
    this.close();
  }

  /**
   * 移动幽灵元素（跟随手指/鼠标）
   *
   * @param {number} x  当前手指/鼠标横坐标
   * @param {number} y  当前手指/鼠标纵坐标
   */
  _moveGhost(x, y) {
    if (!this._ghost) return;
    this._ghost.style.left = `${x - 40}px`;
    this._ghost.style.top  = `${y - 40}px`;
  }

  /**
   * 拖拽结束：删除幽灵，在落点创建真实贴纸
   *
   * @param {Object} mat  材质数据
   * @param {number} x    落点横坐标（屏幕坐标）
   * @param {number} y    落点纵坐标
   */
  _dropGhost(mat, x, y) {
    // 删除幽灵元素
    if (this._ghost) {
      this._ghost.remove();
      this._ghost = null;
    }

    // 获取画布的屏幕位置
    const canvasEl = document.getElementById('canvas');
    const rect = canvasEl.getBoundingClientRect();

    // 把屏幕坐标转换为相对于画布的坐标
    // 例如：屏幕 x=300，画布左边距=50 → 画布内 x=250
    const cx = x - rect.left;
    const cy = y - rect.top;

    // 只有落点在画布范围内才创建贴纸
    // （用户可能把幽灵拖到画布外面，这时候不创建）
    const insideCanvas = cx >= 0 && cy >= 0 && cx <= rect.width && cy <= rect.height;
    if (insideCanvas) {
      this._canvas.addSticker(mat.id, cx, cy);
    }
  }

  // ─── 模板列表 ─────────────────────────────────────────────────────────────

  /**
   * 构建模板列表
   * 读取 templates.js 里的 TEMPLATES 数组，
   * 为每个模板创建一个卡片，点击后加载模板到画布。
   */
  _buildTemplates() {
    TEMPLATES.forEach((tpl) => {
      const card = document.createElement('div');
      card.className = 'template-card';

      // 卡片内部结构：
      //   左边：小圆点预览（显示模板包含哪些材质颜色）
      //   右边：模板名称 + 描述
      card.innerHTML = `
        <div class="template-preview">
          ${tpl.stickers.slice(0, 4).map((s) => `
            <div class="template-dot mat-${s.materialId}"></div>
          `).join('')}
        </div>
        <div class="template-info">
          <div class="template-name">${tpl.name}</div>
          <div class="template-desc">${tpl.description}</div>
        </div>
      `;

      // 点击模板卡片 → 加载模板 → 关闭抽屉
      card.addEventListener('click', () => {
        this._canvas.loadTemplate(tpl.id); // 通知 Canvas 加载模板
        this.close();                       // 关闭抽屉
      });

      this._tplList.appendChild(card);
    });
  }
}
