// ── Pan & zoom — pointer-event based, multi-touch aware ─────────────────────
// Uses CSS transforms; the canvas itself isn't re-rendered on zoom.
//
// Pinch zoom is filtered with a one-pole low-pass to suppress finger micro-
// jitter ("wobble") which would otherwise produce a juddery zoom feel.

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5.0;
const PINCH_SMOOTHING = 0.15;   // 0 = instant, 1 = no zoom; 0.15 reads as crisp

export const dragState = { hasDragged: false };

export function initZoom() {
  const zoomContainer = document.getElementById('zoomContainer');
  const canvasWrapper = document.getElementById('canvasWrapper');
  const zoomLevelText = document.getElementById('zoomLevel');
  const zoomInBtn  = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  if (!zoomContainer || !canvasWrapper) return;

  let zoom = 1, panX = 0, panY = 0;
  let pointers = [];
  let initialDist = 0, initialZoom = 1;
  let lastCenterX = 0, lastCenterY = 0;

  function update(smooth = false) {
    zoomContainer.style.transition = smooth ? 'transform 0.2s ease-out' : 'none';
    zoomContainer.style.transform  = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    if (zoomLevelText) zoomLevelText.textContent = `${Math.round(zoom * 100)}%`;
  }

  canvasWrapper.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragState.hasDragged = false;

    const idx = pointers.findIndex(p => p.pointerId === e.pointerId);
    if (idx !== -1) pointers[idx] = e;
    else pointers.push(e);

    canvasWrapper.setPointerCapture(e.pointerId);

    if (pointers.length === 1) {
      lastCenterX = pointers[0].clientX;
      lastCenterY = pointers[0].clientY;
    } else if (pointers.length === 2) {
      initialDist = Math.hypot(
        pointers[0].clientX - pointers[1].clientX,
        pointers[0].clientY - pointers[1].clientY
      );
      initialZoom = zoom;
      lastCenterX = (pointers[0].clientX + pointers[1].clientX) / 2;
      lastCenterY = (pointers[0].clientY + pointers[1].clientY) / 2;
    }
  });

  canvasWrapper.addEventListener('pointermove', (e) => {
    const idx = pointers.findIndex(p => p.pointerId === e.pointerId);
    if (idx === -1) return;
    pointers[idx] = e;
    dragState.hasDragged = true;

    if (pointers.length === 1) {
      panX += pointers[0].clientX - lastCenterX;
      panY += pointers[0].clientY - lastCenterY;
      lastCenterX = pointers[0].clientX;
      lastCenterY = pointers[0].clientY;
      update(false);
    } else if (pointers.length === 2 && initialDist > 0) {
      const currentDist = Math.hypot(
        pointers[0].clientX - pointers[1].clientX,
        pointers[0].clientY - pointers[1].clientY
      );
      const targetZoom = initialZoom * (currentDist / initialDist);
      zoom += (targetZoom - zoom) * PINCH_SMOOTHING;
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));

      const cx = (pointers[0].clientX + pointers[1].clientX) / 2;
      const cy = (pointers[0].clientY + pointers[1].clientY) / 2;
      panX += cx - lastCenterX;
      panY += cy - lastCenterY;
      lastCenterX = cx;
      lastCenterY = cy;
      update(false);
    }
  });

  const pointerUp = (e) => {
    pointers = pointers.filter(p => p.pointerId !== e.pointerId);
    if (pointers.length === 1) {
      lastCenterX = pointers[0].clientX;
      lastCenterY = pointers[0].clientY;
    } else if (pointers.length === 0) {
      try { canvasWrapper.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
      // Keep hasDragged true briefly so the click handler ignores this gesture.
      setTimeout(() => { dragState.hasDragged = false; }, 50);
    }
  };
  canvasWrapper.addEventListener('pointerup', pointerUp);
  canvasWrapper.addEventListener('pointercancel', pointerUp);

  canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + (e.deltaY > 0 ? -0.1 : 0.1)));
    } else {
      panX -= e.deltaX;
      panY -= e.deltaY;
    }
    update(false);
  }, { passive: false });

  if (zoomInBtn)  zoomInBtn .addEventListener('click', () => { zoom = Math.min(ZOOM_MAX, zoom + 0.25); update(true); });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { zoom = Math.max(ZOOM_MIN, zoom - 0.25); update(true); });
}
