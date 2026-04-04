/**
 * ============================================================
 * 文件：DataMonitor.js
 * 作用：实时蓝牙数据监控悬浮窗
 * ============================================================
 *
 * 显示内容：
 *   - 当前触碰材质（带颜色）
 *   - 当前接触面积（px²）
 *   - 每秒发送频率（次/秒）
 *   - 面积历史波形图（Canvas 折线图，最近 50 个数据点）
 *   - 发送记录列表（最近 30 条，带时间戳）
 *
 * 使用方式（在 main.js 里）：
 *   const monitor = new DataMonitor();
 *   // 每次发送蓝牙数据时调用：
 *   monitor.record(materialId, area);
 * ============================================================
 */

export class DataMonitor {
  constructor() {
    // ── 获取 DOM 元素 ────────────────────────────────────────────────────
    this._panel     = document.getElementById('data-monitor');    // 整个悬浮窗
    this._btnToggle = document.getElementById('monitor-toggle');  // 顶部栏波形按钮
    this._btnClear  = document.getElementById('monitor-clear');   // 清空按钮
    this._liveDot   = this._panel.querySelector('.monitor-live-dot'); // 呼吸圆点

    this._elMaterial = document.getElementById('mon-material'); // 材质字段
    this._elArea     = document.getElementById('mon-area');     // 面积字段
    this._elRate     = document.getElementById('mon-rate');     // 频率字段

    this._canvas  = document.getElementById('monitor-chart');   // 波形 Canvas
    this._ctx     = this._canvas.getContext('2d');              // 2D 绘图上下文
    this._logEl   = document.getElementById('monitor-log');     // 记录列表容器

    // ── 数据存储 ─────────────────────────────────────────────────────────
    // 面积历史数组（最多保留 50 个点，用于绘制波形）
    this._areaHistory = [];
    this._MAX_HISTORY = 50;

    // 用于计算发送频率：记录最近 1 秒内的发送次数
    this._rateCount    = 0;  // 当前计数
    this._rateDisplay  = 0;  // 显示值（每秒更新一次）

    // 无数据超时计时器（超过 300ms 没有新数据，认为触摸结束，圆点变灰）
    this._idleTimer = null;

    // 记录列表最大条数
    this._MAX_LOG = 30;

    // ── 初始化 ───────────────────────────────────────────────────────────
    this._bindUI();
    this._startRateTimer();
    this._drawChart(); // 画一个空的波形图
  }

  // ─── UI 绑定 ────────────────────────────────────────────────────────────────

  _bindUI() {
    // 点击顶部栏按钮：切换悬浮窗显示/隐藏
    this._btnToggle.addEventListener('click', () => this._toggle());

    // 点击清空按钮：清空所有记录和波形
    this._btnClear.addEventListener('click', () => this._clear());
  }

  _toggle() {
    const hidden = this._panel.classList.toggle('monitor-hidden');
    // 按钮激活状态（绿色）= 窗口显示时
    this._btnToggle.classList.toggle('active', !hidden);
  }

  _clear() {
    this._areaHistory = [];
    this._logEl.innerHTML = '';
    this._elMaterial.textContent = '—';
    this._elMaterial.removeAttribute('data-mat');
    this._elArea.textContent = '—';
    this._elRate.textContent = '0';
    this._drawChart();
  }

  // ─── 核心：记录一次数据 ──────────────────────────────────────────────────────

  /**
   * 外部调用：每次发送蓝牙数据时调用这个方法
   * @param {string} materialId  材质 ID，例如 "glass" 或 "none"
   * @param {number} area        接触面积（px²）
   */
  record(materialId, area) {
    // ── 更新当前状态字段 ──────────────────────────────────────────────────
    const matLabels = {
      glass: '玻璃', wood: '木头', metal: '金属',
      rubber: '橡胶', fabric: '布料', stone: '石头', none: '无',
    };

    // 更新材质显示（同时设置 data-mat 属性让 CSS 改颜色）
    this._elMaterial.textContent = matLabels[materialId] ?? materialId;
    this._elMaterial.setAttribute('data-mat', materialId);

    // 更新面积显示
    this._elArea.textContent = area > 0 ? Math.round(area).toLocaleString() : '0';

    // ── 更新频率计数 ──────────────────────────────────────────────────────
    this._rateCount++;

    // ── 更新呼吸圆点（有数据 = 绿色闪烁） ────────────────────────────────
    this._liveDot.classList.remove('idle');
    // 300ms 内没有新数据 → 变灰
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      this._liveDot.classList.add('idle');
    }, 300);

    // ── 记录面积历史（用于波形图） ────────────────────────────────────────
    this._areaHistory.push(area);
    if (this._areaHistory.length > this._MAX_HISTORY) {
      this._areaHistory.shift(); // 超出上限时删掉最旧的点
    }
    this._drawChart();

    // ── 添加到历史记录列表 ────────────────────────────────────────────────
    // material = "none" 时不加到记录（减少噪音，只记录有意义的触碰）
    if (materialId !== 'none') {
      this._addLogEntry(materialId, area);
    }
  }

  // ─── 发送频率统计 ────────────────────────────────────────────────────────────

  /**
   * 每秒触发一次，把 _rateCount 显示到频率字段，然后清零
   */
  _startRateTimer() {
    setInterval(() => {
      this._rateDisplay = this._rateCount;
      this._elRate.textContent = this._rateDisplay;
      this._rateCount = 0;
    }, 1000);
  }

  // ─── 波形图绘制 ──────────────────────────────────────────────────────────────

  /**
   * 在 Canvas 上绘制面积历史波形折线图
   * 横轴 = 时间（最新在右），纵轴 = 接触面积
   */
  _drawChart() {
    const canvas = this._canvas;
    const ctx    = this._ctx;
    const W = canvas.width;   // 注意：用 canvas.width，不是 offsetWidth
    const H = canvas.height;

    // 清空画布（用深色背景填充）
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, W, H);

    const data = this._areaHistory;
    if (data.length < 2) return; // 少于 2 个点无法画线

    // 找到数据中的最大值（用于归一化 Y 轴）
    // Math.max(...data) 找最大值，至少设为 100 防止除以零
    const maxArea = Math.max(...data, 100);

    // 绘制辅助横线（两条虚线，帮助读数）
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    [0.33, 0.66].forEach((ratio) => {
      const y = H - H * ratio;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    });
    ctx.setLineDash([]); // 恢复实线

    // 绘制波形折线
    // 每个数据点的 X 间距 = 画布宽度 / (最大点数 - 1)
    const step = W / (this._MAX_HISTORY - 1);

    // 渐变填充（线下方的面积填充）
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   'rgba(124,111,247,0.5)');
    grad.addColorStop(1,   'rgba(124,111,247,0.0)');

    ctx.beginPath();

    // 从左边（最旧的数据）开始，画到右边（最新的数据）
    // 数据不足 MAX_HISTORY 时，从右边对齐
    const startX = (this._MAX_HISTORY - data.length) * step;

    data.forEach((area, i) => {
      // 归一化：面积越大，y 越靠上（Y 轴从上到下是 0→H，所以要用 H - ...）
      const x = startX + i * step;
      const y = H - (area / maxArea) * (H - 4) - 2; // 留 2px 上下边距

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // 描边（紫色折线）
    ctx.strokeStyle = 'rgba(124,111,247,0.9)';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    // 填充线下面积（半透明紫色渐变）
    const lastX = startX + (data.length - 1) * step;
    const lastY = H - (data[data.length - 1] / maxArea) * (H - 4) - 2;
    ctx.lineTo(lastX, H);
    ctx.lineTo(startX, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 在最新数据点画一个小圆点
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#a78bfa';
    ctx.fill();
  }

  // ─── 历史记录列表 ────────────────────────────────────────────────────────────

  /**
   * 在列表顶部插入一条记录
   * 格式：● 玻璃   314 px²   12:34:56
   */
  _addLogEntry(materialId, area) {
    const matLabels = {
      glass: '玻璃', wood: '木头', metal: '金属',
      rubber: '橡胶', fabric: '布料', stone: '石头',
    };

    // 当前时间（时:分:秒）
    const now  = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => String(n).padStart(2, '0')) // padStart：不足两位前面补零
      .join(':');

    // 创建记录行
    const entry = document.createElement('div');
    entry.className = 'monitor-log-entry';
    entry.innerHTML = `
      <span class="log-dot mat-${materialId}"></span>
      <span class="log-mat">${matLabels[materialId] ?? materialId}</span>
      <span class="log-area">${Math.round(area).toLocaleString()} px²</span>
      <span class="log-time">${time}</span>
    `;

    // 插入到列表最顶部（最新的在上方）
    this._logEl.insertBefore(entry, this._logEl.firstChild);

    // 超过最大条数时删除最旧的记录
    while (this._logEl.children.length > this._MAX_LOG) {
      this._logEl.removeChild(this._logEl.lastChild);
    }
  }
}
