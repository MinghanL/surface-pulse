/**
 * ============================================================
 * 文件：templates.js
 * 作用：定义预设的材质模板
 * ============================================================
 *
 * 模板（Template）就是提前摆好材质贴纸的布局方案。
 * 用户可以在材质库抽屉里点击模板，一键把多个贴纸摆放到画布上，
 * 不需要手动一个个拖拽，方便快速测试。
 *
 * 每个模板包含：
 *   id          — 模板的唯一 ID
 *   name        — 模板名称（显示在抽屉里）
 *   description — 简短说明（包含哪些材质）
 *   stickers    — 贴纸列表，每个贴纸包含：
 *     materialId — 材质 ID（对应 materials.js 里的 id 字段）
 *     xPct       — 贴纸中心的横向位置，用百分比表示（0.0 = 最左, 1.0 = 最右）
 *     yPct       — 贴纸中心的纵向位置，用百分比表示（0.0 = 最顶, 1.0 = 最底）
 *
 * 为什么用百分比而不是固定像素？
 *   因为手机屏幕大小不同（iPhone SE vs iPad Pro），
 *   用百分比可以让贴纸在任何屏幕上都按比例分布，不会跑偏。
 *   实际坐标在 Canvas.js 的 loadTemplate() 里换算：
 *     实际 x = xPct × 画布宽度（px）
 * ============================================================
 */

export const TEMPLATES = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Glass · Wood · Metal  · Sand',
    stickers: [
      // 三个贴纸横向均匀排列在画布中间偏上的位置
      { materialId: 'glass',  xPct: 0.20, yPct: 0.35 }, // 左边 20%，高度 35%
      { materialId: 'wood',   xPct: 0.50, yPct: 0.35 }, // 正中 50%，高度 35%
      { materialId: 'metal',  xPct: 0.80, yPct: 0.35 }, // 右边 80%，高度 35%
      { materialId: 'sand',   xPct: 0.50, yPct: 0.65 }, // 正中 50%，高度 35%
    ],
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Wood · Stone · Rubber',
    stickers: [
      // 三角形分布，更有层次感
      { materialId: 'wood',   xPct: 0.25, yPct: 0.30 },
      { materialId: 'stone',  xPct: 0.55, yPct: 0.55 },
      { materialId: 'rubber', xPct: 0.75, yPct: 0.30 },
    ],
  },
  {
    id: 'tech',
    name: 'Tech',
    description: 'Metal · Glass · Rubber',
    stickers: [
      { materialId: 'metal',  xPct: 0.20, yPct: 0.50 },
      { materialId: 'glass',  xPct: 0.50, yPct: 0.25 },
      { materialId: 'rubber', xPct: 0.75, yPct: 0.55 },
    ],
  },
  {
    id: 'full',
    name: 'Full Set',
    description: 'All six materials',
    stickers: [
      // 六个贴纸分两行摆放
      { materialId: 'glass',  xPct: 0.20, yPct: 0.25 }, // 第一行左
      { materialId: 'wood',   xPct: 0.50, yPct: 0.20 }, // 第一行中
      { materialId: 'metal',  xPct: 0.80, yPct: 0.25 }, // 第一行右
      { materialId: 'rubber', xPct: 0.25, yPct: 0.65 }, // 第二行左
      { materialId: 'fabric', xPct: 0.55, yPct: 0.70 }, // 第二行中
      { materialId: 'stone',  xPct: 0.78, yPct: 0.62 }, // 第二行右
    ],
  },
];
