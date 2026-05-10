// ── Pan & zoom — pointer-event based, multi-touch aware ─────────────────────
// Uses CSS transforms; the canvas itself isn't re-rendered on zoom.

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 10.0;
const PINCH_SMOOTHING = 0.4; // Increased for more responsive feel
const MOMENTUM_DECAY = 0.9; // Slightly stronger decay for natural feel
const MOMENTUM_CUTOFF = 0.1;

export const dragState = { hasDragged: false };

export function initZoom() {
  const zoomContainer = document.getElementById('zoomContainer');
  const canvasWrapper = document.getElementById('canvasWrapper');
  const zoomLevelText = document.getElementById('zoomLevel');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  if (!zoomContainer || !canvasWrapper) return;

  let zoom = 1,
    panX = 0,
    panY = 0;
  let pointers = [];
  let initialDist = 0,
    initialZoom = 1;
  let initialPinchPanX = 0,
    initialPinchPanY = 0;
  let initialPinchLocalCX = 0,
    initialPinchLocalCY = 0;
  let lastLocalCX = 0,
    lastLocalCY = 0;

  let needsUpdate = false;
  let animating = false;
  let velocityX = 0,
    velocityY = 0;

  function update(smooth = false) {
    zoomContainer.style.transition = smooth ? 'transform 0.2s ease-out' : 'none';
    zoomContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    if (zoomLevelText) zoomLevelText.textContent = `${Math.round(zoom * 100)}%`;
  }

  function renderLoop() {
    let active = false;

    if (needsUpdate) {
      update(false);
      needsUpdate = false;
      active = true;
    }

    // Only apply momentum when gesture ended
    if (
      pointers.length === 0 &&
      (Math.abs(velocityX) > MOMENTUM_CUTOFF || Math.abs(velocityY) > MOMENTUM_CUTOFF)
    ) {
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

  canvasWrapper.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const rect = canvasWrapper.getBoundingClientRect();
    dragState.hasDragged = false;

    const idx = pointers.findIndex((p) => p.pointerId === e.pointerId);
    if (idx !== -1) pointers[idx] = e;
    else pointers.push(e);

    canvasWrapper.setPointerCapture(e.pointerId);

    if (pointers.length === 1) {
      lastLocalCX = pointers[0].clientX - rect.left;
      lastLocalCY = pointers[0].clientY - rect.top;
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
      initialPinchLocalCX = (pointers[0].clientX + pointers[1].clientX) / 2 - rect.left;
      initialPinchLocalCY = (pointers[0].clientY + pointers[1].clientY) / 2 - rect.top;
      lastLocalCX = initialPinchLocalCX;
      lastLocalCY = initialPinchLocalCY;
    }
  });

  canvasWrapper.addEventListener('pointermove', (e) => {
    const idx = pointers.findIndex((p) => p.pointerId === e.pointerId);
    if (idx === -1) return;
    pointers[idx] = e;
    const rect = canvasWrapper.getBoundingClientRect();
    dragState.hasDragged = true;

    if (pointers.length === 1) {
      const lx = pointers[0].clientX - rect.left;
      const ly = pointers[0].clientY - rect.top;
      const dx = lx - lastLocalCX;
      const dy = ly - lastLocalCY;
      panX += dx;
      panY += dy;
      velocityX = dx;
      velocityY = dy;
      lastLocalCX = lx;
      lastLocalCY = ly;
      scheduleUpdate();
    } else if (pointers.length === 2 && initialDist > 0) {
      const currentDist = Math.hypot(
        pointers[0].clientX - pointers[1].clientX,
        pointers[0].clientY - pointers[1].clientY
      );
      const targetZoom = initialZoom * (currentDist / initialDist);
      zoom += (targetZoom - zoom) * PINCH_SMOOTHING;
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));

      const cx = (pointers[0].clientX + pointers[1].clientX) / 2 - rect.left;
      const cy = (pointers[0].clientY + pointers[1].clientY) / 2 - rect.top;

      panX = cx - (zoom * (initialPinchLocalCX - initialPinchPanX)) / initialZoom;
      panY = cy - (zoom * (initialPinchLocalCY - initialPinchPanY)) / initialZoom;

      velocityX = cx - lastLocalCX;
      velocityY = cy - lastLocalCY;
      lastLocalCX = cx;
      lastLocalCY = cy;
      scheduleUpdate();
    }
  });

  const pointerUp = (e) => {
    pointers = pointers.filter((p) => p.pointerId !== e.pointerId);
    if (pointers.length === 1) {
      const rect = canvasWrapper.getBoundingClientRect();
      lastLocalCX = pointers[0].clientX - rect.left;
      lastLocalCY = pointers[0].clientY - rect.top;
    } else if (pointers.length === 0) {
      try {
        canvasWrapper.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore errors if pointer capture was already lost
      }
      setTimeout(() => {
        dragState.hasDragged = false;
      }, 50);
      scheduleUpdate();
    }
  };
  canvasWrapper.addEventListener('pointerup', pointerUp);
  canvasWrapper.addEventListener('pointercancel', pointerUp);

  canvasWrapper.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = canvasWrapper.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
        panX = lx - (lx - panX) * (newZoom / zoom);
        panY = ly - (ly - panY) * (newZoom / zoom);
        zoom = newZoom;
      } else {
        panX -= e.deltaX;
        panY -= e.deltaY;
        velocityX = -e.deltaX * 0.5;
        velocityY = -e.deltaY * 0.5;
      }
      scheduleUpdate();
    },
    { passive: false }
  );

  const buttonZoom = (delta) => {
    const rect = canvasWrapper.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
    panX = cx - (cx - panX) * (newZoom / zoom);
    panY = cy - (cy - panY) * (newZoom / zoom);
    zoom = newZoom;
    update(true);
  };

  if (zoomInBtn) zoomInBtn.addEventListener('click', () => buttonZoom(0.25));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => buttonZoom(-0.25));
}
