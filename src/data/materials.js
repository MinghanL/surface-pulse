/**
 * ============================================================
 * materials.js — Material registry (the only file you need to edit)
 * ============================================================
 *
 * To add a new material:
 *   1. Put the image in  public/materials/<name>.jpg  (or png/webp)
 *   2. Add one object to MATERIALS below
 *   3. Done — it appears in the drawer automatically
 *
 * Fields:
 *   id     — unique key sent over BLE and used by templates
 *   label  — display name shown on the sticker and in the monitor
 *   image  — path relative to public/ (e.g. 'materials/glass.jpg')
 *   color  — representative hex color used for log dots and monitor text
 *   size   — default sticker diameter in px (min size for pinch-resize)
 * ============================================================
 */

export const MATERIALS = [
  {
    id:    'glass',
    label: 'Glass',
    image: 'materials/glass.png',
    color: '#7BAFC4',
    size:  100,
  },
  {
    id:    'wood',
    label: 'Wood',
    image: 'materials/wood.png',
    color: '#B8865A',
    size:  100,
  },
  {
    id:    'metal',
    label: 'Metal',
    image: 'materials/metal.png',
    color: '#8A9BB0',
    size:  100,
  },
  {
    id:    'rubber',
    label: 'Rubber',
    image: 'materials/rubber.png',
    color: '#6A9E78',
    size:  100,
  },
  {
    id:    'fabric',
    label: 'Fabric',
    image: 'materials/fabric.png',
    color: '#B87EA8',
    size:  100,
  },
  {
    id:    'stone',
    label: 'Stone',
    image: 'materials/stone.png',
    color: '#9B8E85',
    size:  100,
  },
  {
    id:    'sand',
    label: 'Sand',
    image: 'materials/sand.png',
    color: '#D4B483',
    size:  100,
  },
];

/**
 * Look up a material by id. Returns null if not found.
 * @param {string} id
 * @returns {Object|null}
 */
export function getMaterial(id) {
  return MATERIALS.find((m) => m.id === id) ?? null;
}
