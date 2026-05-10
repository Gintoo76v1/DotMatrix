// ── Segmented button group wiring ──────────────────────────────────────────

export function wireSegmented(containerId, state, stateKey, attrKey, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.dataset[attrKey]) return;
    container.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state[stateKey] = btn.dataset[attrKey];
    if (onChange) onChange();
  });
}

/** Programmatically activate the button matching `value`. */
export function setSegmentedValue(containerId, attrKey, value) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset[attrKey] === value);
  });
}
