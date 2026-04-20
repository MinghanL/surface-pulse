/**
 * ============================================================
 * templates.js — Template registry (the only file you need to edit)
 * ============================================================
 *
 * To add a new template:
 *   1. Add one object to TEMPLATES below
 *   2. Done — it appears in the drawer automatically
 *
 * Fields:
 *   id          — unique key
 *   name        — display name shown in the drawer
 *   description — short subtitle (e.g. list of materials used)
 *   stickers    — array of sticker placements:
 *     materialId — must match an id in materials.js
 *     xPct       — horizontal center, 0.0 (left) → 1.0 (right)
 *     yPct       — vertical center,   0.0 (top)  → 1.0 (bottom)
 *
 * Percentages are used so layouts scale correctly across screen sizes.
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
