/**
 * ============================================================
 * 文件：materials.js
 * 作用：定义所有可用材质的数据
 * ============================================================
 *
 * 这个文件就是一个"材质数据库"，列出了网站支持的所有材质种类。
 * 每种材质是一个对象（Object），包含以下字段：
 *
 *   id       — 材质的唯一英文标识符，发送给蓝牙/MCU 时用这个
 *   label    — 材质的中文名称，显示在界面上
 *   icon     — Emoji 图标，显示在圆形贴纸中间
 *   cssClass — CSS 样式类名，决定贴纸的颜色和外观（在 main.css 里定义）
 *   size     — 贴纸的默认直径（单位：像素）
 *
 * 如果想增加新材质，只需在 MATERIALS 数组里加一个对象，
 * 并在 main.css 里加对应的 .mat-xxx 样式即可。
 * ============================================================
 */

/**
 * 所有材质的定义列表
 * 这个数组会被 MaterialDrawer.js 读取，生成材质库面板里的圆形贴纸。
 */
export const MATERIALS = [
  {
    id: 'glass',        // 英文 ID，蓝牙发送时使用
    label: '玻璃',      // 界面显示名
    icon: '🪟',         // 贴纸中心的 Emoji
    cssClass: 'mat-glass', // 对应 main.css 里的 .mat-glass 样式（蓝绿色渐变）
    size: 100,          // 贴纸直径 100px
  },
  {
    id: 'wood',
    label: '木头',
    icon: '🪵',
    cssClass: 'mat-wood',  // 棕色木纹渐变
    size: 100,
  },
  {
    id: 'metal',
    label: '金属',
    icon: '⚙️',
    cssClass: 'mat-metal', // 冷色金属渐变
    size: 100,
  },
  {
    id: 'rubber',
    label: '橡胶',
    icon: '⭕',
    cssClass: 'mat-rubber', // 绿色橡胶渐变
    size: 100,
  },
  {
    id: 'fabric',
    label: '布料',
    icon: '🧶',
    cssClass: 'mat-fabric', // 紫粉色布料渐变
    size: 100,
  },
  {
    id: 'stone',
    label: '石头',
    icon: '🪨',
    cssClass: 'mat-stone',  // 灰色石头渐变
    size: 100,
  },
];

/**
 * 根据 ID 查找材质对象
 *
 * 使用示例：
 *   const mat = getMaterial('glass');
 *   console.log(mat.label); // 输出 "玻璃"
 *
 * Array.find()：遍历数组，返回第一个满足条件的元素。
 * ?? null：如果 find 返回 undefined（没找到），改为返回 null。
 *
 * @param {string} id  材质 ID，例如 "glass"
 * @returns {Object|null}  找到的材质对象，或 null
 */
export function getMaterial(id) {
  return MATERIALS.find((m) => m.id === id) ?? null;
}
