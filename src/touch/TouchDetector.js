/**
 * ============================================================
 * 文件：TouchDetector.js
 * 作用：触控与鼠标检测器
 * ============================================================
 *
 * 这个文件负责监听用户在画布上的"触摸"或"鼠标点击"动作，
 * 然后判断：
 *   1. 当前触碰到的是哪个材质贴纸（或者空白区域）
 *   2. 接触面积有多大（手指按得越用力/越大，面积越大）
 *
 * 支持两种输入方式：
 *   - 触摸屏（手机、iPad）：使用 Touch 事件
 *   - 鼠标（Windows Chrome）：使用 Pointer 事件
 *
 * 检测到后，会把结果回调给 Canvas.js 去处理（发蓝牙、更新 UI）。
 * ============================================================
 */

export class TouchDetector {
  /**
   * 构造函数 —— 创建一个触控检测器
   *
   * @param {HTMLElement} canvasEl
   *   画布 DOM 元素（就是 index.html 里的 <div id="canvas">）
   *
   * @param {Function} onTouch
   *   有触碰时的回调函数，会传入以下参数：
   *     - materialId {string}  当前碰到的材质 ID，例如 "glass"，空白区域为 "none"
   *     - area       {number}  接触面积（单位：像素²），鼠标时固定为估算值
   *     - x          {number}  触点的屏幕横坐标（px）
   *     - y          {number}  触点的屏幕纵坐标（px）
   *     - touchW     {number}  触点宽度（px），用于绘制触点指示圆圈
   *     - touchH     {number}  触点高度（px）
   *
   * @param {Function} onRelease
   *   手指/鼠标松开时的回调函数（无参数）
   */
  constructor(canvasEl, onTouch, onRelease) {
    this._canvas    = canvasEl;   // 画布元素
    this._onTouch   = onTouch;    // 触碰时的回调
    this._onRelease = onRelease;  // 松开时的回调

    // 存放当前画布上所有材质贴纸的数组
    // 每个元素是一个 MaterialSticker 实例（由 Canvas.js 维护）
    this._stickers = [];

    // 记录鼠标是否正在按下（用于区分鼠标移动和按下移动）
    this._mouseDown = false;

    // 注册所有事件监听
    this._bind();
  }

  /**
   * 更新贴纸列表
   * 每次画布上的贴纸增加或删除时，Canvas.js 会调用这个方法同步最新列表。
   * 检测命中时需要知道所有贴纸的位置。
   *
   * @param {MaterialSticker[]} stickers  最新的贴纸数组
   */
  updateStickers(stickers) {
    this._stickers = stickers;
  }

  /**
   * 绑定事件监听
   * 同时支持触摸事件（手机/iPad）和鼠标/Pointer 事件（Windows Chrome）。
   * { passive: false } 的作用：允许我们在事件处理里调用 e.preventDefault()，
   * 防止浏览器在触摸时自动滚动页面。
   */
  _bind() {
    const opts = { passive: false };

    // ── 触摸事件（手机 / iPad / 触摸屏） ──────────────────────────────
    // touchstart：手指刚放上去
    // touchmove ：手指滑动中
    this._canvas.addEventListener('touchstart',  this._handleTouch.bind(this), opts);
    this._canvas.addEventListener('touchmove',   this._handleTouch.bind(this), opts);
    // touchend / touchcancel：手指离开（正常抬起 或 被系统打断）
    this._canvas.addEventListener('touchend',    this._handleTouchEnd.bind(this), opts);
    this._canvas.addEventListener('touchcancel', this._handleTouchEnd.bind(this), opts);

    // ── Pointer 事件（鼠标 / Windows Chrome） ─────────────────────────
    // pointerdown：鼠标左键按下（也会被触摸屏触发，但我们用 pointerType 区分）
    this._canvas.addEventListener('pointerdown', this._handlePointerDown.bind(this), opts);
    // pointermove：鼠标移动（只在按下时处理）
    this._canvas.addEventListener('pointermove', this._handlePointerMove.bind(this), opts);
    // pointerup / pointerleave：鼠标松开 或 移出画布
    this._canvas.addEventListener('pointerup',   this._handlePointerUp.bind(this), opts);
    this._canvas.addEventListener('pointerleave',this._handlePointerUp.bind(this), opts);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 触摸事件处理（手机 / iPad）
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * 处理触摸开始 / 触摸移动
   * 从 TouchEvent 中提取第一个触点的坐标和面积信息。
   */
  _handleTouch(e) {
    // 阻止默认行为：防止触摸时页面滚动或缩放
    e.preventDefault();

    // 取第一个触点（如果用户多指触控，只取第一根手指）
    const touch = e.touches[0];
    if (!touch) return;

    const x = touch.clientX; // 触点横坐标（相对于浏览器视口左边缘）
    const y = touch.clientY; // 触点纵坐标（相对于浏览器视口顶边缘）

    // radiusX / radiusY：手指接触区域的半径（单位 px）
    // 手指越胖、按得越用力，这个值越大
    // 如果浏览器不支持，默认给 10px
    const rx = touch.radiusX ?? 10;
    const ry = touch.radiusY ?? 10;

    // 用椭圆面积公式计算接触面积：面积 = π × rx × ry
    const area = Math.PI * rx * ry;

    // 检测这个坐标命中了哪个材质贴纸
    const hit = this._hitTest(x, y);

    // 回调 Canvas.js 的 _onTouch 方法
    // 如果没命中任何贴纸，materialId 为 "none"
    this._onTouch(
      hit ? hit.materialId : 'none', // 材质 ID
      area,                          // 接触面积
      x, y,                          // 坐标
      rx * 2, ry * 2,                // 接触宽度和高度（用于画指示圆）
    );
  }

  /**
   * 处理触摸结束
   * 当所有手指都离开屏幕时（e.touches.length === 0），通知上层松开了。
   */
  _handleTouchEnd(e) {
    if (e.touches.length === 0) {
      this._onRelease();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Pointer 事件处理（鼠标 / Windows Chrome）
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * 鼠标按下
   * pointerType === 'touch' 时说明是触摸屏触发的 Pointer 事件，
   * 我们已经用 Touch 事件处理了，所以这里跳过，避免重复触发。
   */
  _handlePointerDown(e) {
    if (e.pointerType === 'touch') return; // 触摸屏事件由上面的 Touch 处理
    if (e.button !== 0) return;           // 只响应鼠标左键（button=0），忽略右键/中键

    this._mouseDown = true;

    // 立即触发一次（鼠标按下的瞬间也要检测）
    this._processPointer(e);
  }

  /**
   * 鼠标移动
   * 只在鼠标按下（_mouseDown = true）时才处理，纯移动不触发。
   */
  _handlePointerMove(e) {
    if (e.pointerType === 'touch') return; // 触摸屏跳过
    if (!this._mouseDown) return;          // 没按下鼠标时不处理

    this._processPointer(e);
  }

  /**
   * 鼠标松开 / 移出画布
   */
  _handlePointerUp(e) {
    if (e.pointerType === 'touch') return; // 触摸屏跳过
    if (!this._mouseDown) return;

    this._mouseDown = false;
    this._onRelease();
  }

  /**
   * 处理 Pointer 事件的核心逻辑（鼠标共用）
   * 鼠标没有 radiusX/Y，所以接触面积用固定的模拟值（20×20 px 圆）。
   */
  _processPointer(e) {
    const x = e.clientX;
    const y = e.clientY;

    // 鼠标没有真实接触面积，模拟为半径 10px 的圆
    const simulatedRadius = 10;
    const area = Math.PI * simulatedRadius * simulatedRadius;

    // 命中检测
    const hit = this._hitTest(x, y);

    this._onTouch(
      hit ? hit.materialId : 'none',
      area,
      x, y,
      simulatedRadius * 2, simulatedRadius * 2,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 命中检测
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * 判断坐标 (x, y) 是否在某个材质贴纸的圆形范围内
   *
   * 因为贴纸是圆形的，我们用勾股定理计算触点到贴纸圆心的距离，
   * 如果距离 ≤ 贴纸半径，就说明命中了。
   *
   * 从数组末尾往前遍历，是因为后添加的贴纸显示在最上层（z-index 更高），
   * 应该优先命中。
   *
   * @param {number} x  触点横坐标
   * @param {number} y  触点纵坐标
   * @returns {MaterialSticker|null}  命中的贴纸，或 null（没命中任何贴纸）
   */
  _hitTest(x, y) {
    for (let i = this._stickers.length - 1; i >= 0; i--) {
      const sticker = this._stickers[i];

      // getBoundingClientRect()：获取贴纸 DOM 元素相对于视口的位置和尺寸
      const rect = sticker.el.getBoundingClientRect();

      // 圆心坐标 = 矩形左边 + 宽度一半
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;

      // 贴纸半径 = 宽度一半（因为是正圆形）
      const r = rect.width / 2;

      // Math.hypot(dx, dy) 等价于 √(dx² + dy²)，即两点之间的距离
      const dist = Math.hypot(x - cx, y - cy);

      // 距离 ≤ 半径，说明触点在这个圆形贴纸内
      if (dist <= r) return sticker;
    }

    // 没有命中任何贴纸
    return null;
  }
}
