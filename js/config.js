export const MM_PER_INCH = 25.4;
export const PAPER_SIZES_MM = {
  A4:     [210.0, 297.0],
  A5:     [148.0, 210.0],
  A6:     [105.0, 148.0],
  Rezept: [105.0, 148.0], // Kassenrezept Muster 16 (in Landscape nutzen!)
  Letter: [215.9, 279.4],
};

export const PROFILES = {
  epson_fx: { label: "Epson FX-80", pins: 9, dpi_h: 120, dpi_v: 72, dot_diameter_mm: 0.35, dot_softness: 0.30, ink_density: 0.88, passes: 1, jitter_mm: 0.04, banding: 0.08, supports_condensed: true },
  epson_lq: { label: "Epson LQ-850", pins: 24, dpi_h: 180, dpi_v: 180, dot_diameter_mm: 0.20, dot_softness: 0.22, ink_density: 0.82, passes: 1, jitter_mm: 0.02, banding: 0.04, supports_condensed: true },
  ibm_proprinter: { label: "IBM Proprinter", pins: 9, dpi_h: 120, dpi_v: 72, dot_diameter_mm: 0.38, dot_softness: 0.26, ink_density: 0.95, passes: 2, jitter_mm: 0.05, banding: 0.10, supports_condensed: false },
  oki_microline: { label: "OKI Microline", pins: 9, dpi_h: 144, dpi_v: 72, dot_diameter_mm: 0.33, dot_softness: 0.34, ink_density: 0.85, passes: 1, jitter_mm: 0.035, banding: 0.12, supports_condensed: true },
  star_nx1000: { label: "Star NX-1000", pins: 9, dpi_h: 144, dpi_v: 144, dot_diameter_mm: 0.32, dot_softness: 0.28, ink_density: 0.87, passes: 1, jitter_mm: 0.03, banding: 0.07, supports_condensed: true },
  panasonic_kx: { label: "Panasonic KX-P", pins: 24, dpi_h: 360, dpi_v: 180, dot_diameter_mm: 0.22, dot_softness: 0.20, ink_density: 0.88, passes: 1, jitter_mm: 0.02, banding: 0.04, supports_condensed: true },
  dec_la75: { label: "DEC LA75", pins: 9, dpi_h: 144, dpi_v: 144, dot_diameter_mm: 0.35, dot_softness: 0.25, ink_density: 0.90, passes: 1, jitter_mm: 0.02, banding: 0.05, supports_condensed: false },
  nec_p6: { label: "NEC P6", pins: 24, dpi_h: 360, dpi_v: 360, dot_diameter_mm: 0.15, dot_softness: 0.15, ink_density: 0.85, passes: 1, jitter_mm: 0.015, banding: 0.03, supports_condensed: true },
  commodore_mps: { label: "MPS-803", pins: 7, dpi_h: 60, dpi_v: 72, dot_diameter_mm: 0.45, dot_softness: 0.40, ink_density: 0.80, passes: 1, jitter_mm: 0.08, banding: 0.15, supports_condensed: false },
  apple_imagewriter: { label: "ImageWriter II", pins: 9, dpi_h: 144, dpi_v: 72, dot_diameter_mm: 0.35, dot_softness: 0.25, ink_density: 0.85, passes: 1, jitter_mm: 0.03, banding: 0.06, supports_condensed: true }
};

export const state = {
  profile: "oki_microline",
  dither: "threshold",
  threshold: 128,
  ink: [25,25,30],
  paper: [255,255,255],
  paperFormat: "Original",
  orientation: "Portrait",
  doubleStrike: false,
  condensed: false,
  brightness: 0,
  contrast: 20,
  gamma: 1.0,
  invert: false,
  dpi: 900,
  jitterScale: 1.0,
  bandingScale: 1.0,
  maxSize: 6000,
  wearPattern: "none", 
  wearStrength: 50,
  seed: 0,
  sourceImage: null,
};
