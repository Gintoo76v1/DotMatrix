export const MM_PER_INCH = 25.4;
export const PAPER_SIZES_MM = {
  A4:     [210.0, 297.0],
  A5:     [148.0, 210.0],
  A6:     [105.0, 148.0],
  Rezept: [105.0, 148.0],
  Letter: [215.9, 279.4],
};

// `ribbon_fade` — fractional ink loss across one carriage sweep (left→right).
// Default 0.09 keeps backwards compatibility with the previously hard-coded
// `1.0 - (gx / gridW) * 0.09` term in engine.js.
export const PROFILES = {
  epson_fx:          { label: "Epson FX-80",      pins: 9,  dpi_h: 120, dpi_v: 72,  dot_diameter_mm: 0.35, dot_softness: 0.30, ink_density: 0.88, passes: 1, jitter_mm: 0.040, banding: 0.08, ribbon_fade: 0.09, supports_condensed: true  },
  epson_lq:          { label: "Epson LQ-850",     pins: 24, dpi_h: 180, dpi_v: 180, dot_diameter_mm: 0.20, dot_softness: 0.22, ink_density: 0.82, passes: 1, jitter_mm: 0.020, banding: 0.04, ribbon_fade: 0.06, supports_condensed: true  },
  ibm_proprinter:    { label: "IBM Proprinter",   pins: 9,  dpi_h: 120, dpi_v: 72,  dot_diameter_mm: 0.38, dot_softness: 0.26, ink_density: 0.95, passes: 2, jitter_mm: 0.050, banding: 0.10, ribbon_fade: 0.10, supports_condensed: false },
  oki_microline:     { label: "OKI Microline",    pins: 9,  dpi_h: 144, dpi_v: 72,  dot_diameter_mm: 0.33, dot_softness: 0.34, ink_density: 0.85, passes: 1, jitter_mm: 0.035, banding: 0.12, ribbon_fade: 0.09, supports_condensed: true  },
  star_nx1000:       { label: "Star NX-1000",     pins: 9,  dpi_h: 144, dpi_v: 144, dot_diameter_mm: 0.32, dot_softness: 0.28, ink_density: 0.87, passes: 1, jitter_mm: 0.030, banding: 0.07, ribbon_fade: 0.08, supports_condensed: true  },
  panasonic_kx:      { label: "Panasonic KX-P",   pins: 24, dpi_h: 360, dpi_v: 180, dot_diameter_mm: 0.22, dot_softness: 0.20, ink_density: 0.88, passes: 1, jitter_mm: 0.020, banding: 0.04, ribbon_fade: 0.05, supports_condensed: true  },
  dec_la75:          { label: "DEC LA75",          pins: 9,  dpi_h: 144, dpi_v: 144, dot_diameter_mm: 0.35, dot_softness: 0.25, ink_density: 0.90, passes: 1, jitter_mm: 0.020, banding: 0.05, ribbon_fade: 0.07, supports_condensed: false },
  nec_p6:            { label: "NEC P6",            pins: 24, dpi_h: 360, dpi_v: 360, dot_diameter_mm: 0.15, dot_softness: 0.15, ink_density: 0.85, passes: 1, jitter_mm: 0.015, banding: 0.03, ribbon_fade: 0.04, supports_condensed: true  },
  commodore_mps:     { label: "MPS-803",           pins: 7,  dpi_h: 60,  dpi_v: 72,  dot_diameter_mm: 0.45, dot_softness: 0.40, ink_density: 0.80, passes: 1, jitter_mm: 0.080, banding: 0.15, ribbon_fade: 0.14, supports_condensed: false },
  apple_imagewriter: { label: "ImageWriter II",    pins: 9,  dpi_h: 144, dpi_v: 72,  dot_diameter_mm: 0.35, dot_softness: 0.25, ink_density: 0.85, passes: 1, jitter_mm: 0.030, banding: 0.06, ribbon_fade: 0.08, supports_condensed: true  },
};

export const WEAR_PATTERNS = {
  cloudy:               { label: "Cloudy",       desc: "Blotchy ink density, ribbon saturation spots" },
  ghosting:             { label: "Ghosting",      desc: "Bi-directional print shadow at row offset" },
  misaligned:           { label: "Wobble",        desc: "Horizontal row drift, worn carriage rails" },
  pin_skip:             { label: "Pin Skip",      desc: "Dead/weak pin leaves horizontal void lines" },
  smudge:               { label: "Smudge",        desc: "Paper-contact drag in intermittent bands" },
  ribbon_twist:         { label: "Ribbon Twist",  desc: "Twisted ribbon, column-wise density variation" },
  head_gap:             { label: "Head Gap",      desc: "Platen too wide, all dots print too light" },
  ink_starved:          { label: "Ink Starved",   desc: "Ribbon near end, density fades line by line" },
  paper_slip:           { label: "Paper Slip",    desc: "Feed roller slip, irregular line spacing" },
  static_noise:         { label: "Static",        desc: "Electrostatic discharge, stray dot bursts" },
  double_feed:          { label: "Double Feed",   desc: "Two sheets stacked, faint offset shadow copy" },
  mechanical_resonance: { label: "Resonance",     desc: "Print head vibration, wavy vertical tracks" },
};

export const SYSTEM_PRESETS = [
  {
    id: "rezept", name: "Rezept", system: true,
    profile: "epson_lq",
    brightness: 100, contrast: 0, gamma: 1.5,
    dither: "ordered", threshold: 255,
    ink: [25, 25, 30], paper: null,
    paperFormat: "Original", orientation: "Landscape",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 1.5, bandingScale: 0.0, maxSize: 8000,
    wearLayers: [
      { pattern: "cloudy",        strength: 30 },
      { pattern: "ghosting",      strength: 50 },
      { pattern: "misaligned",    strength: 20 },
      { pattern: "pin_skip",      strength: 10 },
      { pattern: "smudge",        strength: 25 },
      { pattern: "ribbon_twist",  strength: 15 },
    ],
    seed: 0, softBlur: false, invert: false,
  },
  {
    id: "photo", name: "Photo", system: true,
    profile: "epson_lq",
    brightness: 0, contrast: 20, gamma: 1.1,
    dither: "floyd_steinberg", threshold: 128,
    ink: [25, 25, 30], paper: null,
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 0.8, bandingScale: 0.5, maxSize: 8000,
    wearLayers: [{ pattern: "cloudy", strength: 30 }],
    seed: 0, softBlur: false, invert: false,
  },
  {
    id: "worn_receipt", name: "Worn Receipt", system: true,
    profile: "star_nx1000",
    brightness: 10, contrast: 25, gamma: 1.2,
    dither: "ordered", threshold: 140,
    ink: [40, 32, 20], paper: [248, 245, 232],
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 1.2, bandingScale: 0.8, maxSize: 8000,
    wearLayers: [
      { pattern: "ribbon_twist", strength: 55 },
      { pattern: "ink_starved",  strength: 40 },
      { pattern: "pin_skip",     strength: 20 },
    ],
    seed: 0, softBlur: false, invert: false,
  },
  {
    id: "c64", name: "C64 Label", system: true,
    profile: "commodore_mps",
    brightness: 5, contrast: 30, gamma: 1.0,
    dither: "ordered", threshold: 128,
    ink: [20, 45, 130], paper: [248, 245, 232],
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: true, condensed: false,
    dpi: 300, jitterScale: 1.5, bandingScale: 1.2, maxSize: 8000,
    wearLayers: [{ pattern: "pin_skip", strength: 25 }, { pattern: "smudge", strength: 20 }],
    seed: 42, softBlur: false, invert: false,
  },
  {
    id: "crisp", name: "Crisp", system: true,
    profile: "nec_p6",
    brightness: 0, contrast: 30, gamma: 1.0,
    dither: "threshold", threshold: 128,
    ink: [25, 25, 30], paper: [255, 255, 255],
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 0.3, bandingScale: 0.2, maxSize: 8000,
    wearLayers: [],
    seed: 0, softBlur: false, invert: false,
  },
  {
    id: "ghost_doc", name: "Ghost Doc", system: true,
    profile: "ibm_proprinter",
    brightness: -10, contrast: 15, gamma: 1.3,
    dither: "ordered", threshold: 128,
    ink: [25, 25, 30], paper: null,
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 0.8, bandingScale: 1.0, maxSize: 8000,
    wearLayers: [
      { pattern: "ghosting",             strength: 45 },
      { pattern: "double_feed",          strength: 30 },
      { pattern: "mechanical_resonance", strength: 25 },
    ],
    seed: 0, softBlur: true, invert: false,
  },
  {
    id: "archive", name: "Archive", system: true,
    profile: "epson_fx",
    brightness: -5, contrast: 10, gamma: 1.4,
    dither: "ordered", threshold: 145,
    ink: [35, 28, 18], paper: [234, 223, 184],
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 1.0, bandingScale: 1.0, maxSize: 8000,
    wearLayers: [
      { pattern: "ink_starved", strength: 50 },
      { pattern: "head_gap",    strength: 30 },
      { pattern: "paper_slip",  strength: 20 },
    ],
    seed: 0, softBlur: false, invert: false,
  },
  {
    id: "fax_copy", name: "Fax Copy", system: true,
    profile: "epson_fx",
    brightness: -5, contrast: 40, gamma: 1.2,
    dither: "threshold", threshold: 140,
    ink: [25, 25, 30], paper: [248, 245, 232],
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 0.8, bandingScale: 0.6, maxSize: 8000,
    wearLayers: [
      { pattern: "ghosting",    strength: 35 },
      { pattern: "head_gap",    strength: 20 },
      { pattern: "double_feed", strength: 15 },
    ],
    seed: 0, softBlur: true, invert: false,
  },
  {
    id: "blueprint", name: "Blueprint", system: true,
    profile: "nec_p6",
    brightness: 0, contrast: 50, gamma: 1.0,
    dither: "threshold", threshold: 128,
    ink: [200, 220, 255], paper: [15, 35, 90],
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 0.2, bandingScale: 0.1, maxSize: 8000,
    wearLayers: [],
    seed: 0, softBlur: false, invert: true,
  },
  {
    id: "thermal", name: "Thermal", system: true,
    profile: "star_nx1000",
    brightness: 20, contrast: 35, gamma: 1.1,
    dither: "threshold", threshold: 110,
    ink: [30, 25, 25], paper: [252, 250, 248],
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 0.4, bandingScale: 0.2, maxSize: 8000,
    wearLayers: [
      { pattern: "ink_starved", strength: 25 },
      { pattern: "head_gap",    strength: 15 },
    ],
    seed: 0, softBlur: false, invert: false,
  },
  {
    id: "dispatch", name: "Dispatch", system: true,
    profile: "ibm_proprinter",
    brightness: -5, contrast: 20, gamma: 1.3,
    dither: "ordered", threshold: 130,
    ink: [35, 28, 25], paper: [240, 235, 220],
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: false, condensed: false,
    dpi: 300, jitterScale: 1.3, bandingScale: 0.9, maxSize: 8000,
    wearLayers: [
      { pattern: "pin_skip",      strength: 30 },
      { pattern: "misaligned",    strength: 25 },
      { pattern: "ribbon_twist",  strength: 40 },
      { pattern: "ink_starved",   strength: 20 },
    ],
    seed: 7, softBlur: false, invert: false,
  },
  {
    id: "overdriven", name: "Overdriven", system: true,
    profile: "commodore_mps",
    brightness: 10, contrast: 60, gamma: 0.8,
    dither: "ordered", threshold: 100,
    ink: [20, 20, 25], paper: [240, 240, 240],
    paperFormat: "Original", orientation: "Portrait",
    doubleStrike: true, condensed: false,
    dpi: 300, jitterScale: 2.5, bandingScale: 1.8, maxSize: 8000,
    wearLayers: [
      { pattern: "cloudy",        strength: 60 },
      { pattern: "pin_skip",      strength: 45 },
      { pattern: "smudge",        strength: 50 },
      { pattern: "ribbon_twist",  strength: 55 },
      { pattern: "mechanical_resonance", strength: 35 },
    ],
    seed: 13, softBlur: false, invert: false,
  },
];

export const state = {
  profile: "oki_microline",
  dither: "threshold",
  threshold: 128,
  ink: [25, 25, 30],
  paper: [255, 255, 255],
  paperFormat: "Original",
  orientation: "Portrait",
  doubleStrike: false,
  condensed: false,
  brightness: 0,
  contrast: 20,
  gamma: 1.0,
  invert: false,
  dpi: 300,
  jitterScale: 1.0,
  bandingScale: 1.0,
  maxSize: 8000,
  wearLayers: [],
  seed: 0,
  softBlur: false,
  sourceImage: null,
  // v2 math toggle — false = improved math (default), true = v1-compatible
  legacyMath: false,
  // Worker rendering — falls back automatically if OffscreenCanvas missing
  useWorker: true,
  // UI flags (persisted via settings-store)
  autoRender: true,
  uiSounds: true,
  bgAnim: true,
  // ── Appearance (Phase 1: OpenCode Theme System) ────────────────────────────
  theme: "oc-2",               // oc-2, matrix, tokyonight, synthwave, gruvbox
  themeMode: "dark",           // dark, light, auto
  fontSans: "Inter",
  fontSansCustom: "",
  fontMono: "JetBrains Mono",
  fontMonoCustom: "",
  fontTerminal: "JetBrainsMono Nerd Font Mono",
  fontTerminalCustom: "",
  animPattern: "aurora",       // aurora, pulse, orbit, drift, breathe, off
  animSpeed: 50,               // 10-200
  animIntensity: 30,            // 0-100
  animSize: 50,                // 20-100
  // ── Layout (Phase 2 preparation) ───────────────────────────────────────────────
  layout: "classic",           // classic, opencode
  navExpanded: false,
  // ── Version / Changelog ────────────────────────────────────────────────────
  lastSeenVersion: "",
  autoCheckUpdates: true,
};

export const PRESETS = {
  "System Default": {
    profile: "oki_microline", dither: "threshold", threshold: 128, ink: [25,25,30], paper: [255,255,255],
    paperFormat: "Original", orientation: "Portrait", doubleStrike: false, condensed: false,
    brightness: 0, contrast: 20, gamma: 1.0, invert: false, dpi: 300, jitterScale: 1.0, bandingScale: 1.0, maxSize: 8000,
    wear: { cloudy: 0, ghosting: 0, misaligned: 0, pin_skip: 0, smudge: 0, ribbon_twist: 0, ink_bleed: 0, head_drag: 0 }, softBlur: false
  },
  "Rezept": {
    profile: "oki_microline", dither: "ordered", threshold: 128, ink: [25,25,30], paper: [248,245,232],
    paperFormat: "Rezept", orientation: "Landscape", doubleStrike: false, condensed: false,
    brightness: 100, contrast: 100, gamma: 2.0, invert: false, dpi: 300, jitterScale: 0.0, bandingScale: 0.0, maxSize: 8000,
    wear: { cloudy: 0, ghosting: 20, misaligned: 15, pin_skip: 0, smudge: 0, ribbon_twist: 0, ink_bleed: 0, head_drag: 0 }, softBlur: false
  },
  "Heavy Damage": {
    profile: "commodore_mps", dither: "floyd_steinberg", threshold: 128, ink: [25,25,30], paper: [234,223,184],
    paperFormat: "Original", orientation: "Portrait", doubleStrike: false, condensed: false,
    brightness: 10, contrast: 30, gamma: 1.2, invert: false, dpi: 150, jitterScale: 2.5, bandingScale: 2.0, maxSize: 4000,
    wear: { cloudy: 30, ghosting: 40, misaligned: 60, pin_skip: 25, smudge: 50, ribbon_twist: 40, ink_bleed: 20, head_drag: 30 }, softBlur: true
  }
};
