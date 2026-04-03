/**
 * ============================================================
 * 文件：BluetoothManager.js
 * 作用：蓝牙连接与数据发送管理器
 * ============================================================
 *
 * 这个文件负责所有和蓝牙相关的事情：
 *   1. 连接到 MCU（单片机）上的蓝牙设备
 *   2. 把触摸信息（材质 + 接触面积）通过蓝牙发送给 MCU
 *   3. 断开蓝牙连接
 *   4. 通知 UI 当前蓝牙状态（未连接 / 连接中 / 已连接）
 *
 * 使用的技术：Web Bluetooth API
 *   这是浏览器内置的 API，Chrome 支持它，可以直接从网页连接蓝牙设备。
 *   iOS Safari 不原生支持，需要用第三方浏览器（如 Bluefy）。
 *
 * 蓝牙通信协议：Nordic UART Service（NUS）
 *   这是一种常见的蓝牙串口模拟协议，很多蓝牙模块（如 nRF52、HC-08）都支持。
 *   - Service UUID：设备的"服务编号"，用来识别这是 UART 服务
 *   - TX Characteristic：手机→MCU 的发送通道
 *
 * 发送的数据格式（JSON 字符串）：
 *   {"material":"glass","area":1234}  ← 手指碰到玻璃，接触面积 1234 px²
 *   {"material":"none","area":0}      ← 手指离开，发送空信号
 * ============================================================
 */

// ─── 蓝牙 UUID 配置 ──────────────────────────────────────────────────────────

/**
 * Nordic UART Service 的服务 UUID
 * UUID 是一个唯一标识符，每种蓝牙服务都有自己的 UUID。
 * 这个 UUID 是 Nordic 公司制定的 UART 串口模拟服务的标准 UUID。
 * 如果你的 MCU 用的是其他协议，需要修改这里。
 */
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

/**
 * TX Characteristic UUID（写入通道）
 * Characteristic 是服务下的具体功能通道。
 * TX（Transmit）是"发送"的意思：手机通过这个通道把数据写入 MCU。
 * writeValueWithoutResponse 表示写入后不等待 MCU 回复（速度更快）。
 */
const TX_CHARACTERISTIC = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// ─── 类定义 ──────────────────────────────────────────────────────────────────

export class BluetoothManager {
  constructor() {
    // 蓝牙设备对象（连接成功后赋值）
    this._device = null;

    // GATT 服务器对象（GATT 是蓝牙低功耗的通信框架）
    this._server = null;

    // TX 写入通道对象（连接成功后赋值，用于发送数据）
    this._txChar = null;

    // 状态变化回调函数（由 main.js 注册，用于更新 UI）
    // 状态取值：'disconnected'（未连接）| 'connecting'（连接中）| 'connected'（已连接）
    this._onStatusChange = null;
  }

  /**
   * 注册状态变化监听器
   * 每次蓝牙状态改变时，都会调用这个回调，通知 UI 更新显示。
   *
   * 调用示例（在 main.js 中）：
   *   ble.onStatusChange((status) => {
   *     if (status === 'connected') { ... }
   *   });
   *
   * @param {Function} cb  回调函数，接收一个 status 字符串参数
   */
  onStatusChange(cb) {
    this._onStatusChange = cb;
  }

  /**
   * 内部方法：更新状态并触发回调
   * @param {'disconnected'|'connecting'|'connected'} status
   */
  _setStatus(status) {
    // 可选链调用：如果 _onStatusChange 不为 null，才调用它
    this._onStatusChange?.(status);
  }

  /**
   * 判断当前是否已连接蓝牙
   * 读取设备 GATT 连接状态。
   * 可选链（?.）：如果 _device 为 null，不会报错，直接返回 false。
   *
   * @returns {boolean}
   */
  get isConnected() {
    return this._device?.gatt?.connected ?? false;
  }

  /**
   * 连接蓝牙设备
   * 调用后会弹出浏览器的蓝牙设备选择器，让用户选择要连接的 MCU 设备。
   *
   * 连接流程：
   *   1. 用 requestDevice() 扫描并让用户选择设备
   *   2. 连接 GATT 服务器
   *   3. 获取 UART 服务
   *   4. 获取 TX 写入通道
   *   5. 连接成功，更新状态
   *
   * @returns {Promise<boolean>}  连接成功返回 true，失败返回 false
   */
  async connect() {
    // 检查浏览器是否支持 Web Bluetooth API
    // Chrome (Android/Windows/macOS) 支持，iOS Safari 不支持
    if (!navigator.bluetooth) {
      alert(
        '此浏览器不支持 Web Bluetooth API。\n' +
        '请使用：\n' +
        '• Windows / Android：Google Chrome\n' +
        '• iOS / iPadOS：Bluefy 或 WebBLE 浏览器'
      );
      return false;
    }

    try {
      // 更新 UI 状态为"连接中"
      this._setStatus('connecting');

      // 弹出蓝牙设备选择器
      // filters：只显示广播了 UART Service UUID 的设备（精确过滤）
      // 如果调试时找不到设备，可以改为 acceptAllDevices: true
      this._device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        // acceptAllDevices: true, // ← 调试时取消注释，显示所有蓝牙设备
      });

      // 监听"意外断开"事件
      // 当 MCU 断电或超出范围时，会触发这个事件
      this._device.addEventListener('gattserverdisconnected', () => {
        this._txChar = null; // 清空写入通道
        this._setStatus('disconnected');
        console.warn('[BLE] 设备已断开连接');
      });

      // 连接到设备的 GATT 服务器（这是蓝牙低功耗通信的入口）
      this._server = await this._device.gatt.connect();

      // 获取 UART 主服务（通过 UUID 定位）
      const service = await this._server.getPrimaryService(SERVICE_UUID);

      // 获取 TX 写入通道（通过 UUID 定位）
      this._txChar = await service.getCharacteristic(TX_CHARACTERISTIC);

      // 全部成功，更新状态为"已连接"
      this._setStatus('connected');
      console.log(`[BLE] 已连接到设备：${this._device.name}`);
      return true;

    } catch (err) {
      // 用户取消选择，或设备连接失败
      console.warn('[BLE] 连接失败：', err);
      this._setStatus('disconnected');
      return false;
    }
  }

  /**
   * 断开蓝牙连接
   * 主动断开时调用（用户点击断开按钮）。
   */
  async disconnect() {
    if (this._device?.gatt?.connected) {
      this._device.gatt.disconnect();
    }
    this._txChar = null;
    this._setStatus('disconnected');
    console.log('[BLE] 已主动断开连接');
  }

  /**
   * 发送触摸数据给 MCU
   * 每次触摸事件触发时都会调用这个方法。
   *
   * 发送步骤：
   *   1. 把数据打包成 JSON 字符串，例如：{"material":"glass","area":1234}
   *   2. 用 TextEncoder 把字符串转成字节数组（蓝牙只能传输二进制数据）
   *   3. 通过 TX 通道写入 MCU
   *
   * @param {string} materialId  当前触碰的材质 ID，空白时为 "none"
   * @param {number} area        接触面积（单位：像素²）
   */
  async send(materialId, area) {
    // 如果没有连接蓝牙，直接返回（不报错）
    if (!this.isConnected || !this._txChar) return;

    // 构造 JSON 数据包
    // Math.round(area)：把小数面积四舍五入为整数，节省传输字节
    const payload = JSON.stringify({
      material: materialId,
      area: Math.round(area),
    });

    // TextEncoder：把 JS 字符串（UTF-16）转换为 UTF-8 字节数组
    // 蓝牙传输的是原始字节，必须先编码
    const encoded = new TextEncoder().encode(payload);

    try {
      // writeValueWithoutResponse：写入数据，不等待 MCU 回复
      // 比 writeValue 更快（无应答确认），适合高频触摸事件
      await this._txChar.writeValueWithoutResponse(encoded);
    } catch (err) {
      // 发送失败（蓝牙断开、缓冲区满等），只打印警告，不中断程序
      console.warn('[BLE] 发送失败：', err);
    }
  }
}
