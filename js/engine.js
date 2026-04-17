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
      const r = Math.sqrt(dx*dx + dy*dy);
      let v;
      if (r <= inner) v = 1;
      else v = Math.max(0, 1 - (r - inner) / Math.max(0.01, radius - inner));
      stamp[y*size+x] = v * density;
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

export async function render(srcImage, onProgressUpdate) {
  const profile = PROFILES[state.profile];
  const seed = state.seed || Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);

  const srcAspect = srcImage.width / srcImage.height;
  let paperW, paperH;
  let marginMm = 0;

  if (state.paperFormat === "Original") {
    paperW = (srcImage.width / state.dpi) * MM_PER_INCH;
    paperH = (srcImage.height / state.dpi) * MM_PER_INCH;
    marginMm = 0; 
  } else if (state.paperFormat === "Fit") {
    paperH = 297;
    paperW = paperH * srcAspect;
    marginMm = 10;
  } else {
    const size = PAPER_SIZES_MM[state.paperFormat];
    if (state.orientation === "Landscape") { paperW = size[1]; paperH = size[0]; }
    else { paperW = size[0]; paperH = size[1]; }
    marginMm = 10;
  }

  const printableW = Math.max(1, paperW - 2 * marginMm);
  const printableH = Math.max(1, paperH - 2 * marginMm);

  const condensedMult = (state.condensed && profile.supports_condensed) ? 1.5 : 1.0;
  const dpiH = profile.dpi_h * condensedMult;
  const dpiV = profile.dpi_v;

  const maxGridW = Math.round(printableW / MM_PER_INCH * dpiH);
  const maxGridH = Math.round(printableH / MM_PER_INCH * dpiV);
  const targetGridAspect = srcAspect * (dpiH / dpiV);

  let gridW, gridH;
  if ((maxGridW / maxGridH) > targetGridAspect) {
    gridH = maxGridH;
    gridW = Math.round(gridH * targetGridAspect);
  } else {
    gridW = maxGridW;
    gridH = Math.round(gridW / targetGridAspect);
  }

  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = gridW;
  gridCanvas.height = gridH;
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

  let outW = Math.round(paperW / MM_PER_INCH * state.dpi);
  let outH = Math.round(paperH / MM_PER_INCH * state.dpi);
  const longEdge = Math.max(outW, outH);
  
  if (longEdge > state.maxSize) {
    const scale = state.maxSize / longEdge;
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }
  const effDpi = outW / (paperW / MM_PER_INCH);

  const ink = new Float32Array(outW * outH);
  const dotPx = Math.max(2, Math.round(profile.dot_diameter_mm / MM_PER_INCH * effDpi));
  const {data: stamp, size: stampSize} = makeDotStamp(dotPx, profile.dot_softness, profile.ink_density);
  const stampR = (stampSize - 1) / 2;

  const passes = Math.min(3, profile.passes * (state.doubleStrike ? 2 : 1));

  const printPxW = gridW / dpiH * effDpi;
  const printPxH = gridH / dpiV * effDpi;
  
  const offsetX = Math.round((outW - printPxW) / 2);
  const offsetY = Math.round((outH - printPxH) / 2);
  const stepX = effDpi / dpiH;
  const stepY = effDpi / dpiV;

  const jitterPx = profile.jitter_mm * state.jitterScale / MM_PER_INCH * effDpi;
  const bandAmp = profile.banding * state.bandingScale;
  
  // FIX: Hardware Error Variables
  const wearStrength = state.wearStrength / 100;

  const rowBands = new Float32Array(gridH);
  for (let y = 0; y < gridH; y++) rowBands[y] = 1 - bandAmp * rng();

  const onCells = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (dots[y*gridW+x]) onCells.push([x, y]);
    }
  }

  let processed = 0;
  const total = onCells.length * passes;
  await yieldUI();
  
  for (let p = 0; p < passes; p++) {
    const passJitter = jitterPx * (1 + 0.3 * p);
    
    for (let idx = 0; idx < onCells.length; idx++) {
      const [gx, gy] = onCells[idx];
      let cx = offsetX + Math.round(gx * stepX + stepX / 2);
      let cy = offsetY + Math.round(gy * stepY + stepY / 2);
      
      let wearFactor = 1.0;

      // --- HARDWARE ERRORS LOGIC FIX ---
      if (state.wearPattern === "cloudy") {
        // Sanfter Wolken-Effekt: Reduziert Opacity, fällt aber NIE auf 0 (mind. 40% verbleiben bei Max-Settings)
        let noise = Math.sin(gx * 0.05) * Math.sin(gy * 0.05) * 0.5 + 0.5;
        wearFactor = 1.0 - (noise * wearStrength * 0.6); 
      } 
      else if (state.wearPattern === "pin_skip") {
        // Einzelne Nadeln versagen komplett: Zufälliger Dot-Drop (Max. 30% Ausfallrate)
        if (rng() < (wearStrength * 0.3)) continue; 
      } 
      else if (state.wearPattern === "misaligned") {
        // Wackelnder Druckkopf: Horizontale Verschiebung ganzer Zeilen
        let shiftOscillation = Math.sin(gy * 0.8) * 2.0; 
        // Skaliert mit DPI, damit die Verschiebung proportional bleibt
        cx += Math.round(shiftOscillation * wearStrength * (effDpi / 150)); 
      }

      // Natürliches Hardware-Jitter (immer aktiv)
      if (passJitter > 0) {
        cx += Math.round(gaussian(rng) * passJitter);
        cy += Math.round(gaussian(rng) * passJitter);
      }

      const band = rowBands[gy] * wearFactor;
      stampInto(ink, outW, outH, stamp, stampSize, cx - stampR, cy - stampR, band);

      processed++;
      if ((processed & 0x7FFF) === 0) {
        if(onProgressUpdate) onProgressUpdate(`Rendering · ${((processed/total)*100).toFixed(0)}%`);
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

  boxBlur3x3(d, outW, outH);
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
      if (top && bot) line += "\u2588";
      else if (top)   line += "\u2580";
      else if (bot)   line += "\u2584";
      else            line += " ";
    }
    out += line + "\n";
  }
  return out;
}
