# PROJECT MANIFEST

## Projektbeschreibung

DotMatrix Studio ist eine vollwertige Webapplikation (Full-Stack) zur Emulation von Nadeldrucker-Effekten. Die App erlaubt den Upload von Bildern, asynchrones Rendering via Web-Worker und die persistente Speicherung von Projekten (inkl. Quellbildern) in einer Cloud-Infrastruktur.

## Architektur & Datenfluss

- **Frontend**: Vanilla HTML/CSS/JS (ES-Modules). Nutzt **IndexedDB** für Offline-Fähigkeit und einen **Sync-Manager** für die Synchronisation mit dem Backend.
- **Backend**: **Node.js/Express** Server mit REST-API.
- **Persistenz**:
  - Metadaten & User-Settings: **PostgreSQL** (via Drizzle ORM).
  - Session-Management: Server-seitig (in Postgres gespeichert).
  - Bild-Blobs: **S3-kompatibler Object Storage** (MinIO/AWS).
- **Datenfluss**: Client -> Caddy (Reverse Proxy) -> Node.js API -> PostgreSQL / S3.

## Toolchain

- **Frontend**: Kein Bundler. Native ES-Modules.
- **Backend**: Node.js v20+, NPM.
- **Testing**: Vitest (Unit), Playwright (E2E).
- **Deployment**: Docker Compose (App, DB, MinIO) + Caddy.

## Sicherheitskonzept

- **Authentifizierung**: Invite-Only System.
- **RBAC**: Rollenbasiertes Berechtigungssystem (Admin/User).
- **Verschlüsselung**: Argon2id für Passwörter, TLS via Caddy.
- **Sicherheits-Header**: Strikte CSP, HSTS, X-Content-Type-Options.
