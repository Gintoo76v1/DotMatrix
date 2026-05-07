# Changelog

## [1.0.0-rc.1] - 2026-05-06

### Phase 8: UI / UX / Visual Optimization & Accessibility

- **a11y**: Ersetzung aller iterativen `<div onclick>` Elemente (Profile, Checks, Swatches) durch semantische `<button>`-Tags.
- **a11y**: Tastaturnavigierbarkeit via `Tab`, `Space`, `Enter` für alle Kernfunktionen wiederhergestellt.
- **a11y**: ARIA-Attribute (`aria-checked`, `aria-expanded`, `aria-label`) für dynamische UI-States implementiert.
- **style**: "Vibration Shake Color Animation" für das Footer-Logo (Aesthetic Wave).
- **style**: Rahmenüberschneidungen bei aktiven Elementen durch `inset box-shadow` korrigiert.

### Phase 6 & 7: Architecture & Testing

- **refactor**: Ordnerstruktur bereinigt (`js/` → `scripts/`, `styles.css` → `styles/main.css`).
- **test**: E2E-Smoke-Tests via Playwright (`playwright.config.js`, `tests/e2e/smoke.spec.js`) aufgesetzt.
- **test**: Integrationstests mit `jsdom` (`tests/integration.test.js`, `tests/events.test.js`) implementiert.
- **refactor**: Komplettes Entfernen der `math-mode.js` (Legacy-Rendering) zur Drückung der Komplexität.

### Phase 5: Performance

- **perf**: Preloading für lokal gehosteten Font (`JetBrainsMono-Regular.woff2`) hinzugefügt.
- **config**: `Caddyfile.example` mit Caching-Headern (`Cache-Control: immutable`) für statische Assets hinzugefügt.

### Phase 4: Code Quality Upgrade

- **refactor**: Massive Reduktion der "Cyclomatic Complexity" in `engine.js` (Helper wie `_buildPinSkip`, `_buildSmudge` extrahiert).
- **docs**: JSDoc-Kommentare für alle Public Functions in `engine.js` und `filters.js` ergänzt.
- **chore**: Unused Variables, Dead Imports und unnötige RegExp-Escapes eliminiert.

### Phase 3: Bug Hunt

- **fix**: Race Condition beim asynchronen Starten von Web-Workern (`render-client.js`) behoben.
- **perf/fix**: Memory Leak durch nicht abgeräumte `ImageBitmap` Objekte gefixt (`msg.bitmap.close()`).
- **fix**: Klick-Blockade für Touch-Devices (iOS Safari) durch Setzen von `body { position: relative }` und Korrektur der Z-Indices repariert.
- **fix**: TypeError-Absturz beim Einlesen defekter Farbcodes (`!Array.isArray(rgb)`) abgefangen.
- **fix**: Error-Boundary beim Upload korrupter Bilddaten implementiert.

### Phase 1 & 2: Static Analysis & Security

- **chore**: Setup von ESLint, Prettier und Stylelint. Alle Dateien formatiert.
- **security**: XSS-Schutz beim Auslesen von Preset-Namen (`escapeHTML`) implementiert.
- **security**: `Content-Security-Policy` (CSP) Header für den Client ergänzt (`script-src 'self' 'unsafe-inline'`).
