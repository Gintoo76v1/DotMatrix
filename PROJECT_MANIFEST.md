# PROJECT MANIFEST

## Projektbeschreibung
DotMatrix Studio ist ein Vanilla-Web-basierter Emulator für Nadeldrucker-Effekte. Es ermöglicht Nutzern, Bilder hochzuladen, diese mit authentischen Drucker-Artefakten (Dithering, Banding, Wear-Pattern) zu versehen und als PNG zu exportieren. 

## Architektur & Datenfluss
- **Architektur**: Vanilla JS ES-Modules (`type="module"`).
- **Entry Point**: `index.html` → `js/main.js`.
- **Rendering**: Heavy-Lifting ist in einen Web-Worker (`js/render-worker.js`) ausgelagert. Kern-Verarbeitung in `js/engine.js` und `js/filters.js`.
- **State-Management**: Globaler `state` in `js/config.js`. Updates triggern UI-Refreshes (`triggerUpdate()` / Event `dm:triggerRender`).
- **Persistenz**: Browser `localStorage` via `js/settings-store.js` (Sichert Themes, Presets, Settings).
- **Datenformate**: Presets werden als YAML verarbeitet (`js/preset-yaml.js`).

## Toolchain
- **Client**: Vanilla (kein Build-Step, kein Vite/Webpack).
- **Testing**: `vitest` (mit `jsdom` für UI-Smoke-Tests). Test-Coverage via `@vitest/coverage-v8`.
- **Serving**: `python3 -m http.server 8080`.

## Assets & Dependencies
- **CSS**: Eine monolithische Datei: `styles.css`.
- **Fonts**: Lokale Fonts (`JetBrainsMono-Regular.woff2`) + Google Fonts via `<link>` (`Inter`, `Roboto`, `Open Sans`, etc.).
- **NPM-Pakete**: Nur Dev-Dependencies (Vitest, JSDOM). Keine Client-Libraries über NPM.

## Dead Code Kandidaten
- `js/math-mode.js` (Legacy v1 Kompatibilität, potenziell entfernbar, falls Hard-Breaking-Change erlaubt).