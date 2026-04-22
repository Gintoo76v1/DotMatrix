import { PROFILES, state, MM_PER_INCH, PAPER_SIZES_MM } from './config.js';
import { mulberry32, gaussian, yieldUI } from './utils.js';
import { toGrayscale, floydSteinberg, orderedDither, thresholdDither, boxBlur3x3 } from './filters.js';

export function makeDotStamp(diameterPx, softness, density) {
  let size = Math.max(3, Math.round(diameterPx));
  if (size % 2 === 0) size++;
  const cx = (size - 1) / 2;
  const radius = size / 2;
  const inner = radius * (1 - softness);
  const stamp = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cx;
      const r = Math.sqrt(dx * dx * 0.88 + dy * dy);
      let v;
      if (r <= inner) v = 1;
      else v = Math.max(0, 1 - (r - inner) / Math.max(0.01, radius - inner));
      stamp[y * size + x] = v * density;
    }
  }
  return { data: stamp, size };
}

export function stampInto(ink, w, h, stamp, ss, x0, y0, band) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  const x1 = x0 + ss, y1 = y0 + ss;
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
      ink[di] = v > 1 ? 1 : v;
    }
  }
}

function makeValueNoise(rng, noiseW, noiseH) {
  const grid = new Float32Array(noiseW * noiseH);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  return (x, y, totalW, totalH) => {
    const nx = (x / totalW) * (noiseW - 1);
    const ny = (y / totalH) * (noiseH - 1);
    const x0 = Math.floor(nx), x1 = Math.min(x0 + 1, noiseW - 1);
    const y0 = Math.floor(ny), y1 = Math.min(y0 + 1, noiseH - 1);
    const fx = nx - x0, fy = ny - y0;
    const v00 = grid[y0 * noiseW + x0], v10 = grid[y0 * noiseW + x1];
    const v01 = grid[y1 * noiseW + x0], v11 = grid[y1 * noiseW + x1];
    return v00*(1-fx)*(1-fy) + v10*fx*(1-fy) + v01*(1-fx)*fy + v11*fx*fy;
  };
}

// ── Pre-compute all data for one wear layer ──────────────────────────────────
function buildLayerData(layer, rng, gridW, gridH, numPins, stepY) {
  const str = (layer.strength ?? 50) / 100;
  const ld = { pattern: layer.pattern, strength: str };

  switch (layer.pattern) {
    case 'cloudy': {
      ld.noise = makeValueNoise(rng, 16, 16);
      break;
    }
    case 'misaligned': {
      ld.rowOff = new Float32Array(gridH);
      let acc = 0;
      for (let y = 0; y < gridH; y++) {
        acc += (rng() - 0.5) * 1.4;
        acc *= 0.91; // damping keeps drift bounded
        ld.rowOff[y] = acc;
      }
      break;
    }
    case 'pin_skip': {
      ld.health = new Float32Array(numPins).fill(1.0);
      for (let p = 0; p < numPins; p++) {
        const roll = rng();
        if (roll < str * 0.22) {
          ld.health[p] = 0; // completely dead pin
        } else if (roll < str * 0.55) {
          ld.health[p] = Math.max(0.08, 1.0 - str * (0.3 + rng() * 0.5));
        }
      }
      break;
    }
    case 'smudge': {
      ld.rows = new Uint8Array(gridH);
      let inSmudge = false;
      for (let y = 0; y < gridH; y++) {
        if (!inSmudge && rng() < 0.04 * str) inSmudge = true;
        else if (inSmudge && rng() < 0.22) inSmudge = false;
        ld.rows[y] = inSmudge ? 1 : 0;
      }
      break;
    }
    case 'ribbon_twist': {
      ld.col = new Float32Array(gridW).fill(1.0);
      let val = 0.85 + rng() * 0.15;
      for (let x = 0; x < gridW; x++) {
        val += (rng() - 0.5) * 0.06;
        val = Math.max(0.25, Math.min(1.0, val));
        ld.col[x] = 1.0 - (1.0 - val) * str;
      }
      break;
    }
    case 'ink_starved': {
      // Depletion accumulates as ribbon unspools through the job
      ld.rowDep = new Float32Array(gridH);
      let dep = 0;
      for (let y = 0; y < gridH; y++) {
        dep = Math.min(1.0, dep + rng() * 0.003 * str);
        ld.rowDep[y] = dep;
      }
      break;
    }
    case 'paper_slip': {
      // Random-walk vertical slip (feed roller inconsistency)
      ld.rowShift = new Float32Array(gridH);
      let slip = 0;
      for (let y = 0; y < gridH; y++) {
        if (rng() < 0.04 * str) slip += (rng() - 0.5) * stepY * str * 4;
        slip *= 0.85;
        ld.rowShift[y] = slip;
      }
      break;
    }
    case 'mechanical_resonance': {
      // Sinusoidal X drift from print head resonance at certain carriage speeds
      ld.freq = 0.08 + rng() * 0.06;
      ld.amp  = 1.0;  // scaled per-cell by stepX * str
      break;
    }
    case 'double_feed': {
      // Offset of second sheet (faint background copy)
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

export async function render(srcImage, onProgressUpdate) {
  const profile = PROFILES[state.profile];
  const seed = state.seed || Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);
  const srcAspect = srcImage.width / srcImage.height;

  const condensedMult = (state.condensed && profile.supports_condensed) ? 1.5 : 1.0;
  const dpiH = profile.dpi_h * condensedMult;
  const dpiV = profile.dpi_v;

  let outW, outH, gridW, gridH, offsetX, offsetY, stepX, stepY, effDpi;

  if (state.paperFormat === "Original") {
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
    offsetX = 0; offsetY = 0;
    stepX = outW / gridW; stepY = outH / gridH;
  } else {
    let paperW, paperH;
    if (state.paperFormat === "Fit") {
      paperH = 297; paperW = paperH * srcAspect;
    } else {
      const size = PAPER_SIZES_MM[state.paperFormat];
      if (state.orientation === "Landscape") { paperW = size[1]; paperH = size[0]; }
      else { paperW = size[0]; paperH = size[1]; }
    }
    const marginMm = 10;
    const printableW = Math.max(1, paperW - 2 * marginMm);
    const printableH = Math.max(1, paperH - 2 * marginMm);
    const maxGridW = Math.round(printableW / MM_PER_INCH * dpiH);
    const maxGridH = Math.round(printableH / MM_PER_INCH * dpiV);
    const targetGridAspect = srcAspect * (dpiH / dpiV);
    if ((maxGridW / maxGridH) > targetGridAspect) {
      gridH = maxGridH; gridW = Math.round(gridH * targetGridAspect);
    } else {
      gridW = maxGridW; gridH = Math.round(gridW / targetGridAspect);
    }
    outW = Math.round(paperW / MM_PER_INCH * state.dpi);
    outH = Math.round(paperH / MM_PER_INCH * state.dpi);
    const longEdge = Math.max(outW, outH);
    if (longEdge > state.maxSize) {
      const scale = state.maxSize / longEdge;
      outW = Math.round(outW * scale);
      outH = Math.round(outH * scale);
    }
    effDpi = outW / (paperW / MM_PER_INCH);
    const printPxW = gridW / dpiH * effDpi;
    const printPxH = gridH / dpiV * effDpi;
    offsetX = Math.round((outW - printPxW) / 2);
    offsetY = Math.round((outH - printPxH) / 2);
    stepX = effDpi / dpiH; stepY = effDpi / dpiV;
  }

  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = gridW; gridCanvas.height = gridH;
  const gctx = gridCanvas.getContext("2d");
  gctx.fillStyle = "#fff";
  gctx.fillRect(0, 0, gridW, gridH);
  gctx.drawImage(srcImage, 0, 0, gridW, gridH);
  const gridData = gctx.getImageData(0, 0, gridW, gridH);
  const gray = toGrayscale(gridData, state);

  let dots;
  if (state.dither === "floyd_steinberg") dots = floydSteinberg(gray, gridW, gridH);
  else if (state.dither === "ordered")    dots = orderedDither(gray, gridW, gridH);
  else                                    dots = thresholdDither(gray, gridW, gridH, state.threshold);

  const ink = new Float32Array(outW * outH);
  const dotPx = Math.max(2, Math.round(profile.dot_diameter_mm / MM_PER_INCH * effDpi));
  const { data: stamp, size: stampSize } = makeDotStamp(dotPx, profile.dot_softness, profile.ink_density);
  const stampR = (stampSize - 1) / 2;

  const passes    = Math.min(3, profile.passes * (state.doubleStrike ? 2 : 1));
  const jitterPx  = profile.jitter_mm * state.jitterScale / MM_PER_INCH * effDpi;
  const bandAmp   = profile.banding * state.bandingScale;

  // ── PER-PIN CHARACTERISTICS ──────────────────────────────────────────────
  const numPins     = profile.pins;
  const pinYOff     = new Float32Array(numPins);
  const pinXOff     = new Float32Array(numPins);
  const pinDensMod  = new Float32Array(numPins);
  const pinHealth   = new Float32Array(numPins).fill(1.0);

  const pinTolPx = Math.max(0.5, profile.jitter_mm * 0.5 / MM_PER_INCH * effDpi);
  for (let p = 0; p < numPins; p++) {
    pinYOff[p] = (rng() - 0.5) * 2 * pinTolPx;
    pinXOff[p] = (rng() - 0.5) * pinTolPx * 0.35;
    const norm = (p - (numPins - 1) / 2) / Math.max(1, (numPins - 1) / 2);
    pinDensMod[p] = 1.0 - 0.14 * norm * norm;
  }

  // ── BUILD MODULAR WEAR LAYER DATA ─────────────────────────────────────────
  const wearLayers = Array.isArray(state.wearLayers) ? state.wearLayers : [];
  const layerData  = wearLayers
    .filter(l => l && l.pattern && l.pattern !== 'none' && (l.strength ?? 0) > 0)
    .map(l => buildLayerData(l, rng, gridW, gridH, numPins, stepY));

  // Row banding: slight row-to-row density variation from paper/head oscillation
  const rowBands = new Float32Array(gridH);
  for (let y = 0; y < gridH; y++) rowBands[y] = 1 - bandAmp * rng();

  const onCells = [];
  for (let y = 0; y < gridH; y++)
    for (let x = 0; x < gridW; x++)
      if (dots[y * gridW + x]) onCells.push([x, y]);

  let processed = 0;
  const total = onCells.length * passes;
  await yieldUI();

  for (let p = 0; p < passes; p++) {
    const passJitter = jitterPx * (1 + 0.3 * p);

    for (let idx = 0; idx < onCells.length; idx++) {
      const [gx, gy] = onCells[idx];
      const pinIdx = gy % numPins;

      let cx = offsetX + gx * stepX + stepX / 2 + pinXOff[pinIdx];
      let cy = offsetY + gy * stepY + stepY / 2 + pinYOff[pinIdx];
      let wearFactor = 1.0;
      let dxTotal = 0, dyTotal = 0;
      const ghosts = [];
      let skipCell = false;

      // ── Apply each active wear layer ─────────────────────────────────────
      for (const ld of layerData) {
        if (skipCell) break;
        const { pattern: pat, strength: str } = ld;

        switch (pat) {
          case 'cloudy': {
            wearFactor *= 1.0 - ld.noise(gx, gy, gridW, gridH) * str * 0.75;
            break;
          }
          case 'ghosting': {
            const dir = (Math.floor(gy / numPins) % 2 === 0) ? 1 : -1;
            const gdx = dir * 7 * str * (effDpi / 300);
            const gdy = (rng() - 0.5) * 2;
            ghosts.push({ dx: gdx, dy: gdy, alphaMod: 0.25 * str });
            break;
          }
          case 'pin_skip': {
            const h = ld.health[pinIdx];
            if (h <= 0) { skipCell = true; break; }
            wearFactor *= h;
            break;
          }
          case 'misaligned': {
            dxTotal += ld.rowOff[gy] * str * (effDpi / 160);
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
            wearFactor *= Math.max(0.05, 1.0 - str * 0.70);
            break;
          }
          case 'ink_starved': {
            const rowFade  = ld.rowDep[gy];
            const lineFade = (gx / Math.max(1, gridW - 1)) * str * 0.40;
            wearFactor *= Math.max(0.04, 1.0 - rowFade * str * 0.60 - lineFade);
            break;
          }
          case 'paper_slip': {
            dyTotal += ld.rowShift[gy];
            break;
          }
          case 'static_noise': {
            if (rng() < 0.002 * str * 5) {
              const burst = 1 + Math.floor(rng() * 3);
              for (let k = 0; k < burst; k++) {
                ghosts.push({
                  dx: (rng() - 0.5) * stepX * 8 * str,
                  dy: (rng() - 0.5) * stepY * 2,
                  alphaMod: rng() * 0.45 * str,
                });
              }
            }
            break;
          }
          case 'double_feed': {
            ghosts.push({
              dx: ld.offX * stepX,
              dy: ld.offY * stepY,
              alphaMod: 0.12 * str,
            });
            break;
          }
          case 'mechanical_resonance': {
            dxTotal += Math.sin(gy * ld.freq * Math.PI * 2) * stepX * str * 1.2;
            break;
          }
        }
      }

      if (skipCell) { processed++; continue; }

      cx += dxTotal;
      cy += dyTotal;

      const ribbonFade = 1.0 - (gx / gridW) * 0.09;

      if (passJitter > 0) {
        cx += gaussian(rng) * passJitter;
        cy += gaussian(rng) * passJitter;
      }

      // 🐞 BUGFIX: dotBandMult entfernt, da undefiniert. 
      const band = rowBands[gy] * wearFactor * pinDensMod[pinIdx] * ribbonFade;
      
      // 🐞 BUGFIX: bleedStampSize ersetzt durch existierende Variable stampSize
      stampInto(ink, outW, outH, stamp, stampSize, cx - stampR, cy - stampR, band);

      // 🐞 BUGFIX: w_drag Block entfernt, da diese Variable undefiniert war und das Rendering abstürzen ließ.

      for (const g of ghosts) {
        stampInto(ink, outW, outH, stamp, stampSize,
          cx - stampR + g.dx, cy - stampR + g.dy,
          band * g.alphaMod);
      }

      processed++;
      if ((processed & 0x7FFF) === 0) {
        if (onProgressUpdate) onProgressUpdate(`Rendering · ${((processed / total) * 100).toFixed(0)}%`);
        await yieldUI();
      }
    }
  }

  const finalImg = new ImageData(outW, outH);
  const [pr, pg, pb] = state.paper;
  const [ir, ig, ib] = state.ink;
  const d = finalImg.data;
  for (let i = 0, j = 0; i < ink.length; i++, j += 4) {
    const a = ink[i];
    d[j]   = Math.round(pr * (1 - a) + ir * a);
    d[j+1] = Math.round(pg * (1 - a) + ig * a);
    d[j+2] = Math.round(pb * (1 - a) + ib * a);
    d[j+3] = 255;
  }

  if (state.softBlur) boxBlur3x3(d, outW, outH);
  return { imageData: finalImg, width: outW, height: outH };
}

export function asciiPreview(srcImage, width = 60) {
  const aspect = srcImage.width / srcImage.height;
  let h = Math.round(width / aspect / 2) * 2;
  h = Math.max(8, Math.min(60, h));
  const c = document.createElement("canvas");
  c.width = width; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, h);
  ctx.drawImage(srcImage, 0, 0, width, h);
  const gray = toGrayscale(ctx.getImageData(0, 0, width, h), state);

  let dots;
  if (state.dither === "floyd_steinberg") dots = floydSteinberg(gray, width, h);
  else if (state.dither === "ordered")    dots = orderedDither(gray, width, h);
  else                                    dots = thresholdDither(gray, width, h, state.threshold);

  let out = "";
  for (let y = 0; y < h - 1; y += 2) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const top = dots[y * width + x];
      const bot = dots[(y + 1) * width + x];
      if (top && bot)     line += "\u2588";
      else if (top)       line += "\u2580";
      else if (bot)       line += "\u2584";
      else                line += " ";
    }
    out += line + "\n";
  }
  return out;
}
