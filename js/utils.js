// ── Pseudo-random number generator ──────────────────────────────────────────
// Mulberry32 — fast 32-bit PRNG with excellent uniform distribution.
// Outputs are in [0, 1).
export function mulberry32(seed) {
  let t = seed >>> 0 || 1; // avoid pathological all-zero state
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Gaussian sampler (Box–Muller with cache) ────────────────────────────────
// Box–Muller produces two independent standard normals per evaluation.
// We cache the second value to halve the cost on subsequent calls (M2).
//
// Returns a function whose output is N(0, 1). Pass any uniform RNG.
export function makeGaussian(rng) {
  let cached = null;
  return function gaussian() {
    if (cached !== null) {
      const v = cached;
      cached = null;
      return v;
    }
    let u, v;
    // rng() ∈ [0, 1); guarantee strictly positive u for log
    do {
      u = rng();
    } while (u <= 1e-12);
    v = rng();
    const mag = Math.sqrt(-2 * Math.log(u));
    const ang = 2 * Math.PI * v;
    cached = mag * Math.sin(ang);
    return mag * Math.cos(ang);
  };
}

// ── Legacy single-shot gaussian — kept for back-compat with existing imports.
// Discards half the work but matches the original signature/distribution.
export function gaussian(rng) {
  let u = 0,
    v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Cooperative scheduling — yield to the event loop / UA paint queue ──────
export function yieldUI() {
  return new Promise((r) => setTimeout(r, 0));
}

// ── Smooth interpolation primitive (used by improved value-noise) ──────────
// Hermite smoothstep: 3t² − 2t³. Range [0,1] → [0,1] with C¹ continuity.
export function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

// ── Numeric clamp helper ─────────────────────────────────────────────────────
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
