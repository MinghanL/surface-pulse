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
    this._elForce    = document.getElementById('mon-force');    // force 数值
    this._elForceBar = document.getElementById('mon-force-bar');// force 进度条填充

    this._canvas  = document.getElementById('monitor-chart');   // 波形 Canvas
    this._ctx     = this._canvas.getContext('2d');              // 2D 绘图上下文
    this._logEl   = document.getElementById('monitor-log');     // 记录列表容器

    // ── 数据存储 ─────────────────────────────────────────────────────────
    // 面积历史数组（最多保留 50 个点，用于绘制波形）
    this._areaHistory  = [];
    // force 历史数组（与面积同步，绘制第二条波形线）
    this._forceHistory = [];
    this._MAX_HISTORY  = 50;

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
    this._areaHistory  = [];
    this._forceHistory = [];
    this._logEl.innerHTML = '';
    this._elMaterial.textContent = '—';
    this._elMaterial.removeAttribute('data-mat');
    this._elArea.textContent = '—';
    this._elRate.textContent = '0';
    this._elForce.textContent = '—';
    this._elForceBar.style.width = '0%';
    this._drawChart();
  }

  // ─── 核心：记录一次数据 ──────────────────────────────────────────────────────

  /**
   * 外部调用：每次发送蓝牙数据时调用这个方法
   * @param {string} materialId  材质 ID，例如 "glass" 或 "none"
   * @param {number} area        接触面积（px²）
   * @param {number} force       触压强度（0~1）
   */
  record(materialId, area, force = 0) {
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

    // 更新 force 显示和进度条
    this._updateForce(force);

    // ── 更新频率计数 ──────────────────────────────────────────────────────
    this._rateCount++;

    // ── 更新呼吸圆点（有数据 = 绿色闪烁） ────────────────────────────────
    this._liveDot.classList.remove('idle');
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      this._liveDot.classList.add('idle');
    }, 300);

    // ── 记录面积历史（用于波形图） ────────────────────────────────────────
    this._areaHistory.push(area);
    // 同步记录 force 历史（用于第二条波形线）
    this._forceHistory.push(force);
    if (this._areaHistory.length > this._MAX_HISTORY) {
      this._areaHistory.shift();
      this._forceHistory.shift();
    }
    this._drawChart();

    // ── 添加到历史记录列表 ────────────────────────────────────────────────
    if (materialId !== 'none') {
      this._addLogEntry(materialId, area, force);
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

  // ─── Force 显示 ──────────────────────────────────────────────────────────────

  /**
   * 更新 force 数值和进度条
   * 进度条宽度 = force × 100%（例如 force=0.6 → 宽度60%）
   * 颜色随 force 从绿色渐变到橙色再到红色，直观表示压力大小
   *
   * @param {number} force  0~1
   */
  _updateForce(force) {
    // 数值：保留两位小数（例如 "0.62"）
    this._elForce.textContent = force > 0 ? force.toFixed(2) : '0';

    // 进度条宽度（百分比）
    const pct = Math.min(force * 100, 100).toFixed(1);
    this._elForceBar.style.width = `${pct}%`;

    // 颜色：
    //   force < 0.4 → 绿色（轻触）
    //   force < 0.7 → 黄橙色（中等）
    //   force ≥ 0.7 → 红色（重按）
    let color;
    if (force < 0.4)      color = '#4ade80'; // 绿
    else if (force < 0.7) color = '#fb923c'; // 橙
    else                  color = '#f87171'; // 红

    this._elForceBar.style.background = color;
    this._elForce.style.color = force > 0 ? color : 'var(--text-muted)';
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

    // 在面积折线最新数据点画一个小圆点
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#a78bfa';
    ctx.fill();

    // ── 绘制 force 折线（叠加在面积图上，用橙色区分）──────────────────────
    const fData = this._forceHistory;
    if (fData.length >= 2) {
      const fStartX = (this._MAX_HISTORY - fData.length) * step;

      ctx.beginPath();
      fData.forEach((f, i) => {
        const fx = fStartX + i * step;
        // force 范围 0~1，映射到画布高度（留 4px 边距）
        const fy = H - f * (H - 4) - 2;
        if (i === 0) ctx.moveTo(fx, fy);
        else         ctx.lineTo(fx, fy);
      });

      ctx.strokeStyle = 'rgba(251,146,60,0.85)'; // 橙色
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.stroke();

      // 最新 force 点的小圆点
      const fLastX = fStartX + (fData.length - 1) * step;
      const fLastY = H - fData[fData.length - 1] * (H - 4) - 2;
      ctx.beginPath();
      ctx.arc(fLastX, fLastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fb923c';
      ctx.fill();
    }
  }

  // ─── 历史记录列表 ────────────────────────────────────────────────────────────

  /**
   * 在列表顶部插入一条记录
   * 格式：● 玻璃   314 px²   f:0.52   12:34:56
   */
  _addLogEntry(materialId, area, force = 0) {
    const matLabels = {
      glass: '玻璃', wood: '木头', metal: '金属',
      rubber: '橡胶', fabric: '布料', stone: '石头',
    };

    // 当前时间（时:分:秒）
    const now  = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');

    // force 颜色和文字
    const forceColor = force < 0.4 ? '#4ade80' : force < 0.7 ? '#fb923c' : '#f87171';
    const forceText  = force > 0 ? force.toFixed(2) : '—';

    const entry = document.createElement('div');
    entry.className = 'monitor-log-entry';
    entry.innerHTML = `
      <span class="log-dot mat-${materialId}"></span>
      <span class="log-mat">${matLabels[materialId] ?? materialId}</span>
      <span class="log-area">${Math.round(area).toLocaleString()} px²</span>
      <span class="log-force" style="color:${forceColor}">f:${forceText}</span>
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
