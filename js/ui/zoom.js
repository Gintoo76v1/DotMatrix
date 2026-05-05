// ── Pan & zoom — pointer-event based, multi-touch aware ─────────────────────
// Uses CSS transforms; the canvas itself isn't re-rendered on zoom.
//
// Transform-origin is 0 0 (top-left), so the math is:
//   screen = image_coord * zoom + pan
// This makes the anchor formula straightforward:
//   pan = pinchCenter - image_coord_at_pinch * zoom
//
// Pinch zoom uses the initial gesture state as reference frame so the anchor
// stays stable even with low-pass smoothing on the zoom value.

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5.0;
const PINCH_SMOOTHING = 0.15;   // 0 = instant, 1 = no zoom; 0.15 reads as crisp
const MOMENTUM_DECAY = 0.92;    // velocity multiplier per frame (60 fps)
const MOMENTUM_CUTOFF = 0.5;    // stop when |velocity| < this (px/frame)

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
  let initialPinchPanX = 0, initialPinchPanY = 0;
  let initialPinchCX = 0, initialPinchCY = 0;

  let needsUpdate = false;
  let animating = false;
  let velocityX = 0, velocityY = 0;
  let wheelAccumX = 0, wheelAccumY = 0;

  function update(smooth = false) {
    zoomContainer.style.transition = smooth ? 'transform 0.2s ease-out' : 'none';
    zoomContainer.style.transform  = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    if (zoomLevelText) zoomLevelText.textContent = `${Math.round(zoom * 100)}%`;
  }

  function renderLoop() {
    let active = false;

    // Apply any pending gesture update (synced to display refresh)
    if (needsUpdate) {
      update(false);
      needsUpdate = false;
      active = true;
    }

    // Apply momentum ONLY when no active pointers (gesture ended)
    if (pointers.length === 0 &&
        (Math.abs(velocityX) > MOMENTUM_CUTOFF || Math.abs(velocityY) > MOMENTUM_CUTOFF)) {
      panX += velocityX;
      panY += velocityY;
      velocityX *= MOMENTUM_DECAY;
      velocityY *= MOMENTUM_DECAY;
      update(false);
      active = true;
    }

    if (active) {
      animating = true;
      requestAnimationFrame(renderLoop);
    } else {
      animating = false;
    }
  }

  function scheduleUpdate() {
    needsUpdate = true;
    if (!animating) {
      animating = true;
      requestAnimationFrame(renderLoop);
    }
  }

  // ── Pointer down ───────────────────────────────────────────────────────────
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
      velocityX = 0;
      velocityY = 0;
    } else if (pointers.length === 2) {
      initialDist = Math.hypot(
        pointers[0].clientX - pointers[1].clientX,
        pointers[0].clientY - pointers[1].clientY
      );
      initialZoom = zoom;
      initialPinchPanX = panX;
      initialPinchPanY = panY;
      initialPinchCX = (pointers[0].clientX + pointers[1].clientX) / 2;
      initialPinchCY = (pointers[0].clientY + pointers[1].clientY) / 2;
      lastCenterX = initialPinchCX;
      lastCenterY = initialPinchCY;
    }
  });

  // ── Pointer move ───────────────────────────────────────────────────────────
  canvasWrapper.addEventListener('pointermove', (e) => {
    const idx = pointers.findIndex(p => p.pointerId === e.pointerId);
    if (idx === -1) return;
    pointers[idx] = e;
    dragState.hasDragged = true;

    if (pointers.length === 1) {
      const dx = pointers[0].clientX - lastCenterX;
      const dy = pointers[0].clientY - lastCenterY;
      panX += dx;
      panY += dy;
      velocityX = dx;
      velocityY = dy;
      lastCenterX = pointers[0].clientX;
      lastCenterY = pointers[0].clientY;
      scheduleUpdate();

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

      // Anchor formula (origin at 0,0):
      //   pan = pinchCenter - imageCoordAtPinchStart * currentZoom
      // where imageCoordAtPinchStart = (pinchCenterStart - panStart) / zoomStart
      panX = cx - zoom * (initialPinchCX - initialPinchPanX) / initialZoom;
      panY = cy - zoom * (initialPinchCY - initialPinchPanY) / initialZoom;

      lastCenterX = cx;
      lastCenterY = cy;
      scheduleUpdate();
    }
  });

  // ── Pointer up ────────────────────────────────────────────────────────────
  const pointerUp = (e) => {
    pointers = pointers.filter(p => p.pointerId !== e.pointerId);
    if (pointers.length === 1) {
      lastCenterX = pointers[0].clientX;
      lastCenterY = pointers[0].clientY;
    } else if (pointers.length === 0) {
      try { canvasWrapper.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
      // Keep hasDragged true briefly so the click handler ignores this gesture.
      setTimeout(() => { dragState.hasDragged = false; }, 50);
      scheduleUpdate(); // kick off momentum if velocity > cutoff
    }
  };
  canvasWrapper.addEventListener('pointerup', pointerUp);
  canvasWrapper.addEventListener('pointercancel', pointerUp);

  // ── Wheel (zoom around mouse cursor) ─────────────────────────────────────
  canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom around mouse position
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));

      // Anchor: point under mouse stays stationary
      //   screen = image * zoom + pan
      //   image = (screen - pan) / zoom
      //   newPan = screen - image * newZoom = screen - (screen - pan) / zoom * newZoom
      panX = mouseX - (mouseX - panX) * (newZoom / zoom);
      panY = mouseY - (mouseY - panY) * (newZoom / zoom);
      zoom = newZoom;

    } else {
      // Pan
      panX -= e.deltaX;
      panY -= e.deltaY;
      velocityX = -e.deltaX;
      velocityY = -e.deltaY;
    }
    scheduleUpdate();
  }, { passive: false });

  // ── Button zoom (smooth, around center of viewport) ────────────────────────
  if (zoomInBtn)  zoomInBtn .addEventListener('click', () => {
    const rect = canvasWrapper.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const newZoom = Math.min(ZOOM_MAX, zoom + 0.25);
    panX = cx - (cx - panX) * (newZoom / zoom);
    panY = cy - (cy - panY) * (newZoom / zoom);
    zoom = newZoom;
    update(true);
  });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
    const rect = canvasWrapper.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const newZoom = Math.max(ZOOM_MIN, zoom - 0.25);
    panX = cx - (cx - panX) * (newZoom / zoom);
    panY = cy - (cy - panY) * (newZoom / zoom);
    zoom = newZoom;
    update(true);
  });
}
