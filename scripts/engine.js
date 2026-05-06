// ── Render engine ───────────────────────────────────────────────────────────
// Public exports:
//   render(srcImage, onProgressUpdate)  — main pipeline (async, yields to UI)
//   asciiPreview(srcImage, width)       — quick character-grid preview
//   makeDotStamp / stampInto / makeValueNoise — exposed for unit tests
//
// Hot loop sits in render(); per-cell branches are minimised by hoisting
// constants and using branch-free clamps.

import { PROFILES, state, MM_PER_INCH, PAPER_SIZES_MM } from './config.js';
import { mulberry32, makeGaussian, yieldUI, smoothstep, clamp } from './utils.js';
import {
  toGrayscale,
  floydSteinberg,
  orderedDither,
  thresholdDither,
  boxBlur3x3,
} from './filters.js';

// ── Dot stamp ────────────────────────────────────────────────────────────────
//
// Builds a soft-edged disc with optional anisotropy. The legacy code used a
// hard-coded 0.88 scaling on dx² which only matched 9-pin printers with
// dpi_h ≈ 144 / dpi_v ≈ 72.  v2 derives the squashed factor from the actual
// pin geometry; passing `legacy:true` retains the v1 constant.
//
// Stamp values are in [0, density].
/**
 * Generates a soft-edged dot stamp for printer simulation.
 * @param {number} diameterPx - Target diameter in pixels.
 * @param {number} softness - Softness ratio (0 = hard edge, 1 = maximum blur).
 * @param {number} density - Peak opacity/density of the ink.
 * @param {object} opts - Additional options (e.g., legacy mode, DPI info).
 * @returns {{data: Float32Array, size: number}} The generated stamp and its side length.
 */
export function makeDotStamp(diameterPx, softness, density, opts = {}) {
  let size = Math.max(3, Math.round(diameterPx));
  if (size % 2 === 0) size++;
  const cx = (size - 1) / 2;
  const radius = size / 2;
  const inner = radius * (1 - softness);

  // anisotropy = horizontal stretch factor (>1 = wider than tall).
  // dpi_h and dpi_v at the printer determine the expected dot footprint.
  let xScale2;
  if (opts.legacy) {
    xScale2 = 0.88;
  } else if (opts.dpiH && opts.dpiV) {
    const aspect = opts.dpiV / opts.dpiH; // <1 if dpi_h > dpi_v
    xScale2 = aspect * aspect;
  } else {
    xScale2 = 1.0;
  }

  const stamp = new Float32Array(size * size);
  const denom = Math.max(0.01, radius - inner);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx,
        dy = y - cx;
      const r = Math.sqrt(dx * dx * xScale2 + dy * dy);
      let v;
      if (r <= inner) v = 1;
      else v = Math.max(0, 1 - (r - inner) / denom);
      stamp[y * size + x] = v * density;
    }
  }
  return { data: stamp, size };
}

// ── Stamp accumulation ───────────────────────────────────────────────────────
// Adds a stamp into the ink buffer with clamping at 1.0.  Branch-free inner
// loop using Math.min (M4).  Out-of-bounds is detected once on entry; the
// inner loops then run on the clipped intersection only.
/**
 * Composites a single dot stamp onto the main ink plane.
 * @param {Float32Array} ink - The target ink intensity buffer.
 * @param {number} w - The width of the ink buffer.
 * @param {number} h - The height of the ink buffer.
 * @param {Float32Array} stamp - The stamp buffer data.
 * @param {number} ss - The size (width/height) of the stamp.
 * @param {number} x0 - X coordinate for the top-left of the stamp.
 * @param {number} y0 - Y coordinate for the top-left of the stamp.
 * @param {number} band - Multiplier for banding/wear effects.
 */
export function stampInto(ink, w, h, stamp, ss, x0, y0, band) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  const x1 = x0 + ss,
    y1 = y0 + ss;
  if (x1 <= 0 || y1 <= 0 || x0 >= w || y0 >= h) return;
  const sx0 = x0 < 0 ? -x0 : 0;
  const sy0 = y0 < 0 ? -y0 : 0;
  const dx0 = Math.max(0, x0);
  const dy0 = Math.max(0, y0);
  const dx1 = Math.min(w, x1);
  const dy1 = Math.min(h, y1);
  for (let y = dy0; y < dy1; y++) {
    const sy = sy0 + (y - dy0);
    let di = y * w + dx0;
    let si = sy * ss + sx0;
    for (let x = dx0; x < dx1; x++, di++, si++) {
      const v = ink[di] + stamp[si] * band;
      ink[di] = v < 1 ? v : 1;
    }
  }
}

// ── 2D value noise ───────────────────────────────────────────────────────────
// Bilinear interpolation creates linear seams between cells; smoothstep adds
// C¹ continuity for less mechanical-looking cloud patterns. Both modes are
// deterministic when fed the same RNG.
/**
 * Generates a 2D value noise function for simulating non-uniform wear patterns like "cloudy".
 * @param {Function} rng - A uniform random number generator function returning [0, 1).
 * @param {number} noiseW - Grid width of the underlying noise.
 * @param {number} noiseH - Grid height of the underlying noise.
 * @param {object} opts - Interpolation options (e.g. { interp: 'bilinear' }).
 * @returns {Function} A function (x, y, totalW, totalH) -> noise value.
 */
export function makeValueNoise(rng, noiseW, noiseH, opts = {}) {
  const grid = new Float32Array(noiseW * noiseH);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const interp = opts.interp === 'bilinear' ? (t) => t : smoothstep;
  return (x, y, totalW, totalH) => {
    const nx = (x / totalW) * (noiseW - 1);
    const ny = (y / totalH) * (noiseH - 1);
    const x0 = Math.floor(nx),
      x1 = Math.min(x0 + 1, noiseW - 1);
    const y0 = Math.floor(ny),
      y1 = Math.min(y0 + 1, noiseH - 1);
    const fx = interp(nx - x0),
      fy = interp(ny - y0);
    const v00 = grid[y0 * noiseW + x0],
      v10 = grid[y0 * noiseW + x1];
    const v01 = grid[y1 * noiseW + x0],
      v11 = grid[y1 * noiseW + x1];
    return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
  };
}

function _buildMisaligned(ld, rng, gridH) {
  ld.rowOff = new Float32Array(gridH);
  let acc = 0;
  for (let y = 0; y < gridH; y++) {
    acc += (rng() - 0.5) * 1.4;
    acc *= 0.91;
    ld.rowOff[y] = acc;
  }
}

function _buildPinSkip(ld, rng, numPins, str) {
  ld.health = new Float32Array(numPins).fill(1.0);
  for (let p = 0; p < numPins; p++) {
    const roll = rng();
    if (roll < str * 0.22) {
      ld.health[p] = 0; // dead pin
    } else if (roll < str * 0.55) {
      ld.health[p] = Math.max(0.08, 1.0 - str * (0.3 + rng() * 0.5));
    }
  }
}

function _buildSmudge(ld, rng, gridH, str) {
  ld.rows = new Uint8Array(gridH);
  let inSmudge = false;
  for (let y = 0; y < gridH; y++) {
    if (!inSmudge && rng() < 0.04 * str) inSmudge = true;
    else if (inSmudge && rng() < 0.22) inSmudge = false;
    ld.rows[y] = inSmudge ? 1 : 0;
  }
}

function _buildRibbonTwist(ld, rng, gridW, str) {
  ld.col = new Float32Array(gridW).fill(1.0);
  let val = 0.85 + rng() * 0.15;
  for (let x = 0; x < gridW; x++) {
    val += (rng() - 0.5) * 0.06;
    val = clamp(val, 0.25, 1.0);
    ld.col[x] = 1.0 - (1.0 - val) * str;
  }
}

function _buildInkStarved(ld, rng, gridH, str) {
  ld.rowDep = new Float32Array(gridH);
  let dep = 0;
  for (let y = 0; y < gridH; y++) {
    dep = Math.min(1.0, dep + rng() * 0.003 * str);
    ld.rowDep[y] = dep;
  }
}

function _buildPaperSlip(ld, rng, gridH, str, stepY) {
  ld.rowShift = new Float32Array(gridH);
  let slip = 0;
  const scale = 4;
  for (let y = 0; y < gridH; y++) {
    if (rng() < 0.04 * str) slip += (rng() - 0.5) * scale * str;
    slip *= 0.85;
    ld.rowShift[y] = slip;
  }
}

// ── Layer pre-computation ───────────────────────────────────────────────────
// Each wear pattern caches whatever it can compute up-front (row/column
// LUTs, RNG-derived constants).  Per-cell work in the hot loop is then
// limited to a switch and a few arithmetic ops.
function buildLayerData(layer, rng, gridW, gridH, numPins, stepY) {
  const str = (layer.strength ?? 50) / 100;
  const ld = { pattern: layer.pattern, strength: str };

  switch (layer.pattern) {
    case 'cloudy': {
      ld.noise = makeValueNoise(rng, 16, 16, {
        interp: 'smoothstep',
      });
      break;
    }
    case 'misaligned': {
      _buildMisaligned(ld, rng, gridH);
      break;
    }
    case 'pin_skip': {
      _buildPinSkip(ld, rng, numPins, str);
      break;
    }
    case 'smudge': {
      _buildSmudge(ld, rng, gridH, str);
      break;
    }
    case 'ribbon_twist': {
      _buildRibbonTwist(ld, rng, gridW, str);
      break;
    }
    case 'ink_starved': {
      _buildInkStarved(ld, rng, gridH, str);
      break;
    }
    case 'paper_slip': {
      _buildPaperSlip(ld, rng, gridH, str, stepY);
      break;
    }
    case 'mechanical_resonance': {
      ld.freq = 0.08 + rng() * 0.06;
      ld.amp = 1.0;
      ld.phase = rng() * Math.PI * 2; // Bug V — stable per render
      break;
    }
    case 'double_feed': {
      ld.offX = Math.round((3 + rng() * 5) * (rng() < 0.5 ? 1 : -1));
      ld.offY = Math.round(2 + rng() * 4);
      break;
    }
    case 'ghosting':
    case 'head_gap':
    case 'static_noise':
      break; // computed per-cell only
  }
  return ld;
}

// ── Pin offsets per pass ────────────────────────────────────────────────────
// Each carriage pass has its own micro-misalignment; without this the
// "double strike" mode just stacked identical dots.  (Bug Q)
function buildPinOffsets(numPins, pinTolPx, rng) {
  const xOff = new Float32Array(numPins);
  const yOff = new Float32Array(numPins);
  for (let p = 0; p < numPins; p++) {
    yOff[p] = (rng() - 0.5) * 2 * pinTolPx;
    xOff[p] = (rng() - 0.5) * pinTolPx * 0.35;
  }
  return { xOff, yOff };
}

// ── Canvas factory ───────────────────────────────────────────────────────────
// Render is host-agnostic; either pass an explicit `createCanvas(w,h)` factory
// (worker context — uses OffscreenCanvas) or rely on the default DOM factory.
function defaultCreateCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ── Main render ──────────────────────────────────────────────────────────────
/**
 * Renders the dot-matrix effect onto the given image.
 * @param {HTMLImageElement|ImageBitmap} srcImage - The source image to process.
 * @param {Function} onProgressUpdate - Callback for progress reporting.
 * @param {object} opts - Additional options (e.g. custom canvas factory).
 * @returns {Promise<{imageData: ImageData, width: number, height: number}>} The processed image data.
 */
export async function render(srcImage, onProgressUpdate, opts = {}) {
  const createCanvas = opts.createCanvas || defaultCreateCanvas;
  const profile = PROFILES[state.profile];
  const seed = state.seed || Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);
  const gauss = makeGaussian(rng);
  const srcAspect = srcImage.width / srcImage.height;

  const condensedMult = state.condensed && profile.supports_condensed ? 1.5 : 1.0;
  const dpiH = profile.dpi_h * condensedMult;
  const dpiV = profile.dpi_v;

  let outW, outH, gridW, gridH, offsetX, offsetY, stepX, stepY, effDpi;

  if (state.paperFormat === 'Original') {
    outW = srcImage.width;
    outH = srcImage.height;
    const longEdge = Math.max(outW, outH);
    if (longEdge > state.maxSize) {
      const scale = state.maxSize / longEdge;
      outW = Math.round(outW * scale);
      outH = Math.round(outH * scale);
    }
    gridW = Math.max(1, Math.round((outW / state.dpi) * dpiH));
    gridH = Math.max(1, Math.round((outH / state.dpi) * dpiV));
    effDpi = state.dpi;
    offsetX = 0;
    offsetY = 0;
    stepX = outW / gridW;
    stepY = outH / gridH;
  } else {
    let paperW, paperH;
    if (state.paperFormat === 'Fit') {
      paperH = 297;
      paperW = paperH * srcAspect;
    } else {
      const size = PAPER_SIZES_MM[state.paperFormat];
      if (state.orientation === 'Landscape') {
        paperW = size[1];
        paperH = size[0];
      } else {
        paperW = size[0];
        paperH = size[1];
      }
    }
    const marginMm = 10;
    const printableW = Math.max(1, paperW - 2 * marginMm);
    const printableH = Math.max(1, paperH - 2 * marginMm);
    const maxGridW = Math.round((printableW / MM_PER_INCH) * dpiH);
    const maxGridH = Math.round((printableH / MM_PER_INCH) * dpiV);
    const targetGridAspect = srcAspect * (dpiH / dpiV);
    if (maxGridW / maxGridH > targetGridAspect) {
      gridH = maxGridH;
      gridW = Math.round(gridH * targetGridAspect);
    } else {
      gridW = maxGridW;
      gridH = Math.round(gridW / targetGridAspect);
    }
    outW = Math.round((paperW / MM_PER_INCH) * state.dpi);
    outH = Math.round((paperH / MM_PER_INCH) * state.dpi);
    const longEdge = Math.max(outW, outH);
    if (longEdge > state.maxSize) {
      const scale = state.maxSize / longEdge;
      outW = Math.round(outW * scale);
      outH = Math.round(outH * scale);
    }
    effDpi = outW / (paperW / MM_PER_INCH);
    const printPxW = (gridW / dpiH) * effDpi;
    const printPxH = (gridH / dpiV) * effDpi;
    offsetX = Math.round((outW - printPxW) / 2);
    offsetY = Math.round((outH - printPxH) / 2);
    stepX = effDpi / dpiH;
    stepY = effDpi / dpiV;
  }

  // Source image → grid resolution → grayscale
  const gridCanvas = createCanvas(gridW, gridH);
  const gctx = gridCanvas.getContext('2d');
  gctx.fillStyle = '#fff';
  gctx.fillRect(0, 0, gridW, gridH);
  gctx.drawImage(srcImage, 0, 0, gridW, gridH);
  const gridData = gctx.getImageData(0, 0, gridW, gridH);
  const gray = toGrayscale(gridData, state);

  // Halftone / dither
  let dots;
  if (state.dither === 'floyd_steinberg')
    dots = floydSteinberg(gray, gridW, gridH, state.threshold);
  else if (state.dither === 'ordered') dots = orderedDither(gray, gridW, gridH);
  else dots = thresholdDither(gray, gridW, gridH, state.threshold);

  // Allocate output ink plane
  const ink = new Float32Array(outW * outH);
  // Bug R — keep dot diameter ≥3 (matches makeDotStamp's own minimum)
  const dotPx = Math.max(3, Math.round((profile.dot_diameter_mm / MM_PER_INCH) * effDpi));
  const baseStamp = makeDotStamp(
    dotPx,
    profile.dot_softness,
    profile.ink_density,
    { dpiH, dpiV }
  );
  const stamp = baseStamp.data;
  const stampSize = baseStamp.size;
  const stampR = (stampSize - 1) / 2;

  const passes = Math.min(3, profile.passes * (state.doubleStrike ? 2 : 1));
  const jitterPx = ((profile.jitter_mm * state.jitterScale) / MM_PER_INCH) * effDpi;
  const bandAmp = profile.banding * state.bandingScale;

  // Per-pin geometry: each pin has a fixed mechanical tolerance offset
  // plus a density modulation (centre pins print harder than edge pins).
  const numPins = profile.pins;
  const pinDensMod = new Float32Array(numPins);
  const pinTolPx = Math.max(0.5, ((profile.jitter_mm * 0.5) / MM_PER_INCH) * effDpi);
  for (let p = 0; p < numPins; p++) {
    const norm = (p - (numPins - 1) / 2) / Math.max(1, (numPins - 1) / 2);
    pinDensMod[p] = 1.0 - 0.14 * norm * norm;
  }

  // Per-pass pin offsets — each pass gets its own jitter (Bug Q)
  const passPinOffsets = [];
  for (let p = 0; p < passes; p++) passPinOffsets.push(buildPinOffsets(numPins, pinTolPx, rng));

  // Active wear layers
  const wearLayers = Array.isArray(state.wearLayers) ? state.wearLayers : [];
  const layerData = wearLayers
    .filter((l) => l && l.pattern && l.pattern !== 'none' && (l.strength ?? 0) > 0)
    .map((l) => buildLayerData(l, rng, gridW, gridH, numPins, stepY));

  // Row banding LUT — symmetric (mean ≈ 1) in v2.
  const rowBands = new Float32Array(gridH);
  for (let y = 0; y < gridH; y++) rowBands[y] = 1 + bandAmp * (rng() - 0.5) * 2;

  // Sweep height for ghosting (≈ one carriage pass = numPins * stepY).
  const sweepRows = Math.max(1, Math.round(numPins));

  // Compact list of "on" cells. Int32Array (M6) — 2 ints per cell.
  let onCount = 0;
  for (let i = 0; i < dots.length; i++) if (dots[i]) onCount++;
  const onCells = new Int32Array(onCount * 2);
  {
    let k = 0;
    for (let y = 0; y < gridH; y++) {
      const row = y * gridW;
      for (let x = 0; x < gridW; x++) {
        if (dots[row + x]) {
          onCells[k++] = x;
          onCells[k++] = y;
        }
      }
    }
  }

  // Hot-loop constants (M9)
  const dpiNorm160 = effDpi / 160;
  const dpiNorm300 = effDpi / 300;
  const ribbonFadeAmt = profile.ribbon_fade ?? 0.09;
  const invMaxGx = 1 / Math.max(1, gridW - 1);
  const invGridW = 1 / Math.max(1, gridW);

  let processed = 0;
  const total = onCount * passes;
  await yieldUI();

  for (let p = 0; p < passes; p++) {
    const passJitter = jitterPx * (1 + 0.3 * p);
    const { xOff: pinXOff, yOff: pinYOff } = passPinOffsets[p];

    for (let idx = 0; idx < onCount; idx++) {
      const gx = onCells[idx * 2];
      const gy = onCells[idx * 2 + 1];
      const pinIdx = gy % numPins;

      let cx = offsetX + gx * stepX + stepX / 2 + pinXOff[pinIdx];
      let cy = offsetY + gy * stepY + stepY / 2 + pinYOff[pinIdx];
      let wearFactor = 1.0;
      let dxTotal = 0,
        dyTotal = 0;
      let ghostCount = 0;
      // Ghost array reused per cell — capacity 8 (more than any layer adds).
      const ghostDx = ghostsDx,
        ghostDy = ghostsDy,
        ghostA = ghostsA;
      let skipCell = false;

      for (let li = 0; li < layerData.length; li++) {
        if (skipCell) break;
        const ld = layerData[li];
        const str = ld.strength;

        switch (ld.pattern) {
          case 'cloudy': {
            wearFactor *= 1.0 - ld.noise(gx, gy, gridW, gridH) * str * 0.75;
            break;
          }
          case 'ghosting': {
            const sweepIdx = Math.floor(gy / sweepRows);
            const dir = (sweepIdx & 1) === 0 ? 1 : -1;
            const gdx = dir * 7 * str * dpiNorm300;
            const gdy = (rng() - 0.5) * 2;
            if (ghostCount < 8) {
              ghostDx[ghostCount] = gdx;
              ghostDy[ghostCount] = gdy;
              ghostA[ghostCount] = 0.25 * str;
              ghostCount++;
            }
            break;
          }
          case 'pin_skip': {
            const h = ld.health[pinIdx];
            if (h <= 0) {
              skipCell = true;
              break;
            }
            wearFactor *= h;
            break;
          }
          case 'misaligned': {
            dxTotal += ld.rowOff[gy] * str * dpiNorm160;
            break;
          }
          case 'smudge': {
            if (ld.rows[gy]) {
              dxTotal += (rng() - 0.25) * 9 * str;
              wearFactor *= 0.55 + rng() * 0.3;
            }
            break;
          }
          case 'ribbon_twist': {
            wearFactor *= ld.col[gx];
            break;
          }
          case 'head_gap': {
            wearFactor *= Math.max(0.05, 1.0 - str * 0.7);
            break;
          }
          case 'ink_starved': {
            const rowFade = ld.rowDep[gy];
            const lineFade = gx * invMaxGx * str * 0.4;
            wearFactor *= Math.max(0.04, 1.0 - rowFade * str * 0.6 - lineFade);
            break;
          }
          case 'paper_slip': {
            dyTotal += ld.rowShift[gy];
            break;
          }
          case 'static_noise': {
            if (rng() < 0.002 * str * 5) {
              const burst = 1 + Math.floor(rng() * 3);
              for (let k = 0; k < burst && ghostCount < 8; k++) {
                ghostDx[ghostCount] = (rng() - 0.5) * stepX * 8 * str;
                ghostDy[ghostCount] = (rng() - 0.5) * stepY * 2;
                ghostA[ghostCount] = rng() * 0.45 * str;
                ghostCount++;
              }
            }
            break;
          }
          case 'double_feed': {
            if (ghostCount < 8) {
              ghostDx[ghostCount] = ld.offX * stepX;
              ghostDy[ghostCount] = ld.offY * stepY;
              ghostA[ghostCount] = 0.12 * str;
              ghostCount++;
            }
            break;
          }
          case 'mechanical_resonance': {
            dxTotal += Math.sin(gy * ld.freq * 2 * Math.PI + ld.phase) * stepX * str * 1.2;
            break;
          }
        }
      }

      if (skipCell) {
        processed++;
        continue;
      }

      cx += dxTotal;
      cy += dyTotal;

      const ribbonFade = 1.0 - gx * invGridW * ribbonFadeAmt;

      if (passJitter > 0) {
        cx += gauss() * passJitter;
        cy += gauss() * passJitter;
      }

      const band = rowBands[gy] * wearFactor * pinDensMod[pinIdx] * ribbonFade;
      stampInto(ink, outW, outH, stamp, stampSize, cx - stampR, cy - stampR, band);

      for (let g = 0; g < ghostCount; g++) {
        stampInto(
          ink,
          outW,
          outH,
          stamp,
          stampSize,
          cx - stampR + ghostDx[g],
          cy - stampR + ghostDy[g],
          band * ghostA[g]
        );
      }

      processed++;
      if ((processed & 0x7fff) === 0) {
        if (onProgressUpdate)
          onProgressUpdate(`Rendering · ${((processed / total) * 100).toFixed(0)}%`);
        await yieldUI();
      }
    }
  }

  // Compose output ImageData — paper underlies ink with linear blend.
  const finalImg = new ImageData(outW, outH);
  const [pr, pg, pb] = state.paper;
  const [ir, ig, ib] = state.ink;
  const d = finalImg.data;
  for (let i = 0, j = 0; i < ink.length; i++, j += 4) {
    const a = ink[i] > 1 ? 1 : ink[i];
    d[j] = (pr * (1 - a) + ir * a) | 0;
    d[j + 1] = (pg * (1 - a) + ig * a) | 0;
    d[j + 2] = (pb * (1 - a) + ib * a) | 0;
    d[j + 3] = 255;
  }

  if (state.softBlur) boxBlur3x3(d, outW, outH);
  return { imageData: finalImg, width: outW, height: outH };
}

// ── Per-cell ghost scratch buffers ──────────────────────────────────────────
// Module-scoped to avoid GC churn. Render is single-threaded by virtue of
// running on the main thread or one dedicated worker.
const ghostsDx = new Float32Array(8);
const ghostsDy = new Float32Array(8);
const ghostsA = new Float32Array(8);

// ── ASCII preview ────────────────────────────────────────────────────────────
/**
 * Generates an ASCII art preview of the image.
 * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement} srcImage - The image to convert.
 * @param {number} width - The target width in characters (default 60).
 * @returns {string} The ASCII string representation.
 */
export function asciiPreview(srcImage, width = 60) {
  const aspect = srcImage.width / srcImage.height;
  let h = Math.round(width / aspect / 2) * 2;
  h = Math.max(8, Math.min(60, h));
  const c = defaultCreateCanvas(width, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, h);
  ctx.drawImage(srcImage, 0, 0, width, h);
  const mode = getMathMode(state);
  const gray = toGrayscale(ctx.getImageData(0, 0, width, h), state, mode);

  let dots;
  if (state.dither === 'floyd_steinberg')
    dots = floydSteinberg(gray, width, h, mode, state.threshold);
  else if (state.dither === 'ordered') dots = orderedDither(gray, width, h);
  else dots = thresholdDither(gray, width, h, state.threshold);

  let out = '';
  for (let y = 0; y < h - 1; y += 2) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const top = dots[y * width + x];
      const bot = dots[(y + 1) * width + x];
      if (top && bot) line += '\u2588';
      else if (top) line += '\u2580';
      else if (bot) line += '\u2584';
      else line += ' ';
    }
    out += line + '\n';
  }
  return out;
}
