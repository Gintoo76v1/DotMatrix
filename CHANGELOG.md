# Changelog

## v1.3.0 — 2026-05-05

### 🎨 UI & Design (OpenCode Theme-System)

- **5 neue Themes** inspiriert von OpenCode Desktop:
  - **OC-2** — Warmes Peach (`#fab283`) auf Dunkelgrau (`#1C1C1C`). Haupt-Theme.
  - **Matrix** — Neon-Grün (`#00ff41`) auf Schwarz (`#0a0a0a`). Hacker-Terminal-Ästhetik.
  - **Tokyonight** — Blau-Lila (`#7aa2f7`) auf Dunkelblau (`#1a1b26`). Kalt, technisch.
  - **Synthwave** — Neon-Pink/Cyan (`#ff00ff` / `#00ffff`) auf Violett (`#2b213a`). Retro-Neon.
  - **Gruvbox** — Warmes Gelb (`#fabd2f`) auf Braun (`#282828`). Retro, warm.
- **Token-basiertes CSS-Design-System** — 26 Custom Properties pro Theme
  - Surfaces: `surface-base`, `surface-raised`, `surface-overlay`, `surface-hover`
  - Text: `text-strong`, `text-base`, `text-weak`, `text-weaker`
  - Semantic: `primary`, `success`, `warning`, `error`, `info`, `interactive`
  - Borders: `border-base`, `border-hover`, `border-active`
- **3 individualisierbare Fonts**:
  - UI-Schriftart (Sans): Inter, System Sans, SF Pro, Roboto, Open Sans, Custom
  - Code-Schriftart (Mono): JetBrains Mono, Fira Code, Cascadia Code, IBM Plex Mono, Custom
  - Terminal Font: JetBrainsMono Nerd Font Mono, Fira Code, Hack, Custom
  - Custom-Input für jede Font-Kategorie
- **Animation-System** mit 4 Patterns:
  - **Aurora** — Weicher Farbverlauf-Drift mit Filter-Blur (OpenCode-Style)
  - **Pulse** — Subtile Atmung der Hintergrund-Orbs
  - **Orbit** — Sanfte Kreisbewegung
  - **Off** — Statischer Hintergrund
  - Einstellbar: Geschwindigkeit, Intensität, Größe (je Slider 0-100%)

### ⚡ Performance

- **OffscreenCanvas Web-Worker** — Rendering läuft im Hintergrund
  - UI bleibt bei großen Bildern (>4K) responsiv
  - Automatischer Fallback auf Inline-Rendering wenn Worker nicht verfügbar
  - Zero-Copy via Transferable ImageBitmap & ArrayBuffer
- **Math-Optimierungen**:
  - `toGrayscale` Luma-First: ~3× schneller (1 `pow` statt 3 pro Pixel)
  - `gaussian` Box-Muller-Cache: ~2× weniger RNG-Calls
  - `boxBlur3x3` separable: Zwei 1D-Passes statt 9-Tap 2D
  - `stampInto` branch-frei mit `Math.min`
  - `onCells` als `Int32Array` (weniger GC-Druck)

### 🧪 Testing

- **120 Unit-Tests** mit 93% Coverage auf Math/Engine/Config/Presets
  - `mulberry32`: Determinismus, Uniformität, Unkorreliertheit
  - `gaussian`: μ≈0, σ≈1 über 10k Samples, Box-Muller-Cache-Verifikation
  - `toGrayscale`: Weiß→255, Schwarz→0, Gamma, Invert, Clamp
  - `floydSteinberg`: Energieerhaltung, Serpentine vs. Classic, Threshold
  - `orderedDither`: Bayer-Pattern-Korrektheit
  - `boxBlur3x3`: Konstante-Bild unverändert, StdDev-Reduktion
  - `makeDotStamp`: Radial-Symmetrie, Density-Skalierung, Anisotropie
  - `stampInto`: Bounds, Clipping, Akkumulation, Band-Multiplikator
  - `render`: Synthetische Bilder, alle 12 Wear-Patterns, Legacy-Parity
  - `presets`: YAML-Roundtrip für alle SYSTEM_PRESETS, Edge-Cases
  - `config`: Profile-Sanity, Preset-Schema, PAPER_SIZES_MM

### 🔧 Bugfixes

- **13 Render-Engine-Bugs** behoben:
  - Ghosting-Richtung: Carriage-Sweep-basiert statt Pin-Reihe
  - `rowBands` symmetrisch (oszilliert um 1.0 statt einseitig)
  - `makeDotStamp` Anisotropie aus `dpi_h/dpi_v` abgeleitet
  - `paper_slip` Skala in Grid-Pixeln (stabil über Paper-Formate)
  - `mechanical_resonance` Random-Phase pro Rendering
  - `floydSteinberg` Serpentine-Scan + `state.threshold`
  - `toGrayscale` Luma-First (3× schneller, mathematisch äquivalent)
  - Pin-Offsets pro Pass (Double-Strike funktioniert korrekt)
  - `ribbon_fade` als Profile-Property (konfigurierbar)
- **9 UI/State-Bugs** behoben:
  - Slider-Sync nach Bildanalyse (`analyzeAndAdaptImage`)
  - `applyPreset` Faktor-10-Verschiebung bei jitter/banding
  - `setS` schrieb falschen state-Key (String-Manipulation-Fehler)
  - `state.autoRender` Default + UI-Toggle
  - `bgAnim`/`uiSounds`/`legacyMath`/`useWorker` Persistenz
  - `setS` Null-Checks (defensiv für Test-Umgebungen)
  - YAML-Parser: String-Quoting, strenge Number-Detection, Kommentare
  - `presetToYaml` quotet Edge-Cases
  - Event-Handler-Konsistenz (`addEventListener` statt `onclick`)

### 🏗️ Architektur

- `main.js` reduziert von 581 auf ~180 Zeilen (-68%)
- 12 UI-Module unter `js/ui/` (eines pro Bereich)
- `math-mode.js` — Zentralisierter Legacy/Modern-Toggle
- `render-client.js` + `render-worker.js` — Worker-Abstraktion
- `settings-store.js` — LocalStorage Persistenz für alle UI-Flags
- `preset-yaml.js` — Hand-rolled YAML Serializer/Parser

---

## v1.2.0 — 2026-04-20

### 🔧 Bugfixes

- Wear-Layer-Liste scrollbar gemacht (`max-height: 55vh`, `overflow-y: auto`)
- Touch-Scroll-Whitelist erweitert um `.error-container`
- `main.js` in 12 UI-Module aufgesplittet
- YAML-Preset-Parser robuster gemacht
- State-Persistenz via `settings-store.js`
- Math-Mode-Helper für Legacy/Modern-Toggle

---

## v1.1.0 — 2026-03-15

### ✨ Features

- Preset-System mit Import/Export (YAML + JSON)
- User-Presets in localStorage
- Multi-Touch Pinch-Zoom mit Low-Pass-Filter
- UI Click-Sounds via WebAudio API
- Click-Shockwave Animation
- 12 Hardware-Fehler-Layer (Wear-Patterns)

---

## v1.0.0 — 2026-02-01

### 🚀 Release

- 10 Drucker-Profile (Epson FX-80, LQ-850, IBM Proprinter, OKI Microline, etc.)
- 3 Dither-Algorithmen: Floyd-Steinberg, Ordered Bayer 4×4, Threshold
- Dot-Matrix Render-Engine mit Pin-Offset, Jitter, Banding
- Bild-Upload mit Drag & Drop
- Pan & Zoom auf Canvas
- Dark/Light Mode
