// ── Colour swatch wiring (ink + paper) ─────────────────────────────────────

export function wireSwatches(containerId, state, stateKey, attrKey, onChange) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.addEventListener('click', (e) => {
    const sw = e.target.closest('.swatch');
    if (!sw || !sw.dataset[attrKey]) return;
    box.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
    sw.classList.add('active');
    state[stateKey] = sw.dataset[attrKey].split(',').map(Number);
    if (onChange) onChange();
  });
}

export function setSwatchValue(containerId, attrKey, rgb) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const target = rgb.join(',');
  box.querySelectorAll('.swatch').forEach((s) => {
    s.classList.toggle('active', s.dataset[attrKey] === target);
  });
}

export function wireCustomInk(state, onChange) {
  const picker = document.getElementById('inkColorPicker');
  const hexIn = document.getElementById('inkHexInput');
  const swatch = document.getElementById('customInkSwatch');
  const addPicker = document.getElementById('inkColorPickerAdd');
  if (!picker || !hexIn || !swatch) return;

  function apply(hex) {
    const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return;
    const rgb = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    swatch.dataset.ink = rgb.join(',');
    swatch.style.background = '#' + m[1] + m[2] + m[3];
    document.querySelectorAll('#inkSwatches .swatch').forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
    state.ink = rgb;
    if (onChange) onChange();
  }

  picker.addEventListener('input', (e) => {
    hexIn.value = e.target.value;
    apply(e.target.value);
  });
  hexIn.addEventListener('input', (e) => {
    const hex = e.target.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(hex)) {
      picker.value = hex;
      apply(hex);
    }
  });

  // "+" Add-swatch color picker
  if (addPicker) {
    addPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      apply(hex);
      if (picker) picker.value = hex;
      if (hexIn) hexIn.value = hex;
    });
  }
}

export function wireCustomPaper(state, onChange) {
  const addPicker = document.getElementById('paperColorPickerAdd');
  const swatch = document.getElementById('customPaperSwatch');
  if (!swatch) return;

  function apply(hex) {
    const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return;
    const rgb = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    swatch.dataset.paper = rgb.join(',');
    swatch.style.background = '#' + m[1] + m[2] + m[3];
    document
      .querySelectorAll('#paperSwatches .swatch')
      .forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
    state.paper = rgb;
    if (onChange) onChange();
  }

  // "+" Add-swatch color picker
  if (addPicker) {
    addPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      apply(hex);
    });
  }
}
