require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const CRM_PORT = process.env.PORT || process.env.CRM_PORT || 5000;

// DB path — prioritize DATA_DIR if configured (e.g. Render Persistent Disk), then local database.db
const dataDir = process.env.DATA_DIR || '';
const defaultDbPath = dataDir
  ? path.join(dataDir, 'database.db')
  : (fs.existsSync(path.join(__dirname, 'database.db'))
    ? path.join(__dirname, 'database.db')
    : (fs.existsSync(path.join(__dirname, '../../backend/database.db'))
      ? path.join(__dirname, '../../backend/database.db')
      : path.join(__dirname, 'database.db')));
const DB_PATH = process.env.DB_PATH || defaultDbPath;
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Ensure upload directories exist
const uploadsRoot = process.env.UPLOADS_DIR || (dataDir ? path.join(dataDir, 'uploads') : path.join(__dirname, 'uploads'));
const audioUploadDir = path.join(uploadsRoot, 'crm-audio');
const callUploadDir = path.join(uploadsRoot, 'crm-calls');
[audioUploadDir, callUploadDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Middlewares & Permissive CORS configuration
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.options('*', (req, res) => res.status(200).end());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsRoot));

// Connect to shared SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[CRM Server] Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log(`[CRM Server] Connected to database at ${DB_PATH}`);
});

// Mount CRM routes — pass db instance
const { router: crmRouter, initCrmDb } = require('./crm.routes');
initCrmDb(db);
app.use(crmRouter);

// Serve built React CRM frontend (if built in ../frontend/dist)
const frontendDistDir = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistDir)) {
  app.use('/crm', express.static(frontendDistDir));
  app.get(['/crm', '/crm/*'], (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    const indexHtml = path.join(frontendDistDir, 'index.html');
    if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
    next();
  });
  app.get(['/login', '/login/'], (req, res) => res.redirect('/crm/login'));
}

// Healthcheck & Root status endpoint
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    service: 'Walk The Plan CRM API',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  if ((req.headers.accept || '').includes('text/html') && fs.existsSync(frontendDistDir)) {
    return res.redirect('/crm/');
  }
  res.status(200).json({
    status: 'online',
    service: 'Walk The Plan CRM API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      authMe: '/api/crm/auth/me',
      login: '/api/crm/auth/login'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `CRM route '${req.originalUrl}' does not exist on this server.`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File too large.' });
    return res.status(400).json({ message: 'Upload error: ' + (err.message || 'Unknown') });
  }
  if (err) {
    console.error('[CRM Server] Unhandled error:', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error.' });
  }
  next();
});

if (require.main === module) {
  app.listen(CRM_PORT, '0.0.0.0', () => {
    console.log(`[CRM Server] Running on http://0.0.0.0:${CRM_PORT}`);
  });
}

module.exports = { app, db };

