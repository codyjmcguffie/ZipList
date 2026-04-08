/**
 * ZipList Proxy Server
 * Bridges browser → Printify API and EverBee API (CORS bypass)
 * Users supply their own API tokens — this server stores nothing.
 *
 * Deploy to Railway: https://railway.app
 * Local dev: node server.js
 */

const express  = require('express');
const cors     = require('cors');
const https    = require('https');
const http     = require('http');
const multer   = require('multer');
const FormData = require('form-data');
const fetch    = (...a) => import('node-fetch').then(m => m.default(...a));

const app     = express();
const PORT    = process.env.PORT || 3456;
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));

// Simple in-memory rate limiter — 120 req/min per IP
const ratemap = new Map();
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const ip  = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const win = ratemap.get(ip) || { count: 0, reset: now + 60000 };
  if (now > win.reset) { win.count = 0; win.reset = now + 60000; }
  win.count++;
  ratemap.set(ip, win);
  if (win.count > 120) return res.status(429).json({ error: 'Rate limit exceeded — slow down' });
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, service: 'ZipList Proxy', version: '1.0.0' }));

// ── Helper: forward a JSON request via raw https ──────────────────────────────
function proxyHttps(hostname, path, method, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path, method, headers };
    const req  = https.request(opts, resp => {
      const chunks = [];
      resp.on('data', c => chunks.push(c));
      resp.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let body;
        try { body = JSON.parse(raw); } catch { body = { raw }; }
        resolve({ status: resp.statusCode, body });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Printify proxy ────────────────────────────────────────────────────────────
app.use('/printify', async (req, res) => {
  const token = req.headers['x-printify-token'];
  if (!token) return res.status(401).json({ error: 'Missing X-Printify-Token header' });

  const bodyStr = ['GET','DELETE'].includes(req.method) ? null : JSON.stringify(req.body);
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Content-Type':  'application/json;charset=utf-8',
    'User-Agent':    'ZipList/1.0',
  };
  if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

  try {
    const { status, body } = await proxyHttps('api.printify.com', req.url, req.method, headers, bodyStr);
    res.status(status).json(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── EverBee proxy — JSON routes ───────────────────────────────────────────────
app.use('/everbee', async (req, res, next) => {
  if (req.path === '/attachments' && req.method === 'POST') return next(); // handled below
  const token   = req.headers['x-eb-token'];
  const storeId = req.headers['x-eb-store-id'];
  if (!token || !storeId) return res.status(401).json({ error: 'Missing EverBee credentials' });

  const bodyStr = ['GET','DELETE'].includes(req.method) ? null : JSON.stringify(req.body);
  const headers = {
    'Authorization': 'Bearer ' + token,
    'X-Store-Id':    storeId,
    'Content-Type':  'application/json;charset=utf-8',
    'User-Agent':    'ZipList/1.0',
  };
  if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

  try {
    const { status, body } = await proxyHttps('app.everbee.io', '/api' + req.url, req.method, headers, bodyStr);
    res.status(status).json(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── EverBee multipart attachment upload ───────────────────────────────────────
app.post('/everbee/attachments', upload.single('file'), async (req, res) => {
  const token   = req.headers['x-eb-token'];
  const storeId = req.headers['x-eb-store-id'];
  if (!token || !storeId) return res.status(401).json({ error: 'Missing EverBee credentials' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });

    const resp = await fetch('https://app.everbee.io/api/attachments', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'X-Store-Id':    storeId,
        'User-Agent':    'ZipList/1.0',
        ...form.getHeaders(),
      },
      body: form,
    });

    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ZipList Proxy running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Printify: http://localhost:${PORT}/printify`);
  console.log(`   EverBee:  http://localhost:${PORT}/everbee\n`);
});
