// ── Math-Mode helper ────────────────────────────────────────────────────────
// Centralised toggle that determines whether the v1-compatible
// (legacy) math is used or the corrected/optimised v2 path.
//
// Each consumer pulls a single object instead of sprinkling
// `if (state.legacyMath)` checks across the hot loop.

/**
 * @param {Object} state
 * @returns {{
 *   grayscale:        'rgb' | 'luma',
 *   floydSteinberg:   'classic' | 'serpentine',
 *   rowBands:         'asymmetric' | 'symmetric',
 *   ghosting:         'pinRow' | 'sweep',
 *   paperSlip:        'stepScaled' | 'gridPx',
 *   valueNoise:       'bilinear' | 'smoothstep',
 *   useFloydThreshold:boolean
 * }}
 */
export function getMathMode(state) {
  const legacy = !!(state && state.legacyMath);
  return {
    grayscale: legacy ? 'rgb' : 'luma',
    floydSteinberg: legacy ? 'classic' : 'serpentine',
    rowBands: legacy ? 'asymmetric' : 'symmetric',
    ghosting: legacy ? 'pinRow' : 'sweep',
    paperSlip: legacy ? 'stepScaled' : 'gridPx',
    valueNoise: legacy ? 'bilinear' : 'smoothstep',
    useFloydThreshold: !legacy,
  };
}
