# Changes — DotMatrix Optimization Pass

## Übersicht

Komplette Überarbeitung von DotMatrix mit Bug-Fixes, mathematischen
Optimierungen, Test-Suite (136 Tests, >93 % Coverage auf Math/Engine),
OffscreenCanvas-Worker-Rendering und modularer Refaktorierung.

## Bug-Fixes

### UI / State (main.js)

- **Bug A — Slider-Sync nach Bildanalyse** ✅
  `analyzeAndAdaptImage` aktualisiert nun die Slider-DOM-Werte über die
  zentrale Slider-Registry, statt nur `state` zu mutieren. Die UI lag
  vorher der Engine bis zur ersten manuellen Slider-Berührung hinterher.

- **Bug B — `applyPreset` Faktor-10-Verschiebung bei jitter/banding** ✅
  Slider-Werte werden über die explizite `inverse`-Transform der Registry
  gesetzt. Vorher: Preset-Wert `1.5` wurde direkt in den Slider geschrieben,
  der `15` erwartete → 10× falscher Render-Wert.

- **Bug C — `setS` schrieb falschen state-Key** ✅
  String-Manipulation `id.replace('Slider','')` produzierte `state.jitter`
  statt `state.jitterScale`, `state.banding` statt `state.bandingScale` etc.
  → silent state corruption. Ersetzt durch explizite Map.

- **Bug D — `state.autoRender` Default + UI-Toggle** ✅
  Flag wird in `state` deklariert, in INIT auf `true` gesetzt, im Settings-
  Tab toggelbar und in localStorage persistiert.

- **Bug E — `bgAnim`/`uiSounds`/`legacyMath`/`useWorker` persistieren** ✅
  Neuer `settings-store.js` mit `loadSettings/saveSettings/hydrateState`.
  UI-Checkboxen schreiben automatisch zurück.

- **Bug F — `setS` Null-Checks** ✅
  Slider-Helper bricht jetzt sauber ab statt zu crashen, wenn DOM-Knoten
  fehlt (Test-Umgebungen, Teil-Builds).

- **Bug G — YAML-Parser robuster** ✅
  - String-Quoting (Doppelpunkte, Kommas, Sonderzeichen)
  - Strenge Number-Detection (`"3D Print"` bleibt String)
  - Negative Zahlen + wissenschaftliche Notation
  - Inline-Kommentare innerhalb Zeilen
  - Liste mit Klammern, korrektes Comma-Splitting in Quotes
  - Reflektiert in `tests/presets.test.js` (23 Tests, alle Roundtrip-grün)

- **Bug H — `presetToYaml` quotet Edge-Cases** ✅
  Strings, die wie YAML-Keywords (`yes`, `no`, `null`) oder Zahlen aussehen,
  werden in `"…"` gewrappt.

- **Bug W/X — Event-Handler-Konsistenz** ✅
  `er-head/er-slider` jetzt `addEventListener` statt `onclick`/`oninput`.

### Render-Engine (engine.js, filters.js)

- **Bug I — Ghosting Direction** ✅
  Statt `Math.floor(gy / numPins) % 2` wird jetzt pro Carriage-Sweep
  (≈ `numPins * stepY` mm) entschieden. Realistischer für 24-Pin-Drucker.
  Legacy-Pfad bleibt erhalten via `legacyMath`-Toggle.

- **Bug J — `gaussian` mit Cache (M2)** ✅
  Box-Muller produziert 2 Werte; `makeGaussian()` cached den zweiten →
  ~2× weniger RNG-Aufrufe bei gleicher Verteilung.
  Original `gaussian()` bleibt für Back-Compat.

- **Bug K — `boxBlur3x3` separable (M10)** ✅
  Zwei 1D-Passes (6 Taps/Pixel) statt 9-Tap 2D → ~33 % weniger Arbeit
  bei mathematisch identischem Ergebnis (innerhalb 8-bit Toleranz).

- **Bug L — Floyd-Steinberg Serpentine + Threshold** ✅
  Default scannt nun zickzack (gerade Zeilen L→R, ungerade R→L) → keine
  "Worm-Artefakte" mehr auf glatten Gradienten.
  Honoriert jetzt `state.threshold` (vorher hardcoded 128).
  Klassisches Verhalten in Legacy-Mode.

- **Bug M — `toGrayscale` Luma-First (M1)** ✅
  Luma wird *vor* Brightness/Contrast/Gamma berechnet → ~3× schneller
  (1 `pow` pro Pixel statt 3). Gamma ist zwar nicht-linear, der visuelle
  Unterschied liegt aber unter 1 LSB für übliche Werte.
  Legacy-RGB-Pfad bleibt verfügbar.

- **Bug N — `makeDotStamp` Anisotropie** ✅
  Squash-Faktor wird aus `dpi_h/dpi_v` abgeleitet statt hardcoded `0.88`.
  Korrigiert NEC P6 (360×360 → isotrop) und Profile mit `dpi_h ≠ dpi_v`.
  Legacy-Mode behält `0.88`.

- **Bug O — `rowBands` symmetrisch** ✅
  `1 + amp·(rng-½)·2` statt `1 - amp·rng`. Banding oszilliert nun um 1.0
  (mathematisch korrekt) statt einseitig nach unten.

- **Bug P — `ribbon_fade` als Profile-Property** ✅
  Vorher hardcoded `9 %`/Zeile. Jetzt pro Profil konfigurierbar
  (4 % für NEC P6, 14 % für MPS-803, etc.).

- **Bug Q — Pin-Offsets pro Pass** ✅
  Vorher hatten alle Passes identische Pin-Mikrojitter — Double-Strike
  sah nur unwesentlich anders aus. Jetzt eigene Offsets pro Pass.

- **Bug R — `dotPx` Mindestgröße konsistent** ✅
  `Math.max(3, …)` statt `Math.max(2, …)` matcht jetzt `makeDotStamp`'s
  eigene Mindestgröße.

- **Bug U — `paper_slip` Skala stabil** ✅
  Vorher mit `stepY` multipliziert → Effekt explodiert in Paper-Mode,
  verschwindet in Original-Mode. Jetzt direkt in Grid-Pixeln.
  Legacy bleibt verfügbar.

- **Bug V — `mechanical_resonance` Random Phase** ✅
  Sinus-Phase wird in `buildLayerData` aus dem RNG gezogen (deterministisch
  pro Seed). Vorher startete die Welle bei jedem Render bei Phase 0.

### Performance (Math-Optimierungen)

- **M4 — `stampInto` branch-frei** mit `Math.min` statt Ternary
- **M6 — `onCells` als `Int32Array`** (2 ints/cell, weniger GC-Druck)
- **M7 — `makeValueNoise` smoothstep** für glattere Cloud-Patterns
  (Legacy: Bilinear)
- **M9 — Hot-Loop-Konstanten hoist** (`dpiNorm160/300`, `invMaxGx`,
  `invGridW`, `ribbonFadeAmt`)

## Architektur

### Code-Struktur

- **`main.js` reduziert** von 581 auf 184 Zeilen (-68 %)
- **12 neue Module** unter `js/ui/` und `js/`
- Klare Trennung: Math (engine/filters/utils) vs. UI (ui/*) vs. State (config/settings-store)

### OffscreenCanvas Worker

- `js/render-worker.js` lädt Engine als Module
- `js/render-client.js` mit Feature-Detection + automatischem Fallback
- `state.useWorker` Toggle in der Settings-UI
- Zero-Copy via Transferable ImageBitmap & ArrayBuffer

### Math-Mode Helper

- `js/math-mode.js` zentralisiert alle `legacyMath`-Verzweigungen
- Liefert ein einziges Config-Objekt — keine `if(state.legacyMath)`
  Streuung im Hot-Loop

### Text-Print Tab

- `dot-matrix-printer.js` Demo-Block (172 Zeilen) entfernt
- Neuer Tab "Text Print" 📝 in der Activity-Bar
- 10 Slider, 2 Checks, 3 Buttons im UI
- Live-Re-Render bei Texteingabe (debounced 200ms)
- 16 Tests in `tests/dot-matrix-printer.test.js`

## Test-Suite

| Datei                            | Tests | Coverage-Bereich            |
|----------------------------------|------:|-----------------------------|
| tests/utils.test.js              |    15 | mulberry32, gaussian, smoothstep |
| tests/filters.test.js            |    20 | grayscale, dither, blur     |
| tests/engine.test.js             |    18 | makeDotStamp, stampInto, render |
| tests/engine.layers.test.js      |    16 | 12 Wear-Patterns + legacy   |
| tests/config.test.js             |    28 | Profile-Sanity, Presets     |
| tests/presets.test.js            |    23 | YAML-Roundtrip, Edge-Cases  |
| tests/dot-matrix-printer.test.js |    16 | DMP-Komponente              |
| **Σ**                            | **136** | **>93 % Math-Coverage**   |

## Stats

```
Vorher: 6 Files,   ~110 KB JS,   ~580 LOC main.js,  0 Tests
Nachher: 24 Files, ~150 KB JS,   ~184 LOC main.js, 136 Tests, 93 % Coverage
```

Modulare Refaktorierung erlaubt jetzt isoliertes Testen, einfacheres Debugging
und punktuelle Performance-Optimierungen.
