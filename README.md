# DotMatrix

Browser-basierter Nadeldrucker-Emulator. Lädt ein Bild oder Text und rendert
es als simulierten Dot-Matrix-Druck mit auswählbarem Drucker-Profil
(Epson FX-80, Epson LQ-850, IBM Proprinter, OKI Microline, NEC P6, …) und
zwölf konfigurierbaren Hardware-Fehlerschichten (Pin-Skip, Ribbon-Twist,
Ghosting, Mechanical-Resonance, …).

## Features

- **10 Drucker-Profile** mit realistischen Pin/DPI/Banding-Charakteristiken
- **3 Halftone-Algorithmen** — Floyd-Steinberg (mit Serpentine-Scan), Ordered (Bayer 4×4), Threshold
- **12 Wear-Layer** — modular kombinierbar, jeweils mit Stärke-Slider
- **OffscreenCanvas Worker** — Render läuft im Hintergrund, UI bleibt responsive
- **Pan & Zoom** — Pinch + Wheel + Buttons, Mikrojitter-Filter gegen "Wackelpudding"
- **Preset-System** — YAML-basiert, Import/Export, User-Presets im LocalStorage
- **Mehrsprachig** (DE / EN), Theme-Akzente, Background-Animation
- **Legacy-Math-Toggle** — v1-kompatible Render-Mathematik für Backwards-Kompatibilität

## Quick Start

```bash
# Lokalen HTTP-Server starten (ES-Modules brauchen ein Origin)
npm run serve     # python3 -m http.server 8080
# Browser: http://localhost:8080
```

## Tests

```bash
npm install                  # einmalig
npm test                     # 136 Unit-/Integrationstests
npm run test:watch           # Live-Modus
npm run coverage             # mit Coverage-Bericht
npm run test:ui              # Vitest-UI im Browser
```

Coverage-Ziele (siehe `vitest.config.js`):

- 70 % Lines / 65 % Branches global
- Aktuell **>93 %** auf den Math/Engine-Modulen

## Architektur

```
js/
├── main.js              Entry point — wires modules, kein UI-Code
├── config.js            Drucker-Profile, Paper-Sizes, System-Presets, default state
├── engine.js            Render-Pipeline (host-agnostisch via createCanvas-Factory)
├── filters.js           Grayscale, Floyd-Steinberg, Ordered, Threshold, Box-Blur
├── utils.js             RNG (mulberry32), Gauss (Box-Muller mit Cache), smoothstep
├── math-mode.js         legacyMath-Toggle: liefert pro Aufruf das passende Math-Set
├── preset-yaml.js       Hand-rolled YAML serializer/parser für das Preset-Schema
├── render-client.js     Wählt Worker- oder Inline-Rendering, Fallback-Logik
├── render-worker.js     Module-Worker, lädt engine.js mit OffscreenCanvas
├── settings-store.js    LocalStorage Persistenz für UI-Flags
├── lang.js              i18n Wörterbücher
└── ui/                  UI-Module (eines pro Bereich)
    ├── error.js         Fehler-Toast + Global-Catcher
    ├── audio.js         WebAudio Click-Sounds
    ├── zoom.js          Pan/Zoom mit Mikrojitter-Filter
    ├── sliders.js       Slider-Registry (state ↔ DOM, mit Inverse-Transform)
    ├── segments.js      Segmented Button Groups
    ├── swatches.js      Farb-Swatches (Ink/Paper) + Custom-Hex
    ├── checks.js        Boolean-Toggles mit Persistenz
    ├── wear.js          Hardware-Fehler-Liste (12 Patterns)
    ├── upload.js        File-Upload + Drag/Drop
    ├── analyze.js       Histogram-Analyse, Auto-Adjust
    ├── presets.js       Preset-Liste, Import/Export
    └── theme.js         Theme/Sprache/BG-Animation
```

## Render-Pipeline

```
Source Image
    │
    ▼ (toGrayscale)            v1 = per-RGB; v2 = Luma-First (~3× schneller)
Float32 Grayscale
    │
    ▼ (dither)                 Floyd-Steinberg (serpentine), Ordered Bayer, Threshold
Uint8 Dot-Mask
    │
    ▼ (engine.render)          Pro On-Pixel:
                               • Pin-Offset (per-Pass)
                               • 12 Wear-Layer (cloudy/ghosting/…)
                               • Gauss-Jitter
                               • Stamp-Akkumulation in Float32 ink-buffer
    │
    ▼ (composite)              ink × inkColor + (1-ink) × paperColor
Final ImageData
    │
    ▼ (boxBlur3x3, optional)
```

## Math Modes

Der `legacyMath`-Toggle (Settings → Math Engine) schaltet zwischen zwei
Render-Pipelines:

| Bereich            | v1 (legacyMath = true)       | v2 (default)                       |
| ------------------ | ---------------------------- | ---------------------------------- |
| Grayscale          | Per-RGB-Channel              | Luma-First (~3× schneller)         |
| Floyd-Steinberg    | Klassisch L→R, Threshold 128 | Serpentine + state.threshold       |
| Row Banding        | Asymmetrisch (`1 - amp·rng`) | Symmetrisch (`1 + amp·(rng-½)·2`)  |
| Ghosting Direction | Per Pin-Reihe                | Per Carriage-Sweep (≈ realistisch) |
| Paper Slip Skala   | Mit `stepY` skaliert         | In Grid-Pixeln (stabil)            |
| Value Noise        | Bilinear                     | Smoothstep (C¹-stetig)             |

## Preset-Format

YAML mit folgenden Top-Level-Keys (Beispiel):

```yaml
name: Rezept
profile: epson_lq
brightness: 100
contrast: 0
gamma: 1.5
dither: ordered
threshold: 255
ink: [25, 25, 30]
paper: null
paperFormat: Original
orientation: Landscape
doubleStrike: false
condensed: false
dpi: 300
jitterScale: 1.5
bandingScale: 0.0
maxSize: 8000
seed: 0
softBlur: false
invert: false
legacyMath: false
wearLayers:
  - pattern: cloudy
    strength: 30
  - pattern: ghosting
    strength: 50
```

## Author

Gintoo76v1 · Pro Edition

## License

Siehe [LICENSE](./LICENSE).
