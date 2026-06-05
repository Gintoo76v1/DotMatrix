# DotMatrix Studio

**Browser-basierter Nadeldrucker-Emulator** mit Next.js-Backend, Supabase-Auth und Admin-System.

Lädt ein Bild und rendert es als simulierten Dot-Matrix-Druck mit auswählbaren Drucker-Profilen,
konfigurierbaren Hardware-Fehlerschichten und persistenten Presets — servergestützt mit Login.

---

## Features

### Render-Engine
- **10 Drucker-Profile** — Epson FX-80, Epson LQ-850, IBM Proprinter, OKI Microline, Star NX-1000, Panasonic KX-P, DEC LA75, NEC P6, MPS-803, ImageWriter II
- **3 Halftone-Algorithmen** — Floyd-Steinberg (Serpentine-Scan), Ordered Bayer 4×4, Threshold
- **12 Wear-Layer** — Pin-Skip, Cloudy, Ghosting, Smudge, Ribbon-Twist, Head-Gap, Ink-Starved, Paper-Slip, Static, Double-Feed, Resonance, Misaligned — je mit Stärke-Slider
- **Wählbare Druck-Mathematik** — `legacy` / `v1` (Default) / **`v2`** (siehe unten)
- **OffscreenCanvas Web-Worker** — Render läuft im Hintergrund, UI bleibt responsiv
- **Softening Blur** — optionaler 3×3 Box-Blur nach dem Render

### V2-Druckmathematik
Eine dritte, physikalisch genauere Stufe (opt-in über den Selektor „Druck-Mathematik"):
- **Linear-Licht-Compositing** — Tinte wird in linearem Licht über Papier gemischt (sRGB↔linear) statt naivem Gamma-Lerp → korrektes Überlappungs-Verdunkeln.
- **Ink-Sättigungskurve** — Beer-Lambert-artige Deckung (Tinte spreizt beim Aufschlag).
- **Exponentieller Head-Gap-Falloff**, **nichtlinearer Ribbon-Fade**.
- **Nahtloses (tileables) Cloud-Noise** und **DPI-korrekter Paper-Slip**.

`v1` bleibt der Default, damit bestehende Renders unverändert aussehen; `legacy` bildet die
ursprünglich hartkodierte Anisotropie ab.

### UI
- **Pan & Zoom** — Pinch-Zoom, Mausrad, Buttons (bis 1000 %)
- **5 Themes** — OC-2, Matrix, Tokyonight, Synthwave, Gruvbox
- **3 individualisierbare Fonts**, Background-Animation, Changelog-Overlay, Click-Sounds (WebAudio)

### Preset-System
- **System-Presets** + **User-Presets** (YAML, speichern/exportieren/importieren)
- **Snapshots** pro Projekt (Versionshistorie)
- **Offline-First** — IndexedDB-Puffer mit Sync-Queue (Polling) bei Wiederverbindung

### Auth & Backend
- **Invite-Only Registrierung** — Codes mit Rollen, Max-Nutzungen, Ablaufdatum (atomare Vergabe)
- **Supabase Auth** — Session-Cookies via `@supabase/ssr`; optional TOTP-2FA
- **RBAC** — Admin / User mit feingranularen Permissions
- **Admin-Dashboard** — Invite- & User-Verwaltung; Rate-Limiting auf Login/Register

---

## Stack

| Schicht | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Frontend-Engine | Vanilla JS (ES-Module) unter `public/scripts/` |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Datenbank | Supabase Postgres via Drizzle ORM (postgres-js, Transaction-Pooler) |
| Datei-Storage | S3-kompatibel (optional, presigned URLs) |
| Hosting | Vercel (Serverless) — Auto-Deploy bei Push auf `main` |
| Validierung | Zod |

---

## Lokale Entwicklung

```bash
npm install
npm run dev      # Next.js Dev-Server (http://localhost:3000)
npm run build    # Production-Build (typgeprüft + gelintet)
```

### Umgebungsvariablen (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Transaction Pooler (Port 6543) — Laufzeit der App
DATABASE_URL=postgresql://postgres.<ref>:PASSWORD@aws-0-<region>.pooler.supabase.com:6543/postgres
# Direct Connection (Port 5432) — nur für drizzle-kit Migrationen
DIRECT_URL=postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres

# S3 / Storage (optional — ohne diese ist der Upload deaktiviert, kein Default-Fallback)
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET_NAME=dotmatrix-projects
S3_REGION=eu-central-1
```

> `NEXT_PUBLIC_*` landen im Client-Bundle (unkritisch). `SUPABASE_SECRET_KEY` und die
> DB-Passwörter nur als Server-Secrets in Vercel hinterlegen.

---

## Datenbank

Schema: `server/db/schema.js` (Drizzle). Tabellen: `roles`, `permissions`, `role_permissions`,
`users` (Profil; Passwörter verwaltet Supabase Auth), `user_settings`, `api_keys`, `invite_codes`,
`invite_redemptions`, `projects`, `project_snapshots`, `audit_log`, `auth_attempts` (Rate-Limit).

```bash
npm run db:generate   # Migration aus dem Schema erzeugen
npm run db:push       # Schema in die DB pushen (drizzle-kit)
npm run setup:admin   # Rollen + Permissions + Bootstrap-Admin-Invite seeden
```

`setup:admin` gibt einen Invite-Code aus → damit auf `/register` das erste Admin-Konto anlegen.

---

## Deployment (Vercel)

Das GitHub-Repo ist mit einem Vercel-Projekt verbunden: **jeder Push auf `main` deployt
automatisch in Production**. Build: `next build`. Die nötigen Env-Variablen (oben) müssen im
Vercel-Projekt gesetzt sein.

> Hinweis: Ist in den Vercel-Projekteinstellungen **Deployment Protection / Vercel
> Authentication** aktiv, ist die Production-URL nur für Team-Mitglieder erreichbar. Für
> öffentlichen Zugang auf „Only Preview Deployments" stellen oder deaktivieren.

---

## Render-Pipeline

```
Bild-Upload
    │  toGrayscale()      Luma-First; Kontrast geclamped (kein NaN)
    ▼  dither()           Floyd-Steinberg | Ordered Bayer | Threshold
    ▼  engine.render()    Pro „on"-Zelle: Pin-Offset (multi-pass) · 12 Wear-Layer ·
    │                     Gauss-Jitter (mulberry32) · Stamp-Akkumulation (Float32)
    ▼  composite()        v1/legacy: sRGB-Lerp · v2: Linear-Licht + Ink-Sättigung
    ▼  boxBlur3x3() (opt.)
Final ImageData → Canvas
```

---

## Projektstruktur

```
DotMatrix/
├── app/
│   ├── page.tsx · layout.tsx              Root (Redirect → /login bzw. /app)
│   ├── login/ · register/                 Auth-Seiten
│   ├── app/                               Studio-Shell (lädt /public/scripts/main.js)
│   └── api/v1/                            Route Handler (auth, projects, snapshots,
│                                          invites, users, roles, audit, settings,
│                                          security/2fa, security/api-keys, health)
├── lib/
│   ├── db.ts                              Drizzle-Client (postgres-js)
│   ├── auth.ts                            getAuthUser / hasPermission (RBAC)
│   ├── validate.ts · rate-limit.ts        Zod-Helper · Rate-Limiting
│   ├── audit.ts                           Audit-Logging
│   └── supabase/{server,client,admin}.ts  Supabase-Clients
├── middleware.ts                          Session-Refresh + Route-Schutz für /app
├── server/db/schema.js · seed.js          Drizzle-Schema · Seed
├── public/scripts/                        Render-Engine + UI (Vanilla JS, ES-Module)
│   ├── engine.js · filters.js · utils.js · config.js · constants.js
│   ├── render-client.js · render-worker.js · sync.js · db.js · settings-store.js
│   └── ui/                                presets, wear, zoom, security, admin, …
├── next.config.mjs                        Security-Header (CSP/COOP/HSTS) etc.
└── version.json                           Changelog-Daten
```

---

## Lizenz

GPL-3.0 — siehe [LICENSE](./LICENSE).

**Author:** Gintoo76v1 · Pro Edition
