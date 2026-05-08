import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Caddy, nginx) for correct IP and HTTPS detection
app.set('trust proxy', 1);

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https://*.amazonaws.com'], // Allow S3/MinIO
        'connect-src': ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      },
    },
  })
);

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true,
  })
);

// Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup
const PgSession = connectPgSimple(session);
const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://dotmatrix:dotmatrixpassword@localhost:5432/dotmatrix',
});

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'super_secret_fallback_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

import authRoutes from './api/auth.js';
import invitesRoutes from './api/invites.js';
import rolesRoutes from './api/roles.js';
import projectsRoutes from './api/projects.js';
import settingsRoutes from './api/settings.js';
import usersRoutes from './api/users.js';
import auditRoutes from './api/audit.js';
import securityRoutes from './api/security.js';
import { WebSocketServer } from 'ws';
import http from 'http';

// Basic Route
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/invites', invitesRoutes);
app.use('/api/v1/roles', rolesRoutes);
app.use('/api/v1/projects', projectsRoutes);
app.use('/api/v1/me/settings', settingsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/security', securityRoutes);

// Root redirect: unauthenticated users go to login, authenticated to app
app.get('/', (req, res) => {
  if (req.session?.userId) {
    res.redirect('/index.html');
  } else {
    res.redirect('/login.html');
  }
});

// Serve static files from project root (fallback if not behind Caddy)
app.use(express.static(ROOT_DIR));

// Create Server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Map(); // userId -> Set of connections

wss.on('connection', (ws, req) => {
  // Simple session parsing from cookie if needed, but for now we rely on a manual auth message
  let currentUserId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'auth') {
        currentUserId = data.userId;
        if (!clients.has(currentUserId)) clients.set(currentUserId, new Set());
        clients.get(currentUserId).add(ws);
      }

      if (data.type === 'sync' && currentUserId) {
        // Broadcast to other devices of the same user
        const userClients = clients.get(currentUserId);
        if (userClients) {
          userClients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: 'update',
                  state: data.state,
                  source: 'remote-device',
                })
              );
            }
          });
        }
      }
    } catch (e) {
      console.error('WS Error', e);
    }
  });

  ws.on('close', () => {
    if (currentUserId && clients.has(currentUserId)) {
      clients.get(currentUserId).delete(ws);
      if (clients.get(currentUserId).size === 0) clients.delete(currentUserId);
    }
  });
});

// Global JSON error handler – muss nach allen Routen stehen.
// Ohne diesen Handler schickt Express bei unbehandelten Fehlern eine HTML-Seite,
// die der Client nicht als JSON parsen kann → "Unknown error" im Frontend.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('[server error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
