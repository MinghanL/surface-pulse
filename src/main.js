/**
 * ============================================================
 * 文件：main.js
 * 作用：应用入口文件（程序从这里启动）
 * ============================================================
 *
 * 这个文件是整个应用的"启动器"。
 * 它做三件事：
 *   1. 创建所有核心模块的实例（蓝牙、画布、抽屉）
 *   2. 把它们串联起来
 *   3. 绑定顶部栏蓝牙状态按钮的交互逻辑
 *
 * 模块之间的关系：
 *
 *   main.js
 *     ├── BluetoothManager  ← 蓝牙通信
 *     ├── Canvas            ← 画布（依赖 BluetoothManager）
 *     └── MaterialDrawer    ← 抽屉（依赖 Canvas）
 *
 * Vite 构建工具会把这个文件作为入口，
 * 自动把所有 import 的模块打包成一个 JS 文件。
 * ============================================================
 */

// 导入核心模块
import { BluetoothManager } from './bluetooth/BluetoothManager.js';
import { Canvas }           from './components/Canvas.js';
import { MaterialDrawer }   from './components/MaterialDrawer.js';
import { DataMonitor }      from './components/DataMonitor.js';

// ─── 初始化核心模块 ────────────────────────────────────────────────────────────

// 1. 创建蓝牙管理器
const ble = new BluetoothManager();

// 2. 创建画布（需要传入蓝牙管理器，画布触摸时会用它发送数据）
const canvas = new Canvas(document.getElementById('canvas'), ble);

// 3. 创建材质抽屉（需要传入画布，拖拽和模板操作会调用画布的方法）
new MaterialDrawer(canvas);

// 4. 创建数据监控窗口，并挂载到蓝牙管理器的发送钩子上
//    这样每次触摸（无论是否已连蓝牙）都会实时显示在监控窗口里
const monitor = new DataMonitor();
ble.onSend((materialId, area) => monitor.record(materialId, area));

// ─── 顶部栏蓝牙状态按钮 ────────────────────────────────────────────────────────

// 获取顶部栏的蓝牙状态区域元素（包含图标 + 文字）
const bleStatusEl = document.getElementById('ble-status');
// 获取文字标签元素（显示"未连接" / "连接中…" / "已连接"）
const bleLabelEl  = document.getElementById('ble-label');

/**
 * 状态 ID → 显示文字的映射表
 * BluetoothManager 会在状态变化时传入这些 key
 */
const STATUS_TEXT = {
  disconnected: 'Disconnected',
  connecting:   'Connecting…',
  connected:    'Connected',
};

/**
 * 注册蓝牙状态变化监听器
 * 每次蓝牙状态改变时（connect/disconnect），BluetoothManager 会调用这个回调。
 * 我们在这里更新 UI：更换 CSS 类（改颜色）和更新文字。
 */
ble.onStatusChange((status) => {
  // 更新 CSS 类名，例如：class="ble-status connected"
  // main.css 里对不同状态定义了不同颜色（绿色=已连接，紫色=连接中，灰色=未连接）
  bleStatusEl.className = `ble-status ${status}`;

  // 更新状态文字（?? status：如果映射表里没有这个 key，就显示 key 本身）
  bleLabelEl.textContent = STATUS_TEXT[status] ?? status;
});

/**
 * 点击蓝牙状态按钮：已连接时断开，未连接时发起连接
 * async/await：connect() 和 disconnect() 是异步操作（需要等待蓝牙响应），
 * 用 await 等待它们完成。
 */
// ─── Blind mode toggle ─────────────────────────────────────────────────────────

const blindToggleEl = document.getElementById('blind-toggle');
const blindIconEye  = document.getElementById('blind-icon-eye');
const blindIconOff  = document.getElementById('blind-icon-off');

blindToggleEl.addEventListener('click', () => {
  const active = canvas.toggleBlindMode();
  blindToggleEl.classList.toggle('active', active);
  blindIconEye.style.display = active ? 'none'  : '';
  blindIconOff.style.display = active ? ''      : 'none';
});

// ─── Edit mode toggle ──────────────────────────────────────────────────────────

const editToggleEl = document.getElementById('edit-toggle');
editToggleEl.addEventListener('click', () => {
  const active = canvas.toggleEditMode();
  editToggleEl.classList.toggle('active', active);
});

// ─── BLE button ────────────────────────────────────────────────────────────────

bleStatusEl.addEventListener('click', async () => {
  if (ble.isConnected) {
    // 当前已连接 → 点击后断开
    await ble.disconnect();
  } else {
    // 当前未连接 → 点击后发起连接（会弹出蓝牙设备选择器）
    await ble.connect();
  }
});
