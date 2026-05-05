// ── Hardware-failure (wear-layer) UI ────────────────────────────────────────

function collectActiveLayers() {
  const out = [];
  document.querySelectorAll('#errorList .er.on').forEach(el => {
    const slider = el.querySelector('.er-slider');
    out.push({
      pattern: el.dataset.pattern,
      strength: slider ? +slider.value : 50,
    });
  });
  return out;
}

export function initWearLayers(state, onChange) {
  document.querySelectorAll('#errorList .er').forEach(er => {
    const head   = er.querySelector('.er-head');
    const slider = er.querySelector('.er-slider');
    const valEl  = er.querySelector('.er-val');

    if (head) {
      head.addEventListener('click', () => {
        er.classList.toggle('on');
        if (valEl && slider) {
          valEl.textContent = er.classList.contains('on') ? slider.value + '%' : '0%';
        }
        state.wearLayers = collectActiveLayers();
        if (onChange) onChange();
      });
    }
    if (slider) {
      slider.addEventListener('input', (e) => {
        if (valEl) valEl.textContent = e.target.value + '%';
        state.wearLayers = collectActiveLayers();
        if (onChange) onChange();
      });
    }
  });
}

/** Sync the DOM checkboxes/sliders to a state.wearLayers array. */
export function applyWearLayersToUI(state) {
  document.querySelectorAll('#errorList .er').forEach(el => {
    el.classList.remove('on');
    const valEl = el.querySelector('.er-val');
    if (valEl) valEl.textContent = '0%';
  });
  for (const layer of state.wearLayers || []) {
    const el = document.querySelector(`#errorList .er[data-pattern="${layer.pattern}"]`);
    if (!el) continue;
    el.classList.add('on');
    const s = el.querySelector('.er-slider');
    const v = el.querySelector('.er-val');
    const val = layer.strength ?? 50;
    if (s) s.value = val;
    if (v) v.textContent = val + '%';
  }
}
