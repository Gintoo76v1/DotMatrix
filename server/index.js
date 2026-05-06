import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true,
}));

// Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup
const PgSession = connectPgSimple(session);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://dotmatrix:dotmatrixpassword@localhost:5432/dotmatrix',
});

app.use(session({
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'super_secret_fallback_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }
}));

import authRoutes from './api/auth.js';
import invitesRoutes from './api/invites.js';
import rolesRoutes from './api/roles.js';
import projectsRoutes from './api/projects.js';
import settingsRoutes from './api/settings.js';
import usersRoutes from './api/users.js';
import auditRoutes from './api/audit.js';

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

// Start Server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});