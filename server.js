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
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// ── File upload storage ───────────────────────────
const uploadsDir = path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, randomUUID() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ── API: Upload image (file) ──────────────────────
app.post('/api/images/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const id = randomUUID();
  const url = '/data/uploads/' + req.file.filename;
  db.prepare('INSERT INTO images (id, url, filename) VALUES (?, ?, ?)').run(id, url, req.file.originalname);
  res.json({ id, url, filename: req.file.originalname });
});

// ── API: Upload image (base64 URL) ────────────────
app.post('/api/images', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  const id = randomUUID();
  db.prepare('INSERT INTO images (id, url, filename) VALUES (?, ?, ?)').run(id, url, 'external');
  res.json({ id, url, filename: 'external' });
});

// ── API: List all images ──────────────────────────
app.get('/api/images', (req, res) => {
  const rows = db.prepare('SELECT * FROM images ORDER BY created_at DESC').all();
  res.json(rows);
});

// ── API: Delete image ─────────────────────────────
app.delete('/api/images/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  // Delete file if local
  if (row.url.startsWith('/data/uploads/')) {
    const filePath = path.join(__dirname, row.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Serve uploaded files ──────────────────────────
app.use('/data/uploads', express.static(uploadsDir));

// ── Start ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌌 Galaxy server running at http://localhost:${PORT}`);
});
