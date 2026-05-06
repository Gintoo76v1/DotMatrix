// ── Slider wiring & introspection ──────────────────────────────────────────
//
// Bug B/C in v1: setS('jitterSlider', ...) did `state[id.replace('Slider','')]`
// which produced `state.jitter` instead of `state.jitterScale` — silent state
// corruption.  Likewise, transforms (e.g. the slider value 15 representing
// 1.5) were not inverted when applying a preset, so jitter was 10× off.
//
// We now define an explicit registry that every consumer (preset apply,
// initial mount, programmatic setters) shares.

const REG = new Map();

/**
 * Register a slider.  `transform` maps slider DOM value → state value.
 * `inverse` maps state value → slider DOM value.  `format` produces the
 * human-readable label on the right of the slider.
 */
export function registerSlider(opts) {
  const cfg = {
    sliderId: opts.sliderId,
    valueId: opts.valueId,
    stateKey: opts.stateKey,
    transform: opts.transform || ((v) => +v),
    inverse: opts.inverse || ((v) => v),
    format: opts.format || ((v) => v),
  };
  REG.set(cfg.stateKey, cfg);
  return cfg;
}

export function getSliderConfig(stateKey) {
  return REG.get(stateKey);
}

/**
 * Wire change handler. The state object is mutated in place; on every input
 * the supplied onChange callback fires with the slider's stateKey.
 */
export function wireSlider(state, stateKey, onChange) {
  const cfg = REG.get(stateKey);
  if (!cfg) return;
  const s = document.getElementById(cfg.sliderId);
  const v = document.getElementById(cfg.valueId);
  if (!s || !v) return;

  const apply = () => {
    const raw = cfg.transform(s.value);
    state[stateKey] = raw;
    v.textContent = cfg.format(raw);
    if (onChange) onChange(stateKey);
  };
  s.addEventListener('input', apply);
  // Initialise from current DOM value
  const init = cfg.transform(s.value);
  state[stateKey] = init;
  v.textContent = cfg.format(init);
}

/**
 * Programmatically set a slider from a state value (e.g. when applying a
 * preset). Performs the inverse transform and updates the readout label.
 * Returns true on success, false if any required DOM node is missing.
 */
export function setSliderValue(state, stateKey, value) {
  const cfg = REG.get(stateKey);
  if (!cfg) return false;
  const s = document.getElementById(cfg.sliderId);
  const v = document.getElementById(cfg.valueId);
  if (!s || !v) return false;

  s.value = cfg.inverse(value);
  state[stateKey] = value;
  v.textContent = cfg.format(value);
  return true;
}

/** Synchronise all registered sliders to the current state object. */
export function syncAllFromState(state) {
  for (const [key] of REG) {
    if (key in state) setSliderValue(state, key, state[key]);
  }
}
