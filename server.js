import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.GALAXY_PASSWORD || 'admin123';

// ── In-memory rate limiter ────────────────────────
const requestCounts = new Map();
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 30; // max 30 images per hour per IP

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  if (!requestCounts.has(ip)) requestCounts.set(ip, []);
  const timestamps = requestCounts.get(ip).filter(t => now - t < RATE_WINDOW);
  if (timestamps.length >= RATE_MAX) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }
  timestamps.push(now);
  requestCounts.set(ip, timestamps);
  next();
}

// ── Auth middleware ────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized. Admin password required.' });
  }
  next();
}

// ── CORS ──────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Serve static frontend ─────────────────────────
app.use(express.static(__dirname));

// ── Database (SQLite) ─────────────────────────────
const dbPath = path.join(__dirname, 'data', 'galaxy.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY, url TEXT NOT NULL, filename TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// ── File upload storage ───────────────────────────
const uploadsDir = path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) ext = '.jpg';
    cb(null, randomUUID() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed: jpg, png, gif, webp'));
    }
  }
});

// ── API: Health check ─────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', imageCount: db.prepare('SELECT COUNT(*) as c FROM images').get().c });
});

// ── API: Public - List all images ─────────────────
app.get('/api/images', (req, res) => {
  const rows = db.prepare('SELECT * FROM images ORDER BY created_at DESC').all();
  res.json(rows);
});

// ── API: Admin - Upload image (file) ──────────────
app.post('/api/images/upload', requireAuth, rateLimit, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const id = randomUUID();
  const url = '/data/uploads/' + req.file.filename;
  db.prepare('INSERT INTO images (id, url, filename) VALUES (?, ?, ?)').run(id, url, req.file.originalname);
  res.json({ id, url, filename: req.file.originalname });
});

// ── API: Admin - Add image (URL) ──────────────────
app.post('/api/images', requireAuth, rateLimit, (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  // Basic URL validation
  if (!url.match(/^https?:\/\/.+/i) && !url.startsWith('data:')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  const id = randomUUID();
  db.prepare('INSERT INTO images (id, url, filename) VALUES (?, ?, ?)').run(id, url, 'external');
  res.json({ id, url, filename: 'external' });
});

// ── API: Admin - Delete image ─────────────────────
app.delete('/api/images/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.url.startsWith('/data/uploads/')) {
    const filePath = path.join(__dirname, row.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Verify password ──────────────────────────
app.post('/api/auth', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ token: ADMIN_PASSWORD, ok: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// ── Serve uploaded files ──────────────────────────
app.use('/data/uploads', express.static(uploadsDir));

// ── Start ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌌 Galaxy server at http://localhost:${PORT}`);
  console.log(`🔐 Admin password: ${ADMIN_PASSWORD === 'admin123' ? 'admin123 (change with GALAXY_PASSWORD env var)' : '****'}`);
});
