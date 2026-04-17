export function toGrayscale(imgData, stateObj) {
  const {width, height, data} = imgData;
  const out = new Float32Array(width * height);
  const c = (stateObj.contrast / 100) + 1;
  const intercept = 128 * (1 - c);
  const b = stateObj.brightness;
  const g = stateObj.gamma;
  const inv = stateObj.invert;

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    let r = data[i], green = data[i+1], blue = data[i+2];
    r = r * c + intercept + b;
    green = green * c + intercept + b;
    blue = blue * c + intercept + b;
    r = 255 * Math.pow(Math.max(0, Math.min(255, r)) / 255, g);
    green = 255 * Math.pow(Math.max(0, Math.min(255, green)) / 255, g);
    blue = 255 * Math.pow(Math.max(0, Math.min(255, blue)) / 255, g);
    let luma = 0.299 * r + 0.587 * green + 0.114 * blue;
    if (inv) luma = 255 - luma;
    out[j] = Math.max(0, Math.min(255, luma));
  }
  return out;
}

export function floydSteinberg(gray, w, h) {
  const buf = new Float32Array(gray);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = buf[i];
      const n = old < 128 ? 0 : 255;
      buf[i] = n;
      out[i] = n === 0 ? 1 : 0;
      const err = old - n;
      if (x + 1 < w)  buf[i+1]     += err * 7/16;
      if (y + 1 < h) {
        if (x > 0)    buf[i+w-1]   += err * 3/16;
                      buf[i+w]     += err * 5/16;
        if (x + 1 < w) buf[i+w+1]  += err * 1/16;
      }
    }
  }
  return out;
}

const BAYER4 = new Float32Array([
  0, 8, 2,10,
 12, 4,14, 6,
  3,11, 1, 9,
 15, 7,13, 5,
]).map(v => v / 16 * 255);

export function orderedDither(gray, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = BAYER4[(y & 3) * 4 + (x & 3)];
      out[y*w+x] = gray[y*w+x] < t ? 1 : 0;
    }
  }
  return out;
}

export function thresholdDither(gray, w, h, t) {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) out[i] = gray[i] < t ? 1 : 0;
  return out;
}

export function boxBlur3x3(data, w, h) {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            s += copy[((y+ky) * w + (x+kx)) * 4 + c];
        data[i + c] = (s / 9) | 0;
      }
    }
  }
}
