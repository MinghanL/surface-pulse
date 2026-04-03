/**
 * ============================================================
 * 文件：MaterialSticker.js
 * 作用：单个材质贴纸
 * ============================================================
 *
 * 这个文件定义了画布上的"圆形材质贴纸"。
 * 每个贴纸都是一个可以拖动的圆形 DOM 元素，上面显示材质图标和名称。
 *
 * 贴纸支持：
 *   - 拖动重新定位（触摸和鼠标都支持）
 *   - 触碰时高亮发光效果
 *   - 点击删除按钮（× 号）从画布上移除
 *
 * 拖动原理：
 *   记录按下时的起始坐标和贴纸的初始位置，
 *   移动时计算偏移量，更新贴纸的 CSS left/top 值。
 * ============================================================
 */

import { getMaterial } from '../data/materials.js';

export class MaterialSticker {
  /**
   * 构造函数 —— 创建一个材质贴纸
   *
   * @param {string} materialId  材质 ID，例如 "glass"
   * @param {number} x           贴纸中心的横坐标（相对于画布左边缘，单位 px）
   * @param {number} y           贴纸中心的纵坐标（相对于画布顶边缘，单位 px）
   */
  constructor(materialId, x, y) {
    this.materialId = materialId; // 材质 ID
    this.x = x;                   // 当前中心 X 坐标
    this.y = y;                   // 当前中心 Y 坐标

    // 从 materials.js 查找这个材质的详细信息（图标、颜色、大小等）
    const mat = getMaterial(materialId);
    this.size = mat?.size ?? 100; // 贴纸直径，找不到就默认 100px
    this._mat = mat;              // 保存材质对象备用

    // 创建 DOM 元素并绑定拖动事件
    this.el = this._createElement();
    this._bindDrag();
  }

  /**
   * 创建贴纸的 DOM 元素
   * 结构：
   *   <div class="material-sticker mat-glass">  ← 圆形容器，带颜色
   *     <span class="sticker-icon">🪟</span>     ← Emoji 图标
   *     <span class="sticker-label">玻璃</span>  ← 材质名称
   *     <button class="sticker-delete">✕</button> ← 删除按钮（悬停时显示）
   *   </div>
   *
   * @returns {HTMLElement}  创建好的 DOM 元素
   */
  _createElement() {
    const mat = this._mat;
    const el = document.createElement('div');

    // CSS 类：material-sticker（通用样式）+ mat-glass（材质专属颜色）
    el.className = `material-sticker ${mat.cssClass}`;

    // data-materialId：自定义数据属性，方便调试时查看
    el.dataset.materialId = this.materialId;

    // 设置贴纸大小（宽高相等，所以是正圆形）
    el.style.width  = `${this.size}px`;
    el.style.height = `${this.size}px`;

    // 设置贴纸位置（CSS position: absolute 相对于画布）
    // 注意：left/top 是元素左上角的坐标，所以要减去半径才能让中心对准 x/y
    el.style.left = `${this.x - this.size / 2}px`;
    el.style.top  = `${this.y - this.size / 2}px`;

    // 设置内部 HTML 结构
    el.innerHTML = `
      <span class="sticker-icon">${mat.icon}</span>
      <span class="sticker-label">${mat.label}</span>
      <button class="sticker-delete" aria-label="删除">✕</button>
    `;

    // 绑定删除按钮的点击事件
    el.querySelector('.sticker-delete').addEventListener('click', (e) => {
      // stopPropagation()：阻止点击事件冒泡到贴纸本身（防止触发拖动）
      e.stopPropagation();
      this.destroy(); // 删除这个贴纸
    });

    return el;
  }

  /**
   * 绑定拖动事件
   * 同时支持：
   *   - 触摸拖动（手机 / iPad）：touchstart + touchmove + touchend
   *   - 鼠标拖动（Windows Chrome）：pointerdown + pointermove + pointerup
   *
   * 拖动算法：
   *   1. 按下时：记录按下点坐标 (startX, startY) 和贴纸初始位置 (origLeft, origTop)
   *   2. 移动时：计算偏移 dx = 当前X - startX，更新贴纸位置
   *   3. 松开时：清理状态，移除全局监听器
   */
  _bindDrag() {
    const el = this.el;

    // 拖动状态变量
    let startX, startY;     // 按下时的坐标
    let origLeft, origTop;  // 按下时贴纸的 CSS left/top
    let dragging = false;   // 是否正在拖动

    /**
     * 按下事件处理（触摸 + 鼠标共用）
     */
    const onDown = (e) => {
      // 如果点击的是删除按钮，不触发拖动
      if (e.target.classList.contains('sticker-delete')) return;

      e.preventDefault(); // 防止触摸时页面滚动
      dragging = true;

      // 判断是触摸事件还是鼠标事件，获取坐标
      // e.touches 存在时是触摸事件，否则是鼠标事件
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX; // 按下点的屏幕 X 坐标
      startY = pt.clientY; // 按下点的屏幕 Y 坐标

      // parseInt(..., 10)：把 "50px" 这样的字符串转成数字 50
      origLeft = parseInt(el.style.left, 10);
      origTop  = parseInt(el.style.top,  10);

      // 添加拖动样式（放大 + 阴影加深，在 main.css 里定义）
      el.classList.add('dragging');
      el.style.zIndex = 100; // 拖动时置于最前面

      // 把 move 和 up 事件绑定到 document（整个页面），
      // 这样即使鼠标/手指移出贴纸范围，拖动也不会中断
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup',   onUp);
      document.addEventListener('touchmove',   onMoveT, { passive: false });
      document.addEventListener('touchend',    onUpT);
    };

    /**
     * 鼠标移动处理
     */
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX; // 横向偏移量
      const dy = e.clientY - startY; // 纵向偏移量
      this._setPos(origLeft + dx, origTop + dy); // 更新贴纸位置
    };

    /**
     * 触摸移动处理
     */
    const onMoveT = (e) => {
      if (!dragging) return;
      e.preventDefault(); // 防止页面滚动
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      this._setPos(origLeft + dx, origTop + dy);
    };

    /**
     * 松开处理（清理拖动状态）
     */
    const onUp = () => {
      dragging = false;
      el.classList.remove('dragging'); // 移除拖动样式
      el.style.zIndex = '';            // 恢复默认层级
      // 移除全局监听器（不再需要跟踪鼠标/手指移动）
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
      document.removeEventListener('touchmove',   onMoveT);
      document.removeEventListener('touchend',    onUpT);
    };

    const onUpT = onUp; // 触摸松开和鼠标松开逻辑相同

    // 绑定按下事件到贴纸元素本身
    el.addEventListener('pointerdown', onDown);                          // 鼠标
    el.addEventListener('touchstart',  onDown, { passive: false });      // 触摸
  }

  /**
   * 更新贴纸位置
   * left/top 是贴纸左上角的位置，同时更新 x/y（中心坐标）。
   *
   * @param {number} left  新的 CSS left 值（px）
   * @param {number} top   新的 CSS top 值（px）
   */
  _setPos(left, top) {
    // 同步中心坐标（左上角 + 半个尺寸 = 中心）
    this.x = left + this.size / 2;
    this.y = top  + this.size / 2;

    // 更新 DOM 样式
    this.el.style.left = `${left}px`;
    this.el.style.top  = `${top}px`;
  }

  /**
   * 设置触碰高亮样式
   * 当手指/鼠标触碰到这个贴纸时，显示发光边框效果。
   * 在 main.css 里 .active-touch 类定义了这个样式。
   *
   * @param {boolean} active  true = 高亮，false = 恢复正常
   */
  setActiveTouchStyle(active) {
    // classList.toggle(name, force)：force 为 true 时添加，false 时移除
    this.el.classList.toggle('active-touch', active);
  }

  /**
   * 删除这个贴纸
   * 触发自定义事件 'sticker:remove'，通知 Canvas.js 从数组里移除这个贴纸对象。
   * 然后把 DOM 元素从页面上删除。
   *
   * 为什么用自定义事件而不是直接调用 Canvas 的方法？
   *   因为 Sticker 不持有 Canvas 的引用，通过事件冒泡解耦合，代码更干净。
   */
  destroy() {
    // 触发自定义事件（bubbles: true 让事件向上冒泡到 Canvas 元素）
    this.el.dispatchEvent(new CustomEvent('sticker:remove', {
      bubbles: true,
      detail: { sticker: this }, // 把自己传过去，让 Canvas 知道删哪个
    }));
    // 从 DOM 中移除元素
    this.el.remove();
  }
}
