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
 *   monitor.record(materialId, area);
 * ============================================================
 */

export class DataMonitor {
  constructor() {
    // ── 获取 DOM 元素 ────────────────────────────────────────────────────
    this._panel     = document.getElementById('data-monitor');
    this._btnToggle = document.getElementById('monitor-toggle');
    this._btnClear  = document.getElementById('monitor-clear');
    this._liveDot   = this._panel.querySelector('.monitor-live-dot');

    this._elMaterial = document.getElementById('mon-material');
    this._elArea     = document.getElementById('mon-area');
    this._elRate     = document.getElementById('mon-rate');

    this._canvas = document.getElementById('monitor-chart');
    this._ctx    = this._canvas.getContext('2d');
    this._logEl  = document.getElementById('monitor-log');

    // ── 数据存储 ─────────────────────────────────────────────────────────
    // 面积历史数组（最多保留 50 个点，用于绘制波形）
    this._areaHistory = [];
    this._MAX_HISTORY = 50;

    // 用于计算发送频率：记录最近 1 秒内的发送次数
    this._rateCount   = 0;
    this._rateDisplay = 0;

    // 无数据超时计时器（超过 300ms 没有新数据，圆点变灰）
    this._idleTimer = null;

    // 记录列表最大条数
    this._MAX_LOG = 30;

    // ── 初始化 ───────────────────────────────────────────────────────────
    this._bindUI();
    this._startRateTimer();
    this._drawChart();
  }

  // ─── UI 绑定 ────────────────────────────────────────────────────────────────

  _bindUI() {
    this._btnToggle.addEventListener('click', () => this._toggle());
    this._btnClear.addEventListener('click',  () => this._clear());
  }

  _toggle() {
    const hidden = this._panel.classList.toggle('monitor-hidden');
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

    this._elMaterial.textContent = matLabels[materialId] ?? materialId;
    this._elMaterial.setAttribute('data-mat', materialId);

    this._elArea.textContent = area > 0 ? Math.round(area).toLocaleString() : '0';

    // ── 更新频率计数 ──────────────────────────────────────────────────────
    this._rateCount++;

    // ── 更新呼吸圆点 ──────────────────────────────────────────────────────
    this._liveDot.classList.remove('idle');
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      this._liveDot.classList.add('idle');
    }, 300);

    // ── 记录面积历史（用于波形图） ────────────────────────────────────────
    this._areaHistory.push(area);
    if (this._areaHistory.length > this._MAX_HISTORY) {
      this._areaHistory.shift();
    }
    this._drawChart();

    // ── 添加到历史记录列表 ────────────────────────────────────────────────
    if (materialId !== 'none') {
      this._addLogEntry(materialId, area);
    }
  }

  // ─── 发送频率统计 ────────────────────────────────────────────────────────────

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
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, W, H);

    const data = this._areaHistory;
    if (data.length < 2) return;

    const maxArea = Math.max(...data, 100);

    // 辅助虚线
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
    ctx.setLineDash([]);

    const step   = W / (this._MAX_HISTORY - 1);
    const startX = (this._MAX_HISTORY - data.length) * step;

    // 渐变填充
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(124,111,247,0.5)');
    grad.addColorStop(1, 'rgba(124,111,247,0.0)');

    ctx.beginPath();
    data.forEach((area, i) => {
      const x = startX + i * step;
      const y = H - (area / maxArea) * (H - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    });

    // 紫色折线
    ctx.strokeStyle = 'rgba(124,111,247,0.9)';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();

    // 填充线下面积
    const lastX = startX + (data.length - 1) * step;
    const lastY = H - (data[data.length - 1] / maxArea) * (H - 4) - 2;
    ctx.lineTo(lastX, H);
    ctx.lineTo(startX, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 最新数据点的小圆点
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

    const now  = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');

    const entry = document.createElement('div');
    entry.className = 'monitor-log-entry';
    entry.innerHTML = `
      <span class="log-dot mat-${materialId}"></span>
      <span class="log-mat">${matLabels[materialId] ?? materialId}</span>
      <span class="log-area">${Math.round(area).toLocaleString()} px²</span>
      <span class="log-time">${time}</span>
    `;

    this._logEl.insertBefore(entry, this._logEl.firstChild);

    while (this._logEl.children.length > this._MAX_LOG) {
      this._logEl.removeChild(this._logEl.lastChild);
    }
  }
}
