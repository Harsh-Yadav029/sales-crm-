// ═══════════════════════════════════════════════════════════════════════════════
// Walk The plan — B2B Sales CRM Routes
// Auth + RBAC + Lead Management + Bulk Upload + Call Logging + Audio + Signaling
// ═══════════════════════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { parseLeadSpreadsheet, sanitizeLeadObject, isInvalidClientName, cleanPhoneNumber, cleanEmail, normalizeStatus } = require('./crm-lead.parser');
const { extractSpreadsheetId, fetchSheetData, proposeAutoMapping, syncGoogleSheetToCRM } = require('./crm-google-sheets.service');

const JWT_SECRET = process.env.JWT_SECRET || 'walk_the_plan_crm_secret_key_2026';

// ─── DB Schema Init ───────────────────────────────────────────────────────────
function initCrmDb(db) {
  // CRM Leads table
  db.run(`CREATE TABLE IF NOT EXISTS crm_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT,
      source TEXT,
      status TEXT DEFAULT 'new',
      priority TEXT DEFAULT 'medium',
      assigned_to TEXT,
      notes TEXT,
      city TEXT,
      state TEXT,
      budget TEXT,
      requirement TEXT,
      follow_up_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      audio_url TEXT,
      tags TEXT,
      lead_category TEXT DEFAULT 'meta',
      meta_platform TEXT,
      floor_plan_status TEXT,
      plot_size TEXT,
      meta_ad_name TEXT,
      meta_campaign_name TEXT,
      studio_location TEXT,
      package_service TEXT,
      payment_status TEXT,
      token_paid REAL DEFAULT 0,
      balance_pending REAL DEFAULT 0,
      razorpay_id TEXT,
      inquiry_details TEXT
    )`, (err) => {
      if (err) console.error('[CRM] Error creating crm_leads table:', err.message);
      else console.log('[CRM] crm_leads table ready.');
    });

    // CRM Users table
    db.run(`CREATE TABLE IF NOT EXISTS crm_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'agent',
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      avatar_color TEXT
    )`, (err) => {
      if (err) {
        console.error('[CRM] Error creating crm_users table:', err.message);
      } else {
        console.log('[CRM] crm_users table ready.');
        // Seed default admin if none exists
        db.get('SELECT COUNT(*) as count FROM crm_users', (countErr, row) => {
          if (!countErr && (!row || row.count === 0)) {
            const hash = bcrypt.hashSync('walk@321', 10);
            db.run(
              'INSERT INTO crm_users (name, email, role, password_hash, is_active, department) VALUES (?, ?, ?, ?, 1, ?)',
              ['Admin', 'admin@walktheplan.in', 'admin', hash, 'Management']
            );
            console.log('[CRM] Seeded default administrator (admin@walktheplan.in / walk@321).');
          } else {
            // Ensure admin@walktheplan.in specifically exists
            db.get('SELECT id FROM crm_users WHERE email = ?', ['admin@walktheplan.in'], (adminErr, adminRow) => {
              if (!adminErr && !adminRow) {
                const hash = bcrypt.hashSync('walk@321', 10);
                db.run(
                  'INSERT INTO crm_users (name, email, role, password_hash, is_active, department) VALUES (?, ?, ?, ?, 1, ?)',
                  ['Admin', 'admin@walktheplan.in', 'admin', hash, 'Management']
                );
                console.log('[CRM] Seeded administrator (admin@walktheplan.in / walk@321).');
              }
            });
          }
        });
      }
    });

    // Ensure assigned_pipeline column in crm_users
    db.run("ALTER TABLE crm_users ADD COLUMN assigned_pipeline TEXT DEFAULT 'pre_sales'", (err) => {
      // Ignore duplicate column error
    });

    // Safe migration: add department column if it doesn't exist
    const leadCols = [
      'lead_category TEXT DEFAULT "meta"',
      'meta_platform TEXT',
      'floor_plan_status TEXT',
      'plot_size TEXT',
      'meta_ad_name TEXT',
      'meta_campaign_name TEXT',
      'studio_location TEXT',
      'package_service TEXT',
      'payment_status TEXT',
      'token_paid REAL DEFAULT 0',
      'balance_pending REAL DEFAULT 0',
      'razorpay_id TEXT',
      'inquiry_details TEXT',
      'follow_up_time TEXT',
      'follow_up_status TEXT DEFAULT "pending"',
      'follow_up_notes TEXT',
      'pipeline_stage TEXT DEFAULT "pre_sales"',
      'presales_notes TEXT',
      'presales_notes_by TEXT',
      'presales_notes_at TEXT',
      'mainsales_notes TEXT',
      'mainsales_notes_by TEXT',
      'mainsales_notes_at TEXT',
      'postsales_notes TEXT',
      'postsales_notes_by TEXT',
      'postsales_notes_at TEXT'
    ];
    leadCols.forEach(col => {
      db.run(`ALTER TABLE crm_leads ADD COLUMN ${col}`, () => {});
    });
    db.run(`UPDATE crm_leads SET pipeline_stage = 'pre_sales' WHERE pipeline_stage IS NULL OR pipeline_stage = ''`, () => {});
    db.run(`ALTER TABLE crm_users ADD COLUMN avatar_color TEXT`, () => {});
    db.run(`ALTER TABLE crm_users ADD COLUMN department TEXT`, () => {
      // Ignore error — column may already exist
    });

    // Lead activity log with append-only interaction types
    db.run(`CREATE TABLE IF NOT EXISTS crm_lead_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      user_id INTEGER,
      action TEXT,
      note TEXT,
      interaction_type TEXT DEFAULT 'General Note',
      author_name TEXT,
      author_role TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('[CRM] Error creating crm_lead_activities table:', err.message);
      else {
        console.log('[CRM] crm_lead_activities table ready.');
        db.run("ALTER TABLE crm_lead_activities ADD COLUMN interaction_type TEXT DEFAULT 'General Note'", () => {});
        db.run("ALTER TABLE crm_lead_activities ADD COLUMN author_name TEXT", () => {});
        db.run("ALTER TABLE crm_lead_activities ADD COLUMN author_role TEXT", () => {});
      }
    });

    // Call logs table — stores WebRTC/browser call metadata & recording paths
    db.run(`CREATE TABLE IF NOT EXISTS crm_call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      caller_id INTEGER,
      caller_name TEXT,
      direction TEXT DEFAULT 'outbound',
      status TEXT DEFAULT 'completed',
      duration_seconds INTEGER DEFAULT 0,
      recording_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('[CRM] Error creating crm_call_logs table:', err.message);
      else console.log('[CRM] crm_call_logs table ready.');
    });

    // Google Sheets Direct Sync Config Table
    db.run(`CREATE TABLE IF NOT EXISTS crm_google_sheets_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      is_active INTEGER DEFAULT 0,
      auth_type TEXT DEFAULT 'direct_url',
      google_account_email TEXT,
      spreadsheet_id TEXT,
      spreadsheet_name TEXT,
      sheet_name TEXT,
      api_key TEXT,
      column_mapping TEXT,
      sync_interval_minutes INTEGER DEFAULT 5,
      last_synced_row INTEGER DEFAULT 1,
      last_sync_at DATETIME,
      last_sync_status TEXT DEFAULT 'idle',
      last_sync_error TEXT,
      total_synced_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('[CRM] Error creating crm_google_sheets_config table:', err.message);
      else console.log('[CRM] crm_google_sheets_config table ready.');
    });

    // Google Sheets Sync Audit Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS crm_google_sheets_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT DEFAULT 'manual',
      synced_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('[CRM] Error creating crm_google_sheets_sync_logs table:', err.message);
      else console.log('[CRM] crm_google_sheets_sync_logs table ready.');
    });

    // SQLite concurrency hardening pragma
    db.run("PRAGMA busy_timeout = 5000;", () => {});
}

function getTodayIST(offsetDays = 0) {
  const istStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (!offsetDays) return istStr;
  const [y, m, d] = istStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().split('T')[0];
}

// ─── Hardened Auth Middleware ─────────────────────────────────────────────────
// Strictly enforces JWT — rejects all unauthenticated requests with 401
async function crmAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const allowQueryToken = req.method === 'GET' && req.path.startsWith('/api/crm/backup/');
  const queryToken = allowQueryToken && typeof req.query.token === 'string' ? req.query.token : null;
  if (!authHeader && !queryToken) {
    return res.status(401).json({ message: 'Unauthorized: No token provided.' });
  }
  const token = authHeader
    ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader)
    : queryToken;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (req.crmDb && decoded?.id) {
      const liveUser = await dbGet(
        req.crmDb,
        'SELECT id, name, email, role, department, assigned_pipeline, is_active FROM crm_users WHERE id = ?',
        [decoded.id]
      ).catch(() => null);
      if (liveUser) {
        if (liveUser.is_active === 0) {
          return res.status(401).json({ message: 'Unauthorized: Account deactivated.' });
        }
        req.user = {
          ...decoded,
          name: liveUser.name || decoded.name,
          email: liveUser.email || decoded.email,
          role: liveUser.role || decoded.role,
          department: liveUser.department ?? decoded.department,
          assigned_pipeline: liveUser.assigned_pipeline || decoded.assigned_pipeline
        };
        return next();
      }
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token.' });
  }
}

// ─── Role-Based Access Control Middleware ─────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
    const userRole = (req.user.role || '').toLowerCase();
    if (userRole === 'admin' || roles.includes(req.user.role) || roles.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ message: `Forbidden: Requires role: ${roles.join(' or ')}.` });
  };
}

// ─── RBAC Role Helpers ────────────────────────────────────────────────────────
const isSalesExec = (u) => {
  if (!u) return false;
  const r = (u.role || '').toLowerCase();
  const p = (u.assigned_pipeline || '').toLowerCase();
  if (r === 'admin' || r === 'manager' || p === 'all') return false;
  const d = (u.department || '').toLowerCase();
  return ['sales', 'agent', 'field_agent', 'sales_engineer', 'pre_sales', 'main_sales', 'post_sales'].includes(r) || d.includes('sales');
};

const isMarketing = (u) => {
  if (!u) return false;
  if (u.role === 'admin' || u.role === 'manager') return false;
  const r = (u.role || '').toLowerCase();
  const d = (u.department || '').toLowerCase();
  return r === 'marketing' || d === 'marketing';
};

const isAdminOrManager = (u) => {
  if (!u) return false;
  return u.role === 'admin' || u.role === 'manager' || u.assigned_pipeline === 'all';
};

const getUserPipelineRole = (u) => {
  if (!u) return 'pre_sales';
  const r = (u.role || '').toLowerCase();
  const d = (u.department || '').toLowerCase();
  const p = (u.assigned_pipeline || '').toLowerCase();
  if (r === 'admin' || r === 'manager' || p === 'all') return 'all';
  if (p === 'pre_sales' || p === 'main_sales' || p === 'post_sales') return p;
  if (d.includes('post') || r.includes('post')) return 'post_sales';
  if (d.includes('main') || r.includes('main') || r === 'sales' || r === 'agent') return 'main_sales';
  return 'pre_sales';
};


// ─── Avatar Colors ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#3949AB',
  '#1E88E5', '#00897B', '#43A047', '#FB8C00'
];
function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// ─── DB helpers (promisified) ──────────────────────────────────────────────────
let _db = null;

router.use((req, res, next) => {
  if (!_db) {
    const sqlite3 = require('sqlite3').verbose();
    const dataDir = process.env.DATA_DIR || '';
    const defaultDbPath = dataDir
      ? path.join(dataDir, 'database.db')
      : (fs.existsSync(path.join(__dirname, 'database.db'))
        ? path.join(__dirname, 'database.db')
        : (fs.existsSync(path.join(__dirname, '../../backend/database.db'))
          ? path.join(__dirname, '../../backend/database.db')
          : path.join(__dirname, 'database.db')));
    const dbPath = process.env.DB_PATH || defaultDbPath;
    _db = new sqlite3.Database(dbPath);
  }
  req.crmDb = _db;
  next();
});

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ─── Multer Storage ───────────────────────────────────────────────────────────

const UPLOADS_ROOT = process.env.UPLOADS_DIR || (process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'uploads') : path.join(__dirname, 'uploads'));

function resolveUploadDiskPath(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null;
  const rel = mediaUrl.replace(/^\/+uploads\/+/, '').replace(/^\/+/, '');
  const resolved = path.resolve(UPLOADS_ROOT, rel);
  const rootResolved = path.resolve(UPLOADS_ROOT);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) return null;
  return resolved;
}

function removeUploadFile(mediaUrl) {
  const filePath = resolveUploadDiskPath(mediaUrl);
  if (filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) { }
  }
}

// Audio notes storage (attached to leads)
const crmAudioDir = path.join(UPLOADS_ROOT, 'crm-audio');
if (!fs.existsSync(crmAudioDir)) fs.mkdirSync(crmAudioDir, { recursive: true });

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, crmAudioDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `lead-${req.params.id || 'rec'}-${Date.now()}${ext}`);
  }
});
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => cb(null, true)
});

// Call recording storage (WebRTC call recordings)
const crmCallsDir = path.join(UPLOADS_ROOT, 'crm-calls');
if (!fs.existsSync(crmCallsDir)) fs.mkdirSync(crmCallsDir, { recursive: true });

const callRecordingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, crmCallsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `call-${req.params.id || 'rec'}-${Date.now()}${ext}`);
  }
});
const callRecordingUpload = multer({
  storage: callRecordingStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB for call recordings
  fileFilter: (req, file, cb) => cb(null, true)
});

// CSV/Excel upload (in-memory)
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });


// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/crm/auth/login
router.post('/api/crm/auth/login', async (req, res) => {
  const db = req.crmDb;
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await dbGet(
      db,
      'SELECT * FROM crm_users WHERE email = ? AND is_active = 1',
      [email.trim().toLowerCase()]
    );
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const assignedPipeline = user.assigned_pipeline || getUserPipelineRole(user);
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      assigned_pipeline: assignedPipeline,
      avatar_color: user.avatar_color,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_color: user.avatar_color,
        department: user.department,
        assigned_pipeline: assignedPipeline,
      }
    });
  } catch (err) {
    console.error('[CRM] POST /api/crm/auth/login error:', err.message);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// GET /api/crm/auth/me
router.get('/api/crm/auth/me', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const user = await dbGet(
      db,
      'SELECT id, name, email, phone, role, is_active, avatar_color, department, assigned_pipeline, created_at FROM crm_users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) {
    console.error('[CRM] GET /api/crm/auth/me error:', err.message);
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// CRM USER ROUTES (no delete — only create, read, update/deactivate)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/crm/users — create CRM user (Admin only)
router.post('/api/crm/users', crmAuth, requireRole('admin'), async (req, res) => {
  const db = req.crmDb;
  try {
    const { name, email, phone, role, password, department, assigned_pipeline } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required.' });
    }
    const existing = await dbGet(db, 'SELECT id FROM crm_users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) return res.status(409).json({ message: 'Email already registered.' });

    const roleVal = role || 'agent';
    const pipelineVal = assigned_pipeline || (
      (roleVal === 'admin' || roleVal === 'manager') ? 'all' :
      roleVal === 'main_sales' ? 'main_sales' :
      roleVal === 'post_sales' ? 'post_sales' : 'pre_sales'
    );
    const password_hash = await bcrypt.hash(password, 10);
    const avatar_color = randomAvatarColor();
    const result = await dbRun(
      db,
      `INSERT INTO crm_users (name, email, phone, role, password_hash, avatar_color, department, assigned_pipeline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email.trim().toLowerCase(), phone || null, roleVal, password_hash, avatar_color, department || null, pipelineVal]
    );
    res.status(201).json({ id: result.lastID, name, email, role: roleVal, avatar_color, assigned_pipeline: pipelineVal });
  } catch (err) {
    console.error('[CRM] POST /api/crm/users error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/users — list all CRM users
router.get('/api/crm/users', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const users = await dbAll(
      db,
      `SELECT id, name, email, phone, role, is_active, avatar_color, department, assigned_pipeline, created_at
       FROM crm_users ORDER BY id DESC`
    );
    res.json({ users });
  } catch (err) {
    console.error('[CRM] GET /api/crm/users error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/crm/users/:id — update user (Admin only; deactivate is the only "removal")
router.put('/api/crm/users/:id', crmAuth, requireRole('admin'), async (req, res) => {
  const db = req.crmDb;
  try {
    const { name, phone, role, is_active, department, assigned_pipeline } = req.body;
    const pipelineVal = assigned_pipeline !== undefined
      ? assigned_pipeline
      : ((role === 'admin' || role === 'manager') ? 'all' :
        role === 'main_sales' ? 'main_sales' :
        role === 'post_sales' ? 'post_sales' :
        role === 'pre_sales' ? 'pre_sales' : null);
    const result = await dbRun(
      db,
      `UPDATE crm_users
       SET name              = COALESCE(?, name),
           phone             = COALESCE(?, phone),
           role              = COALESCE(?, role),
           is_active         = COALESCE(?, is_active),
           department        = COALESCE(?, department),
           assigned_pipeline = COALESCE(?, assigned_pipeline)
       WHERE id = ?`,
      [name || null, phone || null, role || null,
      is_active != null ? is_active : null,
      department || null, pipelineVal, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User updated.' });
  } catch (err) {
    console.error('[CRM] PUT /api/crm/users/:id error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/crm/users/:id/password — change user password (Admin only)
router.put('/api/crm/users/:id/password', crmAuth, requireRole('admin'), async (req, res) => {
  const db = req.crmDb;
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const result = await dbRun(
      db,
      'UPDATE crm_users SET password_hash = ? WHERE id = ?',
      [password_hash, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'Password updated.' });
  } catch (err) {
    console.error('[CRM] PUT /api/crm/users/:id/password error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/crm/users/:id — delete user account (Admin only)
router.delete('/api/crm/users/:id', crmAuth, requireRole('admin'), async (req, res) => {
  const db = req.crmDb;
  try {
    const targetId = parseInt(req.params.id, 10);
    if (req.user && req.user.id === targetId) {
      return res.status(400).json({ message: 'Cannot delete your own active administrator account.' });
    }
    const targetUser = await dbGet(db, 'SELECT id, name, email FROM crm_users WHERE id = ?', [targetId]);
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });

    // Clean up references in leads and call logs (assigned_to can store id, name, or email)
    await dbRun(
      db,
      'UPDATE crm_leads SET assigned_to = NULL WHERE assigned_to = ? OR assigned_to = ? OR assigned_to = ?',
      [String(targetId), targetUser.name || '', targetUser.email || '']
    );
    await dbRun(db, 'UPDATE crm_call_logs SET caller_id = NULL WHERE caller_id = ?', [targetId]);

    await dbRun(db, 'DELETE FROM crm_users WHERE id = ?', [targetId]);
    res.json({ success: true, message: `User "${targetUser.name}" (${targetUser.email}) removed successfully.` });
  } catch (err) {
    console.error('[CRM] DELETE /api/crm/users/:id error:', err.message);
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// CRM LEAD ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/crm/leads — paginated list with filters
router.get('/api/crm/leads', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    const search = req.query.search || '';
    const assigned_to = req.query.assigned_to || '';
    const priority = req.query.priority || '';
    const source = req.query.source || '';
    const pipeline_stage = req.query.pipeline_stage || '';
    const lead_category = req.query.lead_category || '';
    const start_date = req.query.start_date || '';
    const end_date = req.query.end_date || '';

    const conditions = [];
    const params = [];

    // Pipeline Stage filter (pre_sales vs main_sales vs post_sales)
    if (pipeline_stage && pipeline_stage !== 'all') {
      if (pipeline_stage === 'pre_sales') {
        conditions.push('(pipeline_stage = "pre_sales" OR pipeline_stage IS NULL OR pipeline_stage = "")');
      } else {
        conditions.push('pipeline_stage = ?');
        params.push(pipeline_stage);
      }
    }

    // Category filter (meta vs google_sheets)
    if (lead_category && lead_category !== 'all') {
      if (lead_category === 'google_sheets' || lead_category === 'sheets' || lead_category === 'website') {
        conditions.push('(lead_category = "google_sheets" OR lead_category = "sheets" OR LOWER(source) LIKE "%sheet%" OR LOWER(source) LIKE "%google%")');
      } else if (lead_category === 'meta') {
        conditions.push('(lead_category = "meta" OR LOWER(source) LIKE "%meta%" OR LOWER(source) LIKE "%facebook%" OR LOWER(source) LIKE "%instagram%")');
      } else {
        conditions.push('lead_category = ?');
        params.push(lead_category);
      }
    }

    // Date range filter
    if (start_date) {
      conditions.push('date(created_at) >= date(?)');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('date(created_at) <= date(?)');
      params.push(end_date);
    }

    if (assigned_to) {
      conditions.push('assigned_to = ?');
      params.push(assigned_to);
    }

    if (status) {
      if (status === 'Blank Lead' || status === 'Live Sheet Lead') {
        conditions.push('(status IS NULL OR status = "" OR status NOT IN ("Hot Lead", "Warm Lead", "Interested", "Cold Lead"))');
      } else if (status === 'Warm Lead') {
        conditions.push('(status = "Warm Lead" OR status = "Interested")');
      } else if (status.includes(',')) {
        const parts = status.split(',').map(s => s.trim()).filter(Boolean);
        const placeholders = parts.map(() => '?').join(',');
        conditions.push(`status IN (${placeholders})`);
        params.push(...parts);
      } else {
        conditions.push('status = ?');
        params.push(status);
      }
    }
    if (priority) { conditions.push('priority = ?'); params.push(priority); }
    if (source) { conditions.push('source = ?'); params.push(source); }
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR city LIKE ? OR plot_size LIKE ? OR requirement LIKE ? OR meta_ad_name LIKE ? OR meta_campaign_name LIKE ? OR studio_location LIKE ? OR source LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like, like, like, like, like);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const totalRow = await dbGet(db, `SELECT COUNT(*) as total FROM crm_leads ${where}`, params);
    const total = totalRow ? totalRow.total : 0;
    const pages = Math.ceil(total / limit);

    const leads = await dbAll(
      db,
      `SELECT * FROM crm_leads ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ leads, total, pages, page, limit });
  } catch (err) {
    console.error('[CRM] GET /api/crm/leads error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/crm/leads — create lead manually
router.post('/api/crm/leads', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Marketing personnel have View-Only access.' });
    }

    const {
      name, email, phone, source, status, priority, assigned_to, notes,
      city, state, budget, requirement, follow_up_date, follow_up_time, follow_up_notes, follow_up_status, tags,
      lead_category, meta_platform, floor_plan_status, plot_size,
      studio_location, package_service, payment_status, token_paid, balance_pending, razorpay_id, inquiry_details,
      pipeline_stage
    } = req.body;

    const userPipe = getUserPipelineRole(req.user);
    const validStages = ['pre_sales', 'main_sales', 'post_sales'];
    const targetPipelineStage = userPipe === 'all'
      ? (validStages.includes(pipeline_stage) ? pipeline_stage : 'pre_sales')
      : userPipe;

    const nowISO = new Date().toISOString();
    const result = await dbRun(
      db,
      `INSERT INTO crm_leads
         (name, email, phone, source, status, priority, assigned_to, notes,
          city, state, budget, requirement, follow_up_date, follow_up_time, follow_up_notes, follow_up_status, tags,
          lead_category, meta_platform, floor_plan_status, plot_size,
          studio_location, package_service, payment_status, token_paid, balance_pending, razorpay_id, inquiry_details, pipeline_stage, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name || null, email || null, phone || null, source || null,
        status ? normalizeStatus(status) : 'Blank Lead', priority || 'medium', assigned_to || null,
        notes || null, city || null, state || null, budget || null,
        requirement || null, follow_up_date || null, follow_up_time || null, follow_up_notes || null, follow_up_status || 'pending', tags || null,
        lead_category || 'meta', meta_platform || null, floor_plan_status || null, plot_size || null,
        studio_location || null, package_service || null, payment_status || null,
        token_paid || 0, balance_pending || 0, razorpay_id || null, inquiry_details || null,
        targetPipelineStage,
        nowISO
      ]
    );
    if (follow_up_date && result.lastID) {
      await dbRun(
        db,
        `INSERT INTO crm_lead_activities (lead_id, user_id, action, note, interaction_type, author_name, author_role, created_at)
         VALUES (?, ?, 'followup_scheduled', ?, 'General Note', ?, ?, ?)`,
        [
          result.lastID,
          req.user.id || null,
          `Follow-up scheduled for ${follow_up_date}${follow_up_time ? ' at ' + follow_up_time : ''}. ${follow_up_notes || ''}`.trim(),
          req.user.name || 'Sales Representative',
          req.user.role || 'sales',
          nowISO
        ]
      );
    }
    const createdLead = await dbGet(db, 'SELECT * FROM crm_leads WHERE id = ?', [result.lastID]);
    res.status(201).json({ id: result.lastID, lead: createdLead, message: 'Lead created successfully.' });
  } catch (err) {
    console.error('[CRM] POST /api/crm/leads error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/leads/:id — get single numeric lead record (skipping named sub-routes)
router.get('/api/crm/leads/:id', (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next('route');
  return next();
}, crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const lead = await dbGet(db, 'SELECT * FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    res.json({ lead, ...lead });
  } catch (err) {
    console.error('[CRM] GET /api/crm/leads/:id error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/crm/leads/:id — update lead
router.put('/api/crm/leads/:id', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Marketing personnel have View-Only access.' });
    }

    // Cross-section role access guard:
    // Pre-Sales, Main Sales, and Post-Sales members have full edit access to their assigned pipeline section,
    // and View-Only access to the other two sections.
    // Admin / Manager / users with assigned_pipeline === 'all' have full access across all sections.
    const existingLead = await dbGet(db, 'SELECT id, status, pipeline_stage, assigned_to FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!existingLead) return res.status(404).json({ message: 'Lead not found.' });

    const userDept = (req.user?.department || '').toLowerCase();
    const userRole = (req.user?.role || '').toLowerCase();
    const userPipe = (req.user?.assigned_pipeline || '').toLowerCase();
    const currentLeadStage = existingLead.pipeline_stage || 'pre_sales';
    const isMasterAdmin = userRole === 'admin' || userRole === 'manager' || userPipe === 'all';

    if (!isMasterAdmin) {
      const userAssigned = (userPipe && userPipe !== 'all') ? userPipe : (
        (userDept.includes('post') || userRole.includes('post')) ? 'post_sales' :
        (userDept.includes('main') || userRole.includes('main') || userRole === 'sales' || userRole === 'agent') ? 'main_sales' :
        'pre_sales'
      );

      if (userAssigned === 'pre_sales' && currentLeadStage !== 'pre_sales') {
        return res.status(403).json({ message: 'View-Only access: Pre-Sales personnel cannot edit Main Sales or Post-Sales leads.' });
      }
      if (userAssigned === 'main_sales' && currentLeadStage !== 'main_sales') {
        return res.status(403).json({ message: 'View-Only access: Main Sales personnel cannot edit Pre-Sales or Post-Sales leads.' });
      }
      if (userAssigned === 'post_sales' && currentLeadStage !== 'post_sales') {
        return res.status(403).json({ message: 'View-Only access: Post-Sales personnel cannot edit Pre-Sales or Main Sales leads.' });
      }
    }

    const fields = [
      'name', 'email', 'phone', 'source', 'status', 'priority',
      'assigned_to', 'notes', 'city', 'state', 'budget',
      'requirement', 'follow_up_date', 'follow_up_time', 'follow_up_notes', 'follow_up_status', 'tags',
      'lead_category', 'meta_platform', 'floor_plan_status', 'plot_size',
      'meta_ad_name', 'meta_campaign_name',
      'studio_location', 'package_service', 'payment_status', 'token_paid',
      'balance_pending', 'razorpay_id', 'inquiry_details', 'pipeline_stage'
    ];
    const setClauses = [];
    const params = [];
    let newStatusVal = null;
    let newStageVal = null;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        // Sales executives cannot reassign leads to another agent
        if (f === 'assigned_to' && isSalesExec(req.user)) continue;
        let val = req.body[f];
        if (f === 'status' && val) {
          val = normalizeStatus(val);
          newStatusVal = val;
        }
        if (f === 'pipeline_stage' && val) {
          newStageVal = val;
        }
        setClauses.push(`${f} = ?`);
        params.push(val);
      }
    }
    if (!setClauses.length) return res.status(400).json({ message: 'No fields to update.' });
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    await dbRun(db, `UPDATE crm_leads SET ${setClauses.join(', ')} WHERE id = ?`, params);

    const nowISO = new Date().toISOString();
    if (newStatusVal && newStatusVal !== existingLead.status) {
      await dbRun(
        db,
        `INSERT INTO crm_lead_activities (lead_id, user_id, action, note, interaction_type, author_name, author_role, created_at)
         VALUES (?, ?, 'status_changed', ?, 'General Note', ?, ?, ?)`,
        [
          req.params.id,
          req.user.id || null,
          `Status changed from "${existingLead.status || 'Blank Lead'}" to "${newStatusVal}".`,
          req.user.name || 'Sales Representative',
          req.user.role || 'sales',
          nowISO
        ]
      );
    }
    if (newStageVal && newStageVal !== currentLeadStage) {
      await dbRun(
        db,
        `INSERT INTO crm_lead_activities (lead_id, user_id, action, note, interaction_type, author_name, author_role, created_at)
         VALUES (?, ?, 'pipeline_moved', ?, 'General Note', ?, ?, ?)`,
        [
          req.params.id,
          req.user.id || null,
          `Moved pipeline stage from "${currentLeadStage}" to "${newStageVal}".`,
          req.user.name || 'Sales Representative',
          req.user.role || 'sales',
          nowISO
        ]
      );
    }

    const updatedLead = await dbGet(db, 'SELECT * FROM crm_leads WHERE id = ?', [req.params.id]);
    res.json({ success: true, lead: updatedLead, message: 'Lead updated successfully.' });
  } catch (err) {
    console.error('[CRM] PUT /api/crm/leads/:id error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/leads/meta-webhook & google-webhook — Webhook Challenge verification
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'walktheplan_meta_secret_2026';
const handleWebhookChallenge = (req, res, title) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.challenge']) {
    const token = req.query['hub.verify_token'];
    if (token !== META_VERIFY_TOKEN) {
      return res.status(403).json({ message: 'Invalid hub.verify_token.' });
    }
    return res.send(req.query['hub.challenge']);
  }
  res.json({ status: 'active', message: `${title} Live & Ready` });
};

router.get('/api/crm/leads/meta-webhook', (req, res) => handleWebhookChallenge(req, res, 'Meta Ads Webhook Endpoint'));
router.get(['/api/crm/leads/google-webhook', '/api/crm/leads/sheets-webhook'], (req, res) => handleWebhookChallenge(req, res, 'Google Sheets Live Sync Webhook'));

// Ingest live leads from Meta Ads Manager / Google Sheets / Zapier / Make
const handleIncomingLeadWebhook = async (req, res, defaultCategory = null) => {
  const db = req.crmDb;
  try {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.challenge']) {
      const token = req.query['hub.verify_token'];
      if (token !== META_VERIFY_TOKEN) {
        return res.status(403).json({ message: 'Invalid hub.verify_token.' });
      }
      return res.send(req.query['hub.challenge']);
    }

    if (process.env.WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Unauthorized webhook secret.' });
    }

    const payload = req.body || {};

    // 1. Timestamp handling: ISO string format (new Date().toISOString())
    let created_at = new Date().toISOString();
    const rawCreated = payload.created_at || payload.created_time || payload.createdTime || payload.timestamp;
    if (rawCreated) {
      const parsed = new Date(rawCreated);
      if (!isNaN(parsed.getTime())) {
        created_at = parsed.toISOString();
      }
    }

    // 2. Email extraction with heuristic fallback
    let email = payload.email || payload.email_address || payload.emailAddress || payload.mail || null;
    if (email) email = cleanEmail(email);
    if (!email) {
      for (const val of Object.values(payload)) {
        if (typeof val === 'string' && val.includes('@')) {
          const detected = cleanEmail(val);
          if (detected) { email = detected; break; }
        }
      }
    }

    // 3. Phone extraction with heuristic fallback
    let phone = payload.phone_number || payload.phone || payload.phoneNumber || payload.mobile || payload.contact || null;
    if (phone) phone = cleanPhoneNumber(phone);
    if (!phone) {
      for (const val of Object.values(payload)) {
        if (!val) continue;
        const s = String(val).replace(/^(tel:|p:|ph:)/i, '').trim();
        if (s.includes('@')) continue;
        const digits = s.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 15) {
          phone = cleanPhoneNumber(s);
          if (phone) break;
        }
      }
    }

    // 4. Human Name extraction: prioritize exact client identifiers & filter non-client words
    let rawName = payload.full_name || payload.fullname || payload.client_name || payload.customer_name || payload.name || null;
    if (isInvalidClientName(rawName)) {
      rawName = null;
    }

    // If still null, search other keys/values in payload
    if (!rawName) {
      for (const [k, v] of Object.entries(payload)) {
        if (!v || typeof v !== 'string') continue;
        const val = v.trim();
        const keyNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (['adname', 'adsetname', 'campaignname', 'formname', 'studioname', 'filename', 'pagename', 'platform', 'status', 'plotsize', 'floorplan'].some(nck => keyNorm.includes(nck))) continue;
        if (keyNorm.includes('email') || keyNorm.includes('phone') || keyNorm.includes('city') || keyNorm.includes('date')) continue;

        if (!isInvalidClientName(val) && val.length >= 2 && val.length <= 60 && !val.includes('\n')) {
          rawName = val;
          break;
        }
      }
    }

    // 5. City extraction
    let city = payload.city || payload.location || payload.town || payload.district || null;
    if (city && isInvalidClientName(city)) city = null;
    if (!city) {
      for (const [k, v] of Object.entries(payload)) {
        if (!v || typeof v !== 'string') continue;
        const keyNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (keyNorm.includes('city') || keyNorm.includes('location')) {
          city = v.trim();
          break;
        }
      }
    }

    // 6. Platform, source & category detection
    const rawPlatform = String(payload.platform || payload.meta_platform || '').toLowerCase();
    const rawSource = String(payload.source || '').toLowerCase();
    const userAgent = String(req.headers['user-agent'] || '').toLowerCase();

    const isGoogleSheet = Boolean(
      defaultCategory === 'google_sheets' ||
      payload.lead_category === 'google_sheets' ||
      payload.lead_category === 'sheets' ||
      rawPlatform.includes('sheet') ||
      rawPlatform.includes('google') ||
      rawSource.includes('sheet') ||
      rawSource.includes('google') ||
      userAgent.includes('google-apps-script') ||
      payload.sheet_name ||
      payload.spreadsheet_id
    );

    const platform = isGoogleSheet
      ? 'Google Sheets'
      : ((rawPlatform.includes('fb') || rawPlatform.includes('facebook')) ? 'fb' : 'ig');

    const lead_category = isGoogleSheet ? 'google_sheets' : (payload.lead_category || 'meta');
    const source = payload.source || (isGoogleSheet ? 'Google Sheet Live Sync' : `Meta Ads (${platform.toUpperCase()})`);
    const name = rawName || (phone ? `${isGoogleSheet ? 'Google Sheet' : 'Meta'} Lead (${phone})` : (email ? `${isGoogleSheet ? 'Google Sheet' : 'Meta'} Lead (${email.split('@')[0]})` : (isGoogleSheet ? 'New Google Sheet Lead' : 'New Meta Lead')));

    // 7. Deduplicate against existing CRM leads by normalized phone or email
    if (phone || email) {
      const dupConds = [];
      const dupParams = [];
      if (phone) {
        const cleanDigits = String(phone).replace(/\D/g, '');
        if (cleanDigits.length >= 10) {
          dupConds.push("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '') LIKE ?");
          dupParams.push(`%${cleanDigits.slice(-10)}`);
        } else if (cleanDigits.length >= 6) {
          dupConds.push("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '') = ?");
          dupParams.push(cleanDigits);
        }
      }
      if (email) {
        dupConds.push('LOWER(email) = LOWER(?)');
        dupParams.push(email);
      }
      if (dupConds.length > 0) {
        const existingLead = await dbGet(
          db,
          `SELECT id, name, email, phone, city, source, lead_category, created_at FROM crm_leads WHERE ${dupConds.join(' OR ')} LIMIT 1`,
          dupParams
        );
        if (existingLead) {
          return res.status(200).json({
            success: true,
            duplicate: true,
            id: existingLead.id,
            message: 'Duplicate lead skipped (already exists in CRM).',
            lead: existingLead
          });
        }
      }
    }

    const floor_plan_status = payload['what_is_your_floor_plan_status_?'] || payload.floor_plan_status || payload.floorplan || null;
    const plot_size = payload['what_is_your_plot_size_?'] || payload.plot_size || payload.plotsize || null;
    const ad_name = payload.ad_name || payload.ad_id || payload.adname || (isGoogleSheet ? 'Google Sheet Live Sync' : 'Meta Ad Campaign');
    const campaign_name = payload.campaign_name || payload.campaign_id || payload.campaignname || (isGoogleSheet ? 'Google Leads Sheet' : 'Walk The Plan 1:1');
    const status = payload.status ? normalizeStatus(payload.status) : 'Pending';
    const notes = payload.notes || null;
    const pipeline_stage = payload.pipeline_stage || 'pre_sales';

    const result = await dbRun(
      db,
      `INSERT INTO crm_leads 
        (name, email, phone, city, source, status, lead_category, meta_platform, floor_plan_status, plot_size, meta_ad_name, meta_campaign_name, notes, pipeline_stage, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone, city, source, status, lead_category, platform, floor_plan_status, plot_size, ad_name, campaign_name, notes, pipeline_stage, created_at]
    );

    res.status(201).json({
      success: true,
      id: result.lastID,
      message: isGoogleSheet ? 'Google Sheet Lead ingested successfully.' : 'Meta Lead ingested successfully.',
      lead: { id: result.lastID, name, email, phone, city, source, lead_category, platform, pipeline_stage, created_at }
    });
  } catch (err) {
    console.error('[CRM Webhook] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/crm/leads/meta-webhook — Ingest live leads from Meta Ads Manager / Google Sheets
router.post('/api/crm/leads/meta-webhook', (req, res) => handleIncomingLeadWebhook(req, res));
router.post(['/api/crm/leads/google-webhook', '/api/crm/leads/sheets-webhook'], (req, res) => handleIncomingLeadWebhook(req, res, 'google_sheets'));

// GET /api/crm/hr/stats — Human Resources Department Staff Analytics
router.get('/api/crm/hr/stats', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const totalRow = await dbGet(db, 'SELECT COUNT(*) as total FROM crm_users WHERE is_active = 1');
    const deptRows = await dbAll(db, `
      SELECT department, COUNT(*) as count 
      FROM crm_users 
      WHERE is_active = 1 
      GROUP BY department
    `);

    const departmentBreakdown = {
      sales: 0,
      marketing: 0,
      operations: 0,
      hr: 0,
      finance: 0,
      franchise: 0,
      management: 0
    };

    for (const r of deptRows) {
      const d = (r.department || '').toLowerCase();
      if (d.includes('sales')) departmentBreakdown.sales += r.count;
      else if (d.includes('market')) departmentBreakdown.marketing += r.count;
      else if (d.includes('operat')) departmentBreakdown.operations += r.count;
      else if (d.includes('hr') || d.includes('human')) departmentBreakdown.hr += r.count;
      else if (d.includes('finan')) departmentBreakdown.finance += r.count;
      else if (d.includes('franch')) departmentBreakdown.franchise += r.count;
      else departmentBreakdown.management += r.count;
    }

    const employees = await dbAll(
      db,
      'SELECT id, name, email, phone, role, department, is_active, created_at FROM crm_users ORDER BY department ASC, name ASC'
    );

    res.json({
      totalEmployees: totalRow ? totalRow.total : 0,
      departmentBreakdown,
      employees
    });
  } catch (err) {
    console.error('[CRM] GET /api/crm/hr/stats error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/crm/leads/:id — admin/manager only (deletes lead and associated audio files)
router.delete('/api/crm/leads/:id', crmAuth, requireRole('admin', 'manager'), async (req, res) => {
  const db = req.crmDb;
  try {
    const lead = await dbGet(db, 'SELECT id, audio_url FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });

    // Clean up attached audio file from disk
    if (lead.audio_url) {
      removeUploadFile(lead.audio_url);
    }

    // Clean up associated call recordings from disk
    const calls = await dbAll(db, 'SELECT id, recording_url FROM crm_call_logs WHERE lead_id = ?', [req.params.id]);
    for (const c of (calls || [])) {
      if (c.recording_url) {
        removeUploadFile(c.recording_url);
      }
    }

    await dbRun(db, 'DELETE FROM crm_call_logs WHERE lead_id = ?', [req.params.id]);
    await dbRun(db, 'DELETE FROM crm_lead_activities WHERE lead_id = ?', [req.params.id]);
    const result = await dbRun(db, 'DELETE FROM crm_leads WHERE id = ?', [req.params.id]);

    if (result.changes === 0) return res.status(404).json({ message: 'Lead not found.' });
    res.json({ success: true, message: 'Lead and associated audio files deleted successfully.' });
  } catch (err) {
    console.error('[CRM] DELETE /api/crm/leads/:id error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/crm/leads/bulk-delete — admin/manager only
router.post('/api/crm/leads/bulk-delete', crmAuth, requireRole('admin', 'manager'), async (req, res) => {
  const db = req.crmDb;
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array required.' });
    }
    let deleted = 0;
    for (const id of ids) {
      const lead = await dbGet(db, 'SELECT id, audio_url FROM crm_leads WHERE id = ?', [id]);
      if (lead) {
        if (lead.audio_url) {
          removeUploadFile(lead.audio_url);
        }
        const calls = await dbAll(db, 'SELECT id, recording_url FROM crm_call_logs WHERE lead_id = ?', [id]);
        for (const c of (calls || [])) {
          if (c.recording_url) {
            removeUploadFile(c.recording_url);
          }
        }
        await dbRun(db, 'DELETE FROM crm_call_logs WHERE lead_id = ?', [id]);
        await dbRun(db, 'DELETE FROM crm_lead_activities WHERE lead_id = ?', [id]);
        await dbRun(db, 'DELETE FROM crm_leads WHERE id = ?', [id]);
        deleted++;
      }
    }
    res.json({ success: true, deleted, message: `Successfully deleted ${deleted} lead(s) and their audio.` });
  } catch (err) {
    console.error('[CRM] bulk delete leads error:', err.message);
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// BULK LEAD UPLOAD (CSV / Excel / JSON)
// ═══════════════════════════════════════════════════════════════════════════════

const handleLeadUpload = async (req, res) => {
  const db = req.crmDb;

  // Marketing and Sales executives cannot bulk upload (Admin / Manager only)
  if (isMarketing(req.user) || isSalesExec(req.user)) {
    return res.status(403).json({ message: 'Forbidden: Mass data import is restricted to Administrators and Managers.' });
  }

  let leadsToInsert = [];
  let parseErrors = [];

  try {
    const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    // ── Excel (.xlsx, .xls) / CSV / TSV file upload path ──
    if (uploadedFile) {
      const parsed = parseLeadSpreadsheet(uploadedFile.buffer, uploadedFile.originalname);
      leadsToInsert = parsed.leads || [];
      parseErrors = parsed.errors || [];
    }
    // ── JSON body path ──
    else if (req.body && (req.body.leads || Array.isArray(req.body) || req.body.name)) {
      let rawList = req.body.leads || req.body;
      if (typeof rawList === 'string') {
        try {
          rawList = JSON.parse(rawList);
        } catch {
          return res.status(400).json({ message: 'Invalid JSON in leads field.' });
        }
      }
      if (!Array.isArray(rawList)) {
        rawList = [rawList];
      }
      leadsToInsert = rawList.map(sanitizeLeadObject).filter(Boolean);
    } else {
      return res.status(400).json({ message: 'Provide an Excel (.xlsx/.xls) or CSV spreadsheet, or JSON leads array.' });
    }

    if (leadsToInsert.length === 0) {
      return res.status(400).json({
        message: 'No valid leads found in upload. Please ensure your file has at least Name, Phone, or Email columns.',
        parseErrors
      });
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    const toPhoneKey = (p) => {
      if (!p) return '';
      const digits = String(p).replace(/\D/g, '');
      if (digits.length >= 10) return digits.slice(-10);
      return digits.length >= 6 ? digits : '';
    };

    const existingRows = await dbAll(db, 'SELECT phone, email FROM crm_leads');
    const seenPhones = new Set();
    const seenEmails = new Set();
    for (const row of (existingRows || [])) {
      const pk = toPhoneKey(row.phone);
      if (pk) seenPhones.add(pk);
      if (row.email) seenEmails.add(String(row.email).trim().toLowerCase());
    }

    const stmt = db.prepare(
      `INSERT INTO crm_leads (
        name, email, phone, source, city, state, budget, requirement, status, priority, notes, follow_up_date, assigned_to,
        lead_category, meta_platform, floor_plan_status, plot_size, meta_ad_name, meta_campaign_name, studio_location, package_service, payment_status, token_paid, balance_pending, razorpay_id, pipeline_stage, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // Wrap inserts in a SQLite transaction for fast and safe execution
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => (err ? reject(err) : resolve()));
    });

    try {
      for (const lead of leadsToInsert) {
        if (!lead.name && !lead.phone && !lead.email) {
          skipped++;
          continue;
        }

        const phoneKey = toPhoneKey(lead.phone);
        const emailKey = lead.email ? String(lead.email).trim().toLowerCase() : '';
        if ((phoneKey && seenPhones.has(phoneKey)) || (emailKey && seenEmails.has(emailKey))) {
          skipped++;
          continue;
        }

        try {
          await new Promise((resolve, reject) => {
            stmt.run([
              lead.name || null,
              lead.email || null,
              lead.phone || null,
              lead.source || 'Bulk Upload',
              lead.city || null,
              lead.state || null,
              lead.budget || null,
              lead.requirement || null,
              lead.status ? normalizeStatus(lead.status) : 'Pending',
              lead.priority || 'medium',
              lead.notes || null,
              lead.follow_up_date || null,
              lead.assigned_to || null,
              lead.lead_category || 'meta',
              lead.meta_platform || null,
              lead.floor_plan_status || null,
              lead.plot_size || null,
              lead.meta_ad_name || null,
              lead.meta_campaign_name || null,
              lead.studio_location || null,
              lead.package_service || null,
              lead.payment_status || null,
              lead.token_paid || 0,
              lead.balance_pending || 0,
              lead.razorpay_id || null,
              lead.pipeline_stage || 'pre_sales',
              lead.created_at || new Date().toISOString()
            ], function (err) {
              if (err) reject(err);
              else resolve();
            });
          });
          if (phoneKey) seenPhones.add(phoneKey);
          if (emailKey) seenEmails.add(emailKey);
          inserted++;
        } catch (e) {
          skipped++;
          errors.push({ lead: lead.name || lead.email || lead.phone, error: e.message });
        }
      }

      await new Promise((resolve, reject) => {
        db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
      });
    } catch (txErr) {
      await new Promise((resolve) => db.run('ROLLBACK', () => resolve()));
      throw txErr;
    } finally {
      stmt.finalize();
    }

    res.json({
      success: true,
      inserted,
      skipped,
      errors,
      total: leadsToInsert.length,
      message: `Successfully imported ${inserted} lead(s).`
    });
  } catch (err) {
    console.error('[CRM] upload error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

router.post('/api/crm/leads/upload', crmAuth, csvUpload.any(), handleLeadUpload);
router.post('/api/crm/leads/bulk-upload', crmAuth, csvUpload.any(), handleLeadUpload);


// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO NOTES (attached to individual leads)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/crm/leads/:id/audio
router.post('/api/crm/leads/:id/audio', crmAuth, audioUpload.any(), async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'Forbidden: View-Only accounts cannot attach audio.' });
    }
    const file = req.file || (req.files && req.files[0]);
    if (!file) return res.status(400).json({ message: 'No audio file uploaded.' });
    const lead = await dbGet(db, 'SELECT id, pipeline_stage, audio_url FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    const userPipe = getUserPipelineRole(req.user);
    const leadStage = lead.pipeline_stage || 'pre_sales';
    if (userPipe !== 'all' && userPipe !== leadStage) {
      return res.status(403).json({ message: 'View-Only access: Cannot attach audio to leads outside your assigned pipeline.' });
    }

    // Remove old audio file if it exists
    if (lead.audio_url) {
      removeUploadFile(lead.audio_url);
    }

    const audio_url = `/uploads/crm-audio/${file.filename}`;
    await dbRun(db, 'UPDATE crm_leads SET audio_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [audio_url, req.params.id]);
    res.json({ audio_url, message: 'Audio note attached to lead.' });
  } catch (err) {
    console.error('[CRM] POST audio note error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/leads/:id/audio
router.get('/api/crm/leads/:id/audio', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const lead = await dbGet(db, 'SELECT id, name, audio_url, updated_at FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    const recordings = lead.audio_url ? [{
      id: lead.id,
      lead_id: lead.id,
      lead_name: lead.name,
      url: lead.audio_url,
      name: `Audio Note — ${lead.name || 'Lead #' + lead.id}`,
      created_at: lead.updated_at,
    }] : [];
    res.json({ audio_url: lead.audio_url, recordings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/audio — all audio notes across all leads (isolated by role)
router.get('/api/crm/audio', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.json([]);
    }
    const conditions = ['audio_url IS NOT NULL', 'audio_url != ""'];
    const params = [];
    if (!isAdminOrManager(req.user)) {
      const userPipe = getUserPipelineRole(req.user);
      if (userPipe && userPipe !== 'all') {
        conditions.push("COALESCE(NULLIF(pipeline_stage, ''), 'pre_sales') = ?");
        params.push(userPipe);
      }
    }
    const where = 'WHERE ' + conditions.join(' AND ');
    const rows = await dbAll(
      db,
      `SELECT id, name, phone, email, pipeline_stage, audio_url, updated_at FROM crm_leads ${where} ORDER BY updated_at DESC`,
      params
    );
    const recordings = (rows || []).map(r => ({
      id: r.id,
      lead_id: r.id,
      lead_name: r.name,
      lead_phone: r.phone,
      pipeline_stage: r.pipeline_stage || 'pre_sales',
      url: r.audio_url,
      name: `Audio Note — ${r.name || 'Lead #' + r.id}`,
      created_at: r.updated_at,
    }));
    res.json(recordings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/crm/leads/:id/audio
router.delete('/api/crm/leads/:id/audio', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Marketing accounts cannot delete audio.' });
    }
    const lead = await dbGet(db, 'SELECT id, pipeline_stage, audio_url FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    const userPipe = getUserPipelineRole(req.user);
    const leadStage = lead.pipeline_stage || 'pre_sales';
    if (userPipe !== 'all' && userPipe !== leadStage) {
      return res.status(403).json({ message: 'View-Only access: Cannot delete audio for leads outside your assigned pipeline.' });
    }
    if (lead.audio_url) {
      removeUploadFile(lead.audio_url);
    }
    await dbRun(db, 'UPDATE crm_leads SET audio_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Audio note removed.' });
  } catch (err) {
    console.error('[CRM] DELETE audio error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/crm/audio/:id
router.delete('/api/crm/audio/:id', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Marketing accounts cannot delete audio.' });
    }
    const lead = await dbGet(db, 'SELECT id, pipeline_stage, audio_url FROM crm_leads WHERE id = ?', [req.params.id]);
    if (lead) {
      const userPipe = getUserPipelineRole(req.user);
      const leadStage = lead.pipeline_stage || 'pre_sales';
      if (userPipe !== 'all' && userPipe !== leadStage) {
        return res.status(403).json({ message: 'View-Only access: Cannot delete audio for leads outside your assigned pipeline.' });
      }
      if (lead.audio_url) {
        removeUploadFile(lead.audio_url);
        await dbRun(db, 'UPDATE crm_leads SET audio_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      }
    }
    res.json({ success: true, message: 'Audio removed.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/crm/audio/bulk-delete — delete multiple audio notes (Admin / Manager)
router.post('/api/crm/audio/bulk-delete', crmAuth, requireRole('admin', 'manager'), async (req, res) => {
  const db = req.crmDb;
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'ids array required.' });
    let deleted = 0;
    for (const id of ids) {
      const lead = await dbGet(db, 'SELECT id, audio_url FROM crm_leads WHERE id = ?', [id]);
      if (lead && lead.audio_url) {
        removeUploadFile(lead.audio_url);
        await dbRun(db, 'UPDATE crm_leads SET audio_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        deleted++;
      }
    }
    res.json({ success: true, deleted, message: `Deleted ${deleted} audio note(s).` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// CALL LOGS (WebRTC browser-based calls)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/crm/calls — log a call
router.post('/api/crm/calls', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Marketing personnel cannot log calls.' });
    }
    const { lead_id, direction, status, duration_seconds, notes } = req.body;
    const result = await dbRun(
      db,
      `INSERT INTO crm_call_logs (lead_id, caller_id, caller_name, direction, status, duration_seconds, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lead_id || null,
        req.user.id,
        req.user.name,
        direction || 'outbound',
        status || 'completed',
        duration_seconds || 0,
        notes || null,
        new Date().toISOString()
      ]
    );
    res.status(201).json({ id: result.lastID, message: 'Call logged.' });
  } catch (err) {
    console.error('[CRM] POST /api/crm/calls error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/calls — paginated call log
router.get('/api/crm/calls', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const lead_id = req.query.lead_id || '';

    const conditions = [];
    const params = [];

    // Sales executives only see their own calls
    if (isSalesExec(req.user)) {
      conditions.push('(c.caller_id = ? OR c.caller_name = ?)');
      params.push(req.user.id, req.user.name || '');
    } else if (isMarketing(req.user)) {
      return res.json({ calls: [], total: 0, pages: 0, page: 1, limit });
    }
    if (lead_id) { conditions.push('c.lead_id = ?'); params.push(lead_id); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const totalRow = await dbGet(db, `SELECT COUNT(*) as total FROM crm_call_logs c ${where}`, params);
    const total = totalRow ? totalRow.total : 0;
    const pages = Math.ceil(total / limit);

    const calls = await dbAll(
      db,
      `SELECT c.*, l.name as lead_name, l.phone as lead_phone, l.email as lead_email
       FROM crm_call_logs c
       LEFT JOIN crm_leads l ON l.id = c.lead_id
       ${where}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ calls, total, pages, page, limit });
  } catch (err) {
    console.error('[CRM] GET /api/crm/calls error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/calls/:id — single call
router.get('/api/crm/calls/:id', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const call = await dbGet(
      db,
      `SELECT c.*, l.name as lead_name, l.phone as lead_phone
       FROM crm_call_logs c LEFT JOIN crm_leads l ON l.id = c.lead_id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!call) return res.status(404).json({ message: 'Call not found.' });
    res.json({ call });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/crm/calls/:id/recording — upload WebRTC call recording to VPS disk
router.post('/api/crm/calls/:id/recording', crmAuth, callRecordingUpload.any(), async (req, res) => {
  const db = req.crmDb;
  try {
    const file = req.file || (req.files && req.files[0]);
    if (!file) return res.status(400).json({ message: 'No recording file uploaded.' });

    const call = await dbGet(db, 'SELECT id FROM crm_call_logs WHERE id = ?', [req.params.id]);
    if (!call) return res.status(404).json({ message: 'Call log not found.' });

    const recording_url = `/uploads/crm-calls/${file.filename}`;
    await dbRun(
      db,
      'UPDATE crm_call_logs SET recording_url = ? WHERE id = ?',
      [recording_url, req.params.id]
    );
    res.json({ recording_url, message: 'Call recording saved to VPS.' });
  } catch (err) {
    console.error('[CRM] POST call recording error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/calls/:id/recording
router.get('/api/crm/calls/:id/recording', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const call = await dbGet(db, 'SELECT * FROM crm_call_logs WHERE id = ?', [req.params.id]);
    if (!call) return res.status(404).json({ message: 'Call not found.' });
    res.json({ recording_url: call.recording_url, call });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/crm/calls/:id — update call (e.g. final duration after call ends)
router.put('/api/crm/calls/:id', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const { status, duration_seconds, notes } = req.body;
    await dbRun(
      db,
      `UPDATE crm_call_logs
       SET status           = COALESCE(?, status),
           duration_seconds = COALESCE(?, duration_seconds),
           notes            = COALESCE(?, notes)
       WHERE id = ?`,
      [status || null, duration_seconds != null ? duration_seconds : null, notes || null, req.params.id]
    );
    res.json({ message: 'Call updated.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/crm/calls/:id/recording — delete call audio recording from VPS (Admin / Manager)
router.delete('/api/crm/calls/:id/recording', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const call = await dbGet(db, 'SELECT id, caller_id, recording_url FROM crm_call_logs WHERE id = ?', [req.params.id]);
    if (!call) return res.status(404).json({ message: 'Call log not found.' });

    // Allow admin, manager, or the caller
    if (isMarketing(req.user)) return res.status(403).json({ message: 'Forbidden: Marketing cannot delete recordings.' });
    if (isSalesExec(req.user) && call.caller_id !== req.user.id && call.caller_name !== req.user.name) {
      return res.status(403).json({ message: 'Forbidden: Agents can only delete their own call recordings.' });
    }

    if (call.recording_url) {
      removeUploadFile(call.recording_url);
      await dbRun(db, 'UPDATE crm_call_logs SET recording_url = NULL WHERE id = ?', [req.params.id]);
    }
    res.json({ success: true, message: 'Call recording deleted from VPS.' });
  } catch (err) {
    console.error('[CRM] DELETE call recording error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/crm/calls/:id — delete call log record & recording (Admin / Manager)
router.delete('/api/crm/calls/:id', crmAuth, requireRole('admin', 'manager'), async (req, res) => {
  const db = req.crmDb;
  try {
    const call = await dbGet(db, 'SELECT id, recording_url FROM crm_call_logs WHERE id = ?', [req.params.id]);
    if (!call) return res.status(404).json({ message: 'Call log not found.' });

    if (call.recording_url) {
      removeUploadFile(call.recording_url);
    }
    await dbRun(db, 'DELETE FROM crm_call_logs WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Call log and audio recording deleted.' });
  } catch (err) {
    console.error('[CRM] DELETE call log error:', err.message);
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// WEBRTC SIGNALING (in-memory, polling-based — no external ws dependency)
// For production upgrade, replace with WebSocket-based signaling via `ws` package
// ═══════════════════════════════════════════════════════════════════════════════

const signalingRooms = {};

// POST /api/crm/signal/offer — caller posts SDP offer
router.post('/api/crm/signal/offer', crmAuth, (req, res) => {
  const { room_id, sdp } = req.body;
  if (!room_id || !sdp) return res.status(400).json({ message: 'room_id and sdp required' });
  signalingRooms[room_id] = {
    offer: sdp,
    offer_candidates: [],
    answer: null,
    answer_candidates: [],
    created_at: Date.now(),
  };
  res.json({ message: 'Offer stored', room_id });
});

// GET /api/crm/signal/offer — callee polls for offer
router.get('/api/crm/signal/offer', crmAuth, (req, res) => {
  const { room_id } = req.query;
  const room = signalingRooms[room_id];
  if (!room || !room.offer) return res.json({ offer: null, candidates: [] });
  res.json({ offer: room.offer, candidates: room.offer_candidates || [] });
});

// POST /api/crm/signal/answer — callee posts SDP answer
router.post('/api/crm/signal/answer', crmAuth, (req, res) => {
  const { room_id, sdp } = req.body;
  const room = signalingRooms[room_id];
  if (!room) return res.status(404).json({ message: 'Room not found. Offer not yet posted.' });
  room.answer = sdp;
  room.answer_candidates = [];
  res.json({ message: 'Answer stored' });
});

// GET /api/crm/signal/answer — caller polls for answer
router.get('/api/crm/signal/answer', crmAuth, (req, res) => {
  const { room_id } = req.query;
  const room = signalingRooms[room_id];
  if (!room || !room.answer) return res.json({ answer: null, candidates: [] });
  res.json({ answer: room.answer, candidates: room.answer_candidates || [] });
});

// POST /api/crm/signal/candidate — ICE candidate exchange
router.post('/api/crm/signal/candidate', crmAuth, (req, res) => {
  const { room_id, candidate, side } = req.body; // side: 'offer' | 'answer'
  const room = signalingRooms[room_id];
  if (!room) return res.status(404).json({ message: 'Room not found' });
  const arr = side === 'answer' ? 'answer_candidates' : 'offer_candidates';
  if (!room[arr]) room[arr] = [];
  room[arr].push(candidate);
  res.json({ message: 'ICE candidate added' });
});

// GET /api/crm/signal/candidates — poll for ICE candidates
router.get('/api/crm/signal/candidates', crmAuth, (req, res) => {
  const { room_id, side } = req.query;
  const room = signalingRooms[room_id];
  if (!room) return res.json({ candidates: [] });
  const arr = side === 'answer' ? 'answer_candidates' : 'offer_candidates';
  res.json({ candidates: room[arr] || [] });
});

// Cleanup stale signaling rooms every 30 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  Object.keys(signalingRooms).forEach(id => {
    if (now - (signalingRooms[id].created_at || 0) > 30 * 60 * 1000) {
      delete signalingRooms[id];
    }
  });
}, 30 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();


// ═══════════════════════════════════════════════════════════════════════════════
// LEAD ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/crm/leads/:id/activity
router.post('/api/crm/leads/:id/activity', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'Forbidden: View-Only accounts cannot log activity.' });
    }
    const { action, note, user_id, interaction_type } = req.body;
    if (!action) return res.status(400).json({ message: 'action is required.' });
    const lead = await dbGet(db, 'SELECT id, pipeline_stage FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    const userPipe = getUserPipelineRole(req.user);
    const leadStage = lead.pipeline_stage || 'pre_sales';
    if (userPipe !== 'all' && userPipe !== leadStage) {
      return res.status(403).json({ message: 'View-Only access: Cannot log activity for leads outside your assigned pipeline.' });
    }
    const result = await dbRun(
      db,
      `INSERT INTO crm_lead_activities (lead_id, user_id, action, note, interaction_type, author_name, author_role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        user_id || req.user.id || null,
        action,
        note || null,
        interaction_type || 'General Note',
        req.user.name || 'Sales Representative',
        req.user.role || 'sales',
        new Date().toISOString()
      ]
    );
    res.status(201).json({ id: result.lastID, message: 'Activity logged.' });
  } catch (err) {
    console.error('[CRM] POST activity error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/leads/:id/activities
router.get('/api/crm/leads/:id/activities', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const activities = await dbAll(
      db,
      `SELECT a.*, u.name as user_name, u.avatar_color
       FROM crm_lead_activities a
       LEFT JOIN crm_users u ON u.id = a.user_id
       WHERE a.lead_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.id]
    );
    res.json({ activities });
  } catch (err) {
    console.error('[CRM] GET activities error:', err.message);
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// CRM STATS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/crm/stats — Dashboard telemetry with date & category filter
router.get('/api/crm/stats', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const { start_date, end_date } = req.query;
    let lead_category = req.query.lead_category || '';

    const conditions = [];
    const params = [];

    if (lead_category && lead_category !== 'all') {
      if (lead_category === 'google_sheets' || lead_category === 'sheets' || lead_category === 'website') {
        conditions.push('(lead_category = "google_sheets" OR lead_category = "sheets" OR LOWER(source) LIKE "%sheet%" OR LOWER(source) LIKE "%google%")');
      } else if (lead_category === 'meta') {
        conditions.push('(lead_category = "meta" OR LOWER(source) LIKE "%meta%" OR LOWER(source) LIKE "%facebook%" OR LOWER(source) LIKE "%instagram%")');
      } else {
        conditions.push('lead_category = ?');
        params.push(lead_category);
      }
    }
    if (start_date) {
      conditions.push('date(created_at) >= date(?)');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('date(created_at) <= date(?)');
      params.push(end_date);
    }


    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const platformWhere = conditions.length
      ? `WHERE ${conditions.join(' AND ')} AND meta_platform IS NOT NULL`
      : 'WHERE meta_platform IS NOT NULL';

    const callsPromise = isSalesExec(req.user)
      ? dbGet(db, `SELECT COUNT(*) as c FROM crm_call_logs WHERE caller_id = ? OR caller_name = ?`, [req.user.id, req.user.name || ''])
      : dbGet(db, `SELECT COUNT(*) as c FROM crm_call_logs`);

    const usersPromise = (isSalesExec(req.user) || isMarketing(req.user))
      ? Promise.resolve({ c: 1 })
      : dbGet(db, `SELECT COUNT(*) as c FROM crm_users WHERE is_active = 1`);

    const [
      totalRow,
      statusRows,
      categoryRows,
      platformRows,
      stageRows,
      callsPromiseRes,
      usersPromiseRes
    ] = await Promise.all([
      dbGet(db, `SELECT COUNT(*) as c FROM crm_leads ${where}`, params),
      dbAll(db, `SELECT status, COUNT(*) as c FROM crm_leads ${where} GROUP BY status`, params),
      dbAll(db, `SELECT lead_category, COUNT(*) as c FROM crm_leads ${where} GROUP BY lead_category`, params),
      dbAll(db, `SELECT meta_platform, COUNT(*) as c FROM crm_leads ${platformWhere} GROUP BY meta_platform`, params),
      dbAll(db, `SELECT COALESCE(NULLIF(pipeline_stage, ''), 'pre_sales') as stage, status, COUNT(*) as c FROM crm_leads ${where} GROUP BY stage, status`, params),
      callsPromise,
      usersPromise
    ]);

    const totalCallsRow = callsPromiseRes;
    const activeUsersRow = usersPromiseRes;

    const pipelineStages = {
      pre_sales: { total: 0, blank: 0, hot: 0, warm: 0, cold: 0, pending: 0 },
      main_sales: { total: 0, blank: 0, hot: 0, warm: 0, cold: 0, pending: 0 },
      post_sales: { total: 0, blank: 0, hot: 0, warm: 0, cold: 0, pending: 0 },
    };

    for (const r of stageRows || []) {
      const stageKey = (r.stage === 'main_sales' || r.stage === 'post_sales') ? r.stage : 'pre_sales';
      pipelineStages[stageKey].total += (r.c || 0);
      const st = r.status || '';
      if (st === 'Hot Lead') {
        pipelineStages[stageKey].hot += (r.c || 0);
      } else if (st === 'Warm Lead' || st === 'Interested') {
        pipelineStages[stageKey].warm += (r.c || 0);
      } else if (st === 'Cold Lead') {
        pipelineStages[stageKey].cold += (r.c || 0);
      } else {
        pipelineStages[stageKey].blank += (r.c || 0);
        if (st === 'Pending') pipelineStages[stageKey].pending += (r.c || 0);
      }
    }

    const statusCounts = {};
    for (const r of statusRows) {
      if (r.status) statusCounts[r.status] = r.c;
    }

    const categories = { meta: 0, google_sheets: 0, sheets: 0 };
    for (const r of categoryRows) {
      if (r.lead_category === 'google_sheets' || r.lead_category === 'sheets' || r.lead_category === 'website') {
        categories.google_sheets = (categories.google_sheets || 0) + r.c;
        categories.sheets = categories.google_sheets;
      } else if (r.lead_category) {
        categories[r.lead_category] = r.c;
      }
    }

    const platforms = { fb: 0, ig: 0 };
    for (const r of platformRows) {
      if (r.meta_platform) platforms[r.meta_platform] = r.c;
    }

    res.json({
      total_leads: totalRow ? totalRow.c : 0,
      statusCounts,
      pipelineStages,
      categories,
      platforms,
      total_calls: totalCallsRow ? totalCallsRow.c : 0,
      total_users: activeUsersRow ? activeUsersRow.c : 0,
      // Status shortcuts
      pending: statusCounts['Pending'] || 0,
      hot: statusCounts['Hot Lead'] || 0,
      warm: statusCounts['Warm Lead'] || 0,
      cold: statusCounts['Cold Lead'] || 0,
      interested: statusCounts['Interested'] || 0,
      not_interested: statusCounts['Not Interested'] || 0,
      converted: statusCounts['Converted'] || 0
    });
  } catch (err) {
    console.error('[CRM] GET /api/crm/stats error:', err.message);
    res.status(500).json({ message: err.message });
  }
});



// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 1: INTERACTIVE MONTHLY & WEEKLY CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/crm/calendar — Calendar events populated with follow-up appointments
router.get('/api/crm/calendar', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const { start_date, end_date, assigned_to } = req.query;
    const conditions = ['follow_up_date IS NOT NULL', 'follow_up_date != ""'];
    const params = [];

    if (assigned_to) {
      conditions.push('assigned_to = ?');
      params.push(assigned_to);
    }

    if (start_date) {
      conditions.push('date(follow_up_date) >= date(?)');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('date(follow_up_date) <= date(?)');
      params.push(end_date);
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    const events = await dbAll(
      db,
      `SELECT id, name, phone, email, status, priority, city, requirement, budget, notes,
              follow_up_date, follow_up_time, follow_up_status, follow_up_notes,
              assigned_to, lead_category, meta_platform, pipeline_stage,
              presales_notes, presales_notes_by, presales_notes_at,
              mainsales_notes, mainsales_notes_by, mainsales_notes_at,
              postsales_notes, postsales_notes_by, postsales_notes_at
       FROM crm_leads ${where}
       ORDER BY follow_up_date ASC, follow_up_time ASC`,
      params
    );

    const mappedEvents = (events || []).map(e => ({
      ...e,
      date: e.follow_up_date,
      time: e.follow_up_time,
      lead_name: e.name,
      lead_stage: e.status,
      notes: e.follow_up_notes || e.notes || ''
    }));

    res.json({ success: true, events: mappedEvents });
  } catch (err) {
    console.error('[CRM] GET /api/crm/calendar error:', err.message);
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 2: DEDICATED FOLLOW-UP MANAGEMENT ("FOLLOW-UP CENTER")
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/crm/followups — Three distinct status buckets: Today, Overdue, Upcoming
router.get('/api/crm/followups', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const { assigned_to } = req.query;
    const conditions = ['follow_up_date IS NOT NULL', 'follow_up_date != ""'];
    const params = [];

    if (assigned_to) {
      conditions.push('assigned_to = ?');
      params.push(assigned_to);
    }

    const where = 'WHERE ' + conditions.join(' AND ');
    const allFollowUps = await dbAll(
      db,
      `SELECT id, name, phone, email, status, priority, city, requirement, budget,
              follow_up_date, follow_up_time, follow_up_status, follow_up_notes,
              assigned_to, lead_category, meta_platform, pipeline_stage,
              presales_notes, presales_notes_by, presales_notes_at,
              mainsales_notes, mainsales_notes_by, mainsales_notes_at,
              postsales_notes, postsales_notes_by, postsales_notes_at,
              updated_at
       FROM crm_leads ${where}
       ORDER BY follow_up_date ASC, follow_up_time ASC`,
      params
    );

    const todayStr = getTodayIST();

    const today = [];
    const overdue = [];
    const upcoming = [];
    const completed = [];

    for (const item of (allFollowUps || [])) {
      const fDate = String(item.follow_up_date || '').split('T')[0];
      const isDone = item.follow_up_status === 'completed';

      if (isDone) {
        completed.push(item);
      } else if (fDate === todayStr) {
        today.push(item);
      } else if (fDate < todayStr) {
        overdue.push(item);
      } else {
        upcoming.push(item);
      }
    }

    res.json({
      success: true,
      today,
      overdue,
      upcoming,
      completed,
      counts: {
        today: today.length,
        overdue: overdue.length,
        upcoming: upcoming.length,
        completed: completed.length,
        total_pending: today.length + overdue.length + upcoming.length
      }
    });
  } catch (err) {
    console.error('[CRM] GET /api/crm/followups error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/crm/leads/:id/followup — Reschedule, postpone +24h, or mark completed
router.put('/api/crm/leads/:id/followup', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Marketing accounts cannot alter follow-ups.' });
    }

    const lead = await dbGet(db, 'SELECT id, name, assigned_to, pipeline_stage, follow_up_date, follow_up_time FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });

    const userPipe = getUserPipelineRole(req.user);
    const leadStage = lead.pipeline_stage || 'pre_sales';
    if (userPipe !== 'all' && userPipe !== leadStage) {
      return res.status(403).json({ message: 'View-Only access: Cannot schedule follow-ups for leads outside your assigned pipeline.' });
    }

    const { follow_up_date, follow_up_time, follow_up_status, follow_up_notes, notes, postpone_days, action } = req.body;
    const effectiveFollowUpNotes = follow_up_notes !== undefined ? follow_up_notes : notes;

    const effectiveDays = Number.isInteger(postpone_days) && postpone_days > 0
      ? postpone_days
      : (action === 'postpone' ? 1 : 0);

    let targetDate = follow_up_date;
    if (effectiveDays > 0) {
      const todayIST = getTodayIST();
      const rawBase = targetDate || (lead.follow_up_date ? String(lead.follow_up_date).split('T')[0] : '');
      const baseStr = rawBase && rawBase >= todayIST ? rawBase : todayIST;
      const [by, bm, bd] = baseStr.split('-').map(Number);
      targetDate = new Date(Date.UTC(by, bm - 1, bd + effectiveDays)).toISOString().split('T')[0];
    }

    const effectiveStatus = follow_up_status || (effectiveDays > 0 ? 'pending' : null);

    await dbRun(
      db,
      `UPDATE crm_leads
       SET follow_up_date   = COALESCE(?, follow_up_date),
           follow_up_time   = COALESCE(?, follow_up_time),
           follow_up_status = COALESCE(?, follow_up_status),
           follow_up_notes  = COALESCE(?, follow_up_notes),
           updated_at       = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        targetDate || null,
        follow_up_time !== undefined ? follow_up_time : null,
        effectiveStatus,
        effectiveFollowUpNotes !== undefined ? effectiveFollowUpNotes : null,
        req.params.id
      ]
    );

    // If marked completed or rescheduled, append to interaction timeline
    if (follow_up_status === 'completed') {
      await dbRun(
        db,
        `INSERT INTO crm_lead_activities (lead_id, user_id, action, note, interaction_type, author_name, author_role, created_at)
         VALUES (?, ?, 'followup_completed', ?, 'General Note', ?, ?, ?)`,
        [
          req.params.id,
          req.user.id,
          effectiveFollowUpNotes || 'Scheduled follow-up marked as completed.',
          req.user.name || 'Sales Representative',
          req.user.role || 'sales',
          new Date().toISOString()
        ]
      );
    } else if (targetDate && targetDate !== lead.follow_up_date) {
      await dbRun(
        db,
        `INSERT INTO crm_lead_activities (lead_id, user_id, action, note, interaction_type, author_name, author_role, created_at)
         VALUES (?, ?, 'followup_rescheduled', ?, 'General Note', ?, ?, ?)`,
        [
          req.params.id,
          req.user.id,
          `Follow-up set to ${targetDate}${follow_up_time ? ' at ' + follow_up_time : ''}. ${effectiveFollowUpNotes || ''}`.trim(),
          req.user.name || 'Sales Representative',
          req.user.role || 'sales',
          new Date().toISOString()
        ]
      );
    }

    res.json({ success: true, message: 'Follow-up updated successfully.', follow_up_date: targetDate });
  } catch (err) {
    console.error('[CRM] PUT follow-up error:', err.message);
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 3: UNIFIED NOTES & INTERACTION HISTORY TIMELINE
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/crm/leads/:id/notes — Append-only interaction remark
router.post('/api/crm/leads/:id/notes', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'Forbidden: View-Only accounts cannot submit interaction notes.' });
    }

    const { note, interaction_type } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ message: 'Note text cannot be empty.' });
    }

    const validTypes = ['Phone Call Summary', 'WhatsApp Conversation', 'Site Visit / Meeting', 'General Note'];
    const iType = validTypes.includes(interaction_type) ? interaction_type : 'General Note';

    const lead = await dbGet(db, 'SELECT id, pipeline_stage FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });

    const userPipe = getUserPipelineRole(req.user);
    const leadStage = lead.pipeline_stage || 'pre_sales';
    if (userPipe !== 'all' && userPipe !== leadStage) {
      return res.status(403).json({ message: 'View-Only access: Cannot add interaction notes to leads outside your assigned pipeline.' });
    }

    const nowISO = new Date().toISOString();
    const result = await dbRun(
      db,
      `INSERT INTO crm_lead_activities (lead_id, user_id, action, note, interaction_type, author_name, author_role, created_at)
       VALUES (?, ?, 'note_added', ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        req.user.id,
        note.trim(),
        iType,
        req.user.name || 'Sales Representative',
        req.user.role || 'sales',
        nowISO
      ]
    );

    await dbRun(db, 'UPDATE crm_leads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

    const activityObj = {
      id: result.lastID,
      lead_id: req.params.id,
      note: note.trim(),
      interaction_type: iType,
      author_name: req.user.name,
      author_role: req.user.role,
      created_at: nowISO
    };

    res.status(201).json({
      success: true,
      message: 'Interaction note recorded.',
      note: activityObj,
      activity: activityObj
    });
  } catch (err) {
    console.error('[CRM] POST note error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/crm/leads/:id/stage-notes — Save dedicated primary task note for Pre-Sales, Main Sales, or Post-Sales
router.put('/api/crm/leads/:id/stage-notes', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    if (isMarketing(req.user)) {
      return res.status(403).json({ message: 'View-Only accounts cannot write lead task notes.' });
    }

    const { stage, note } = req.body;
    if (!['pre_sales', 'main_sales', 'post_sales'].includes(stage)) {
      return res.status(400).json({ message: 'Invalid stage. Must be pre_sales, main_sales, or post_sales.' });
    }

    const lead = await dbGet(db, 'SELECT id, name, pipeline_stage FROM crm_leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });

    const userPipe = getUserPipelineRole(req.user);
    const leadStage = lead.pipeline_stage || 'pre_sales';
    if (userPipe !== 'all' && (userPipe !== stage || userPipe !== leadStage)) {
      const stageNames = { pre_sales: 'Pre-Sales', main_sales: 'Main Sales', post_sales: 'Post-Sales' };
      return res.status(403).json({
        message: `View-Only access: Only ${stageNames[leadStage]} personnel or Admin can edit leads and notes in ${stageNames[leadStage]}.`
      });
    }

    const colPrefix = stage === 'pre_sales' ? 'presales' : stage === 'main_sales' ? 'mainsales' : 'postsales';
    const authorName = req.user.name || req.user.email || 'Sales Team';
    const nowISO = new Date().toISOString();
    const trimmedNote = typeof note === 'string' ? note.trim() : '';

    await dbRun(
      db,
      `UPDATE crm_leads
       SET ${colPrefix}_notes = ?,
           ${colPrefix}_notes_by = ?,
           ${colPrefix}_notes_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [trimmedNote, authorName, nowISO, req.params.id]
    );

    const stageLabels = {
      pre_sales: '01 Pre-Sales Primary Task',
      main_sales: '02 Main Sales Primary Task',
      post_sales: '03 Post-Sales Primary Task'
    };
    if (trimmedNote) {
      await dbRun(
        db,
        `INSERT INTO crm_lead_activities (lead_id, user_id, action, note, interaction_type, author_name, author_role, created_at)
         VALUES (?, ?, 'stage_note_updated', ?, 'General Note', ?, ?, ?)`,
        [
          req.params.id,
          req.user.id,
          `[${stageLabels[stage]}] ${trimmedNote}`,
          authorName,
          req.user.role || stage,
          nowISO
        ]
      );
    }

    res.json({
      success: true,
      message: `${stageLabels[stage]} saved successfully.`,
      stage,
      note: trimmedNote,
      updated_by: authorName,
      updated_at: nowISO
    });
  } catch (err) {
    console.error('[CRM] PUT /api/crm/leads/:id/stage-notes error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/leads/:id/timeline — Chronological interaction timeline (newest first)
router.get('/api/crm/leads/:id/timeline', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const rows = await dbAll(
      db,
      `SELECT a.*, u.avatar_color
       FROM crm_lead_activities a
       LEFT JOIN crm_users u ON u.id = a.user_id
       WHERE a.lead_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, activities: rows || [] });
  } catch (err) {
    console.error('[CRM] GET timeline error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/activities/recent — Real-time team-wide activity feed for Managers & Admins
router.get('/api/crm/activities/recent', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const conditions = [];
    const params = [];

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const activities = await dbAll(
      db,
      `SELECT a.*, l.name as lead_name, l.phone as lead_phone, l.status as lead_status, u.avatar_color
       FROM crm_lead_activities a
       JOIN crm_leads l ON l.id = a.lead_id
       LEFT JOIN crm_users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT 50`,
      params
    );

    res.json({ success: true, activities: activities || [] });
  } catch (err) {
    console.error('[CRM] GET recent activities error:', err.message);
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 5: DUPLICATE DETECTION WARNING API
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/crm/leads/check-duplicate — Duplicate phone/email validation
router.get('/api/crm/leads/check-duplicate', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const { phone, email } = req.query;
    if (!phone && !email) return res.json({ exists: false });

    const conditions = [];
    const params = [];

    if (phone) {
      const digits = String(phone).replace(/\D/g, '');
      const last10 = digits.slice(-10);
      if (last10.length >= 10) {
        conditions.push('phone LIKE ?');
        params.push(`%${last10}%`);
      }
    }
    if (email && email.trim()) {
      conditions.push('LOWER(email) = ?');
      params.push(email.trim().toLowerCase());
    }

    if (!conditions.length) return res.json({ exists: false });

    const existing = await dbGet(
      db,
      `SELECT id, name, phone, email, status, assigned_to, created_at FROM crm_leads WHERE ${conditions.join(' OR ')} LIMIT 1`,
      params
    );

    if (existing) {
      res.json({ exists: true, lead: existing });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 6: AUTOMATED BACKUP & DISASTER RECOVERY (Admin Only)
// ═══════════════════════════════════════════════════════════════════════════════

const BACKUP_DIR = process.env.BACKUP_DIR || (process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'backups', 'crm') : path.join(__dirname, '../backups/crm'));

try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[CRM Backup] Warning creating backup directory:', e.message);
}

// Shared snapshot helper for backup downloads, manual snapshots, and nightly cron
async function createDbSnapshotFile(db, targetPath) {
  await dbRun(db, 'PRAGMA wal_checkpoint(TRUNCATE)');
  try {
    await dbRun(db, 'VACUUM INTO ?', [targetPath]);
  } catch {
    const dbFile = db.filename || process.env.DB_PATH || (process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'database.db') : path.join(__dirname, 'database.db'));
    if (fs.existsSync(dbFile)) {
      fs.copyFileSync(dbFile, targetPath);
    }
  }
}

// GET /api/crm/backup/download-db — Download exact binary SQLite snapshot
router.get('/api/crm/backup/download-db', crmAuth, requireRole('admin'), async (req, res) => {
  const db = req.crmDb;
  try {
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const tempSnapshotName = `walktheplan_crm_snapshot_${dateStr}.db`;
    const tempSnapshotPath = path.join(BACKUP_DIR, tempSnapshotName);

    await createDbSnapshotFile(db, tempSnapshotPath);

    if (!fs.existsSync(tempSnapshotPath)) {
      throw new Error('Database snapshot file could not be generated.');
    }

    res.download(tempSnapshotPath, tempSnapshotName, () => {
      try {
        if (fs.existsSync(tempSnapshotPath)) fs.unlinkSync(tempSnapshotPath);
      } catch (_) {}
    });
  } catch (err) {
    console.error('[CRM Backup] Download error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/backup/export-data — JSON full export of all CRM records
router.get('/api/crm/backup/export-data', crmAuth, requireRole('admin'), async (req, res) => {
  const db = req.crmDb;
  try {
    const [leads, users, calls, activities] = await Promise.all([
      dbAll(db, 'SELECT * FROM crm_leads ORDER BY id ASC'),
      dbAll(db, 'SELECT id, name, email, role, department, avatar_color, is_active, created_at FROM crm_users ORDER BY id ASC'),
      dbAll(db, 'SELECT * FROM crm_call_logs ORDER BY id ASC'),
      dbAll(db, 'SELECT * FROM crm_lead_activities ORDER BY id ASC')
    ]);

    const backupPayload = {
      system: 'Walk The Plan CRM Enterprise',
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      counts: {
        leads: leads.length,
        users: users.length,
        calls: calls.length,
        activities: activities.length
      },
      leads,
      users,
      calls,
      activities
    };

    const dateStr = getTodayIST();
    res.setHeader('Content-Disposition', `attachment; filename="walktheplan_crm_records_${dateStr}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err) {
    console.error('[CRM Backup] Export error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/crm/backup/snapshot-now — Manually create a timestamped server snapshot
router.post('/api/crm/backup/snapshot-now', crmAuth, requireRole('admin'), async (req, res) => {
  const db = req.crmDb;
  try {
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotName = `crm_snapshot_${dateStr}.db`;
    const snapshotPath = path.join(BACKUP_DIR, snapshotName);

    await createDbSnapshotFile(db, snapshotPath);

    if (!fs.existsSync(snapshotPath)) {
      throw new Error('Failed to create snapshot.');
    }

    const stat = fs.statSync(snapshotPath);
    res.status(201).json({
      success: true,
      filename: snapshotName,
      message: 'Snapshot created successfully.',
      snapshot: {
        filename: snapshotName,
        size_bytes: stat.size,
        size_mb: (stat.size / (1024 * 1024)).toFixed(2),
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[CRM Backup] Snapshot-now error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/backup/snapshots — List existing snapshots with size and date
router.get('/api/crm/backup/snapshots', crmAuth, requireRole('admin'), (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ snapshots: [] });
    const files = fs.readdirSync(BACKUP_DIR);
    const snapshots = files
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(filePath);
        return {
          filename: f,
          size_bytes: stat.size,
          size_mb: (stat.size / (1024 * 1024)).toFixed(2),
          created_at: stat.birthtime || stat.mtime
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ snapshots });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/crm/backup/download-snapshot/:filename — Download a specific historical server snapshot
router.get('/api/crm/backup/download-snapshot/:filename', crmAuth, requireRole('admin'), (req, res) => {
  try {
    const rawName = req.params.filename || '';
    const safeName = path.basename(rawName);
    if (safeName !== rawName || !/^[a-zA-Z0-9._-]+\.db$/.test(safeName)) {
      return res.status(400).json({ message: 'Invalid snapshot filename.' });
    }
    const snapshotPath = path.join(BACKUP_DIR, safeName);
    if (!fs.existsSync(snapshotPath)) {
      return res.status(404).json({ message: 'Snapshot not found.' });
    }
    return res.download(snapshotPath, safeName);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE SHEETS DIRECT INTEGRATION API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/crm/google-sheets/config — Get active integration config & recent stats
router.get('/api/crm/google-sheets/config', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const config = await dbGet(db, 'SELECT * FROM crm_google_sheets_config ORDER BY id DESC LIMIT 1');
    const recentLogs = await dbAll(db, 'SELECT * FROM crm_google_sheets_sync_logs ORDER BY id DESC LIMIT 10');
    res.json({
      success: true,
      config: config || null,
      logs: recentLogs || []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/crm/google-sheets/connect — Connect Google Sheet, test read, auto-map headers
router.post('/api/crm/google-sheets/connect', crmAuth, requireRole('admin', 'manager'), async (req, res) => {
  const db = req.crmDb;
  try {
    const { spreadsheet_url, sheet_name, api_key } = req.body;
    if (!spreadsheet_url) {
      return res.status(400).json({ message: 'Spreadsheet URL or ID is required.' });
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheet_url);
    if (!spreadsheetId) {
      return res.status(400).json({ message: 'Invalid Google Spreadsheet URL or ID.' });
    }

    // Test fetch sheet data
    const testData = await fetchSheetData(spreadsheetId, sheet_name || '', api_key || '');
    const headers = testData.headers || [];
    if (headers.length === 0) {
      return res.status(400).json({ message: 'Connected to sheet, but no column headers were detected in Row 1.' });
    }

    const proposedMapping = proposeAutoMapping(headers);
    const mappingJson = JSON.stringify(proposedMapping);

    // Upsert into crm_google_sheets_config
    const existing = await dbGet(db, 'SELECT id FROM crm_google_sheets_config ORDER BY id DESC LIMIT 1');

    if (existing) {
      await dbRun(
        db,
        `UPDATE crm_google_sheets_config
         SET spreadsheet_id = ?, sheet_name = ?, api_key = ?,
             column_mapping = ?, is_active = 1, last_sync_status = 'idle',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [spreadsheetId, sheet_name || 'Sheet1', api_key || null, mappingJson, existing.id]
      );
    } else {
      await dbRun(
        db,
        `INSERT INTO crm_google_sheets_config
         (spreadsheet_id, sheet_name, api_key, column_mapping, is_active, last_sync_status)
         VALUES (?, ?, ?, ?, 1, 'idle')`,
        [spreadsheetId, sheet_name || 'Sheet1', api_key || null, mappingJson]
      );
    }

    const updatedConfig = await dbGet(db, 'SELECT * FROM crm_google_sheets_config ORDER BY id DESC LIMIT 1');

    res.json({
      success: true,
      message: `Successfully connected to Google Sheet via ${testData.sourceMethod}!`,
      spreadsheet_id: spreadsheetId,
      headers,
      sample_row: (testData.rows && testData.rows[0]) ? testData.rows[0] : {},
      proposed_mapping: proposedMapping,
      total_preview_rows: testData.rows ? testData.rows.length : 0,
      config: updatedConfig
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/crm/google-sheets/inspect-headers — Re-inspect headers for custom tab
router.post('/api/crm/google-sheets/inspect-headers', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const { spreadsheet_id, sheet_name, api_key } = req.body;
    let targetId = spreadsheet_id;
    if (!targetId) {
      const active = await dbGet(db, 'SELECT spreadsheet_id, api_key FROM crm_google_sheets_config WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
      if (active) targetId = active.spreadsheet_id;
    }

    if (!targetId) {
      return res.status(400).json({ message: 'No spreadsheet ID provided or active.' });
    }

    const testData = await fetchSheetData(targetId, sheet_name || '', api_key || '');
    const headers = testData.headers || [];
    const proposedMapping = proposeAutoMapping(headers);

    res.json({
      success: true,
      headers,
      proposed_mapping: proposedMapping,
      sample_row: (testData.rows && testData.rows[0]) ? testData.rows[0] : {},
      total_rows: testData.rows ? testData.rows.length : 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/crm/google-sheets/save-mapping — Save custom column mappings
router.post('/api/crm/google-sheets/save-mapping', crmAuth, requireRole('admin', 'manager'), async (req, res) => {
  const db = req.crmDb;
  try {
    const { mapping, sheet_name, is_active } = req.body;
    const config = await dbGet(db, 'SELECT id FROM crm_google_sheets_config ORDER BY id DESC LIMIT 1');
    if (!config) {
      return res.status(400).json({ message: 'No Google Sheet configuration found. Connect a sheet first.' });
    }

    const mappingStr = typeof mapping === 'object' ? JSON.stringify(mapping) : String(mapping || '{}');
    await dbRun(
      db,
      `UPDATE crm_google_sheets_config
       SET column_mapping = ?,
           sheet_name = COALESCE(?, sheet_name),
           is_active = COALESCE(?, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [mappingStr, sheet_name || null, is_active !== undefined ? (is_active ? 1 : 0) : null, config.id]
    );

    res.json({ success: true, message: 'Column mapping and configuration saved successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/crm/google-sheets/sync-now — Manually trigger synchronization
router.post('/api/crm/google-sheets/sync-now', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const config = await dbGet(db, 'SELECT * FROM crm_google_sheets_config ORDER BY id DESC LIMIT 1');
    if (!config || !config.spreadsheet_id) {
      return res.status(400).json({ message: 'No Google Sheet connected. Please attach a Google Sheet first.' });
    }

    const result = await syncGoogleSheetToCRM(db, config, 'manual');
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/crm/google-sheets/disconnect — Disconnect Google Sheet
router.post('/api/crm/google-sheets/disconnect', crmAuth, requireRole('admin', 'manager'), async (req, res) => {
  const db = req.crmDb;
  try {
    await dbRun(db, 'UPDATE crm_google_sheets_config SET is_active = 0, last_sync_status = "disconnected"');
    res.json({ success: true, message: 'Google Sheet disconnected successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/crm/google-sheets/logs — Audit logs
router.get('/api/crm/google-sheets/logs', crmAuth, async (req, res) => {
  const db = req.crmDb;
  try {
    const logs = await dbAll(db, 'SELECT * FROM crm_google_sheets_sync_logs ORDER BY id DESC LIMIT 50');
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Automatic Google Sheets periodic synchronization (Every 5 minutes)
let sheetsSyncRoutineStarted = false;
function runGoogleSheetsAutoSyncRoutine(db) {
  if (!db || sheetsSyncRoutineStarted) return;
  sheetsSyncRoutineStarted = true;

  const executeAutoSync = async () => {
    try {
      db.get('SELECT * FROM crm_google_sheets_config WHERE is_active = 1 ORDER BY id DESC LIMIT 1', async (err, config) => {
        if (!err && config && config.spreadsheet_id) {
          try {
            console.log('[Google Sheets Auto-Sync] Checking for newly appended Meta leads in sheet:', config.spreadsheet_id);
            const res = await syncGoogleSheetToCRM(db, config, 'auto');
            if (res && res.synced_count > 0) {
              console.log(`[Google Sheets Auto-Sync] Ingested ${res.synced_count} new Meta leads into CRM!`);
            }
          } catch (syncErr) {
            console.error('[Google Sheets Auto-Sync] Error syncing sheet:', syncErr.message);
          }
        }
      });
    } catch (e) {
      console.error('[Google Sheets Auto-Sync] Unexpected error:', e.message);
    }
  };

  setTimeout(executeAutoSync, 15000);
  const interval = setInterval(executeAutoSync, 5 * 60 * 1000);
  if (interval.unref) interval.unref();
}

// Automated Daily Midnight IST Snapshot Cron Routine with 30-Day Retention
let backupRoutineStarted = false;
function runDailyBackupRoutine(db) {
  if (!db || backupRoutineStarted) return;
  backupRoutineStarted = true;

  const executeSnapshot = async () => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const dateStr = getTodayIST();
      const snapshotName = `auto_midnight_${dateStr}.db`;
      const snapshotPath = path.join(BACKUP_DIR, snapshotName);

      if (!fs.existsSync(snapshotPath)) {
        await createDbSnapshotFile(db, snapshotPath);
        console.log('[CRM Backup Cron] Nightly midnight snapshot created:', snapshotName);
      }

      // 30-day retention cleanup
      const files = fs.readdirSync(BACKUP_DIR);
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const file of files) {
        if (!file.endsWith('.db')) continue;
        const filePath = path.join(BACKUP_DIR, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          console.log('[CRM Backup Cron] Cleaned up snapshot older than 30 days:', file);
        }
      }
    } catch (e) {
      console.error('[CRM Backup Cron] Error in nightly backup:', e.message);
    }
  };

  setTimeout(executeSnapshot, 8000);
  const backupInterval = setInterval(executeSnapshot, 60 * 60 * 1000); if (backupInterval.unref) backupInterval.unref();
}


// ─── Init helper (sets module-level _db reference) ───────────────────────────
function initCrmDbAndSetRef(db) {
  _db = db;
  initCrmDb(db);
  runDailyBackupRoutine(db);
  runGoogleSheetsAutoSyncRoutine(db);
}

module.exports = { router, initCrmDb: initCrmDbAndSetRef };
