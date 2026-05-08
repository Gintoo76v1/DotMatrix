# DotMatrix Studio

**Browser-basierter Nadeldrucker-Emulator** mit vollständigem Backend, Nutzer-Authentifizierung und Admin-System.

Lädt ein Bild, rendert es als simulierten Dot-Matrix-Druck mit auswählbaren Drucker-Profilen, konfigurierbaren Hardware-Fehlerschichten und persistenten Presets — alles servergestützt mit Login-System.

---

## Features

### Render-Engine
- **10 Drucker-Profile** — Epson FX-80, Epson LQ-850, IBM Proprinter, OKI Microline, Star NX-1000, Panasonic KX-P, DEC LA75, NEC P6, MPS-803, ImageWriter II
- **3 Halftone-Algorithmen** — Floyd-Steinberg (Serpentine-Scan), Ordered Bayer 4×4, Threshold
- **12 Wear-Layer** — Pin-Skip, Cloudy, Ghosting, Smudge, Ribbon-Twist, Head-Gap, Ink-Starved, Paper-Slip, Static, Double-Feed, Resonance, Misaligned — je mit Stärke-Slider
- **OffscreenCanvas Web-Worker** — Render läuft im Hintergrund, UI bleibt responsiv
- **Softening Blur** — optionaler 3×3 Box-Blur nach dem Render

### UI
- **Pan & Zoom** — Pinch-Zoom, Mausrad, Buttons (bis 1000 %)
- **5 Themes** — OC-2, Matrix, Tokyonight, Synthwave, Gruvbox
- **3 individualisierbare Fonts** — UI-Sans, Code-Mono, Terminal-Mono
- **Background-Animation** — Aurora, Pulse, Orbit, Off
- **Changelog-Overlay** — Versionshistorie im Footer abrufbar
- **Click-Sounds** via WebAudio API

### Preset-System
- **6 System-Presets** — Rezept, Photo, Worn Receipt, C64 Label, Crisp, Ghost Doc
- **User-Presets** — YAML-basiert, speichern, exportieren, importieren
- **Versionshistorie** — Snapshots pro Preset abrufbar
- **Offline-First** — IndexedDB-Puffer, Sync-Queue bei Wiederverbindung

### Auth & Backend
- **Invite-Only Registrierung** — Codes mit Rollen, Max-Nutzungen, Ablaufdatum
- **Session-basiertes Login** — 7-Tage Cookies, sicher via express-session + PostgreSQL
- **Rollen-System** — Admin / User mit feingranularen Permissions (RBAC)
- **Admin-Dashboard** — Invite-Verwaltung (kategorisiert), User-Verwaltung, Selbst-Sperren verhindert

---

## Stack

| Schicht | Technologie |
|---|---|
| Frontend | Vanilla JS (ES-Module), kein Framework |
| Backend | Node.js + Express (ES-Module) |
| Datenbank | PostgreSQL via Drizzle ORM |
| Session-Store | connect-pg-simple |
| Datei-Storage | MinIO (S3-kompatibel) |
| Deployment | Docker Compose |
| Reverse Proxy | Caddy |
| Passwort-Hashing | Argon2id |

---

## Deployment (Docker)

```bash
# Starten
docker compose up -d --build

# Logs prüfen
docker compose logs --tail=30

# Update deployen
git pull origin main
docker compose down && docker compose up -d --build
```

### Erstes Setup

```bash
# Admin und initialen Invite-Code anlegen
docker compose exec app node server/scripts/setup.js
```

### Umgebungsvariablen (`.env`)

```env
DATABASE_URL=postgresql://dotmatrix:password@db:5432/dotmatrix
SESSION_SECRET=langer-zufaelliger-string
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=dotmatrix
NODE_ENV=production
PORT=3000
```

---

## Lokale Entwicklung

```bash
npm install
npm run dev        # Backend + Frontend via nodemon
npm test           # Unit-Tests (Vitest)
npm run coverage   # Coverage-Bericht
```

---

## Architektur

```
DotMatrix/
├── server/
│   ├── index.js              Express-App, Trust-Proxy, Static-Serving
│   ├── api/
│   │   ├── auth.js           Login, Register (Argon2id), Logout, /me
│   │   ├── invites.js        Invite-Codes CRUD + Redemption-Info
│   │   ├── users.js          User-Liste, Status-Update (RBAC)
│   │   ├── projects.js       Projekte CRUD, Snapshots
│   │   └── security.js       2FA, API-Keys
│   ├── db/
│   │   ├── schema.js         Drizzle-Schema (users, roles, invites, projects, …)
│   │   └── index.js          DB-Verbindung
│   └── middleware/
│       └── auth.js           requireAuth, requirePermission
│
├── scripts/
│   ├── main.js               App-Einstiegspunkt, Auth-Check, Event-Wiring
│   ├── config.js             Drucker-Profile, System-Presets, State-Defaults
│   ├── engine.js             Render-Pipeline (Host-agnostisch)
│   ├── filters.js            Grayscale, Dither, boxBlur3x3
│   ├── utils.js              RNG, Gauss, smoothstep, clamp, yieldUI
│   ├── sync.js               Offline-Queue, WebSocket-Sync
│   ├── api.js                Frontend-API-Client (fetch-Wrapper)
│   ├── auth-ui.js            Login/Register-Formulare
│   ├── db.js                 IndexedDB (Offline-First)
│   └── ui/
│       ├── admin.js          Admin-Dashboard (Invites, Users)
│       ├── presets.js        Preset-Liste, Import/Export
│       ├── history.js        Projekt-Snapshot-Verlauf
│       ├── changelog.js      Versions-Overlay
│       ├── security.js       2FA, API-Keys UI
│       └── …                 wear, upload, zoom, sliders, audio, …
│
├── index.html                App-Shell
├── login.html                Login-Seite
├── register.html             Registrierung (Invite-Code erforderlich)
├── version.json              Changelog-Daten
└── docker-compose.yml        3 Services: app, db (Postgres), minio
```

---

## Render-Pipeline

```
Bild-Upload
    │
    ▼  toGrayscale()          Luma-First (~3× schneller als v1)
Float32 Grayscale
    │
    ▼  dither()               Floyd-Steinberg | Ordered Bayer | Threshold
Uint8 Dot-Mask
    │
    ▼  engine.render()        Pro Pixel:
                              → Pin-Offset (multi-pass)
                              → 12 Wear-Layer
                              → Gauss-Jitter (mulberry32 RNG)
                              → smoothstep-Interpolation
                              → Stamp-Akkumulation (Float32)
    │
    ▼  composite()            ink × inkColor + (1-ink) × paperColor
    │
    ▼  boxBlur3x3() (opt.)    Softening-Blur bei aktiviertem Schalter
Final ImageData → Canvas
```

---

## Preset-Format (YAML)

```yaml
name: Rezept
profile: epson_lq
brightness: 100
contrast: 0
gamma: 1.5
dither: ordered
ink: [25, 25, 30]
paper: null
paperFormat: Original
orientation: Landscape
dpi: 300
jitterScale: 1.5
bandingScale: 0.0
wearLayers:
  - pattern: cloudy
    strength: 30
  - pattern: ghosting
    strength: 50
```

---

## Tests

```bash
npm test              # 136 Unit- und Integrationstests
npm run test:watch    # Live-Modus
npm run coverage      # mit Coverage-Bericht (>93 % auf Math/Engine)
```

---

## Lizenz

GPL-3.0 — siehe [LICENSE](./LICENSE).

**Author:** Gintoo76v1 · Pro Edition
