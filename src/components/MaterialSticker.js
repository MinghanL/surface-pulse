import { getMaterial } from '../data/materials.js';

export class MaterialSticker {
  constructor(materialId, x, y) {
    this.materialId = materialId;
    this.x = x;
    this.y = y;

    const mat = getMaterial(materialId);
    this.size = mat?.size ?? 100;
    this._mat = mat;
    this._editMode = false;

    this.el = this._createElement();
    this._bindDrag();
  }

  _createElement() {
    const mat = this._mat;
    const el = document.createElement('div');
    el.className = `material-sticker ${mat.cssClass}`;
    el.dataset.materialId = this.materialId;
    el.style.width  = `${this.size}px`;
    el.style.height = `${this.size}px`;
    el.style.left   = `${this.x - this.size / 2}px`;
    el.style.top    = `${this.y - this.size / 2}px`;
    el.innerHTML = `
      <span class="sticker-icon">${mat.icon}</span>
      <span class="sticker-label">${mat.label}</span>
      <button class="sticker-delete" aria-label="Remove">✕</button>
    `;
    el.querySelector('.sticker-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      this.destroy();
    });
    return el;
  }

  // ─── Edit mode ────────────────────────────────────────────────────────────

  setEditMode(active) {
    this._editMode = active;
    this.el.classList.toggle('edit-mode', active);
  }

  // ─── Drag + pinch ─────────────────────────────────────────────────────────

  _bindDrag() {
    const el = this.el;

    // Shared drag state
    let dragStartX, dragStartY, dragOrigLeft, dragOrigTop;

    // Touch state machine: 'idle' | 'drag' | 'pinch'
    let touchState = 'idle';
    let pinchStartDist = 0;
    let pinchStartSize = 0;

    const touchDist = (t1, t2) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    // ── Touch events (handles both drag and pinch) ─────────────────────────

    el.addEventListener('touchstart', (e) => {
      if (!this._editMode) return;
      if (e.target.classList.contains('sticker-delete')) return;
      e.preventDefault();
      e.stopPropagation();

      const tt = e.targetTouches;

      if (tt.length >= 2) {
        // Two fingers → pinch mode
        touchState = 'pinch';
        el.classList.remove('dragging');
        el.style.zIndex = 100;
        pinchStartDist = touchDist(tt[0], tt[1]);
        pinchStartSize = this.size;
      } else if (tt.length === 1 && touchState === 'idle') {
        // One finger → drag mode
        touchState = 'drag';
        dragStartX   = tt[0].clientX;
        dragStartY   = tt[0].clientY;
        dragOrigLeft = parseInt(el.style.left, 10);
        dragOrigTop  = parseInt(el.style.top,  10);
        el.classList.add('dragging');
        el.style.zIndex = 100;
      }
    }, { passive: false });

    el.addEventListener('touchmove', (e) => {
      if (!this._editMode) return;
      e.preventDefault();
      e.stopPropagation();

      const tt = e.targetTouches;

      if (tt.length >= 2) {
        // If a second finger joined mid-drag, switch to pinch
        if (touchState !== 'pinch') {
          touchState = 'pinch';
          el.classList.remove('dragging');
          pinchStartDist = touchDist(tt[0], tt[1]);
          pinchStartSize = this.size;
        }
        const newDist = touchDist(tt[0], tt[1]);
        this._applyPinchScale(newDist / pinchStartDist, pinchStartSize);
      } else if (tt.length === 1 && touchState === 'drag') {
        const dx = tt[0].clientX - dragStartX;
        const dy = tt[0].clientY - dragStartY;
        this._setPos(dragOrigLeft + dx, dragOrigTop + dy);
      }
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      if (!this._editMode) return;
      const tt = e.targetTouches;
      if (tt.length === 0) {
        touchState = 'idle';
        el.classList.remove('dragging');
        el.style.zIndex = '';
      } else if (tt.length === 1 && touchState === 'pinch') {
        // One finger remains after pinch — stop, don't resume drag
        touchState = 'idle';
      }
    });

    // ── Pointer events (mouse only) ────────────────────────────────────────

    el.addEventListener('pointerdown', (e) => {
      if (!this._editMode) return;
      if (e.target.classList.contains('sticker-delete')) return;
      if (e.pointerType === 'touch') return; // handled by touch events above
      e.preventDefault();

      dragStartX   = e.clientX;
      dragStartY   = e.clientY;
      dragOrigLeft = parseInt(el.style.left, 10);
      dragOrigTop  = parseInt(el.style.top,  10);
      el.classList.add('dragging');
      el.style.zIndex = 100;

      const onMove = (ev) => {
        this._setPos(
          dragOrigLeft + (ev.clientX - dragStartX),
          dragOrigTop  + (ev.clientY - dragStartY),
        );
      };
      const onUp = () => {
        el.classList.remove('dragging');
        el.style.zIndex = '';
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup',   onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup',   onUp);
    });
  }

  // ─── Resize helpers ───────────────────────────────────────────────────────

  _applyPinchScale(scale, baseSize) {
    const canvasEl  = document.getElementById('canvas');
    const cr        = canvasEl.getBoundingClientRect();
    const minSize   = this._mat?.size ?? 60;
    const maxSize   = Math.min(cr.width, cr.height) / 2;
    const newSize   = Math.min(maxSize, Math.max(minSize, baseSize * scale));
    this._resize(newSize);
  }

  _resize(newSize) {
    this.size = newSize;
    this.el.style.width  = `${newSize}px`;
    this.el.style.height = `${newSize}px`;
    // Keep center position fixed
    this.el.style.left   = `${this.x - newSize / 2}px`;
    this.el.style.top    = `${this.y - newSize / 2}px`;
    // Scale icon and label proportionally (baseline: 100px sticker)
    const ratio = newSize / 100;
    const icon  = this.el.querySelector('.sticker-icon');
    const label = this.el.querySelector('.sticker-label');
    if (icon)  icon.style.fontSize  = `${Math.round(28 * ratio)}px`;
    if (label) label.style.fontSize = `${Math.max(8, Math.round(11 * ratio))}px`;
  }

  // ─── Position ─────────────────────────────────────────────────────────────

  _setPos(left, top) {
    this.x = left + this.size / 2;
    this.y = top  + this.size / 2;
    this.el.style.left = `${left}px`;
    this.el.style.top  = `${top}px`;
  }

  // ─── Touch highlight ──────────────────────────────────────────────────────

  setActiveTouchStyle(active) {
    this.el.classList.toggle('active-touch', active);
  }

  // ─── Destroy ──────────────────────────────────────────────────────────────

  destroy() {
    this.el.dispatchEvent(new CustomEvent('sticker:remove', {
      bubbles: true,
      detail: { sticker: this },
    }));
    this.el.remove();
  }
}
