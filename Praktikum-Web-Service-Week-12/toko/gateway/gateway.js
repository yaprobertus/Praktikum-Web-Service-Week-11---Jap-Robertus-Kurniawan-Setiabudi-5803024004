/**
 * API GATEWAY - Toko (Lab 09), disalin dari gateway Lab 08 dengan prefix baru.
 *
 * Satu-satunya alamat yang diketahui klien (port 8080):
 *   rate limit  : maks. 20 request / 10 detik per IP
 *   cek API key : header X-API-Key, khusus route /order-service (tantangan opsional Lab 08)
 *   routing     : /product-service/*  -> PRODUCT_SERVICE_URL (default http://localhost:3000)
 *                 /order-service/*    -> ORDER_SERVICE_URL   (default http://localhost:3001)
 *
 * Catatan: JANGAN menaruh express.json() sebelum middleware proxy, karena body request
 * akan terbaca habis dan POST lewat gateway menggantung.
 */
// Sembunyikan peringatan DEP0060 (berasal dari dependency http-proxy, tidak berbahaya)
const _emit = process.emitWarning;
process.emitWarning = (w, ...a) => {
  const code = typeof a[0] === 'object' && a[0] ? a[0].code : a[1];
  if (code === 'DEP0060') return;
  return _emit.call(process, w, ...a);
};
require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { rateLimit } = require('express-rate-limit');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // diperlukan saat di-deploy di balik proxy

// Health check (sebelum rate limit supaya pengecekan tidak ikut dibatasi)
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));

// rate limit: maks. 20 request per 10 detik per alamat IP
app.use(rateLimit({
  windowMs: 10 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request, coba lagi beberapa detik lagi' },
}));

// Halaman info gateway
app.get('/', (req, res) => {
  res.json({
    service: 'api-gateway',
    sistem: 'Toko (Lab 09: monolit dipecah menjadi dua service)',
    routes: {
      '/product-service/*': 'product-service (publik; endpoint reserve diblokir dari luar)',
      '/order-service/*': 'order-service (wajib header X-API-Key)',
      '/docs': 'dokumentasi API gabungan (Swagger UI); spesifikasi mentah di /openapi.json',
    },
    rateLimit: 'maks. 20 request / 10 detik per IP',
  });
});


// ---------- Lab 11: dokumentasi gabungan (Swagger UI) ----------
// Letaknya SEBELUM middleware proxy supaya /docs dan /openapi.json dilayani gateway sendiri.
const swaggerUi = require('swagger-ui-express');

const DOC_SOURCES = [
  { prefix: '/product-service', url: process.env.PRODUCT_DOC_URL || 'http://localhost:3000/openapi.json' },
  { prefix: '/order-service',   url: process.env.ORDER_DOC_URL   || 'http://localhost:3001/openapi.json' },
];

// Respons yang dihasilkan gateway sendiri (bukan service), supaya tidak jadi "celah dokumentasi"
const errRef = { content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
const GATEWAY_RESPONSES = {
  429: { description: 'Terlalu banyak request (rate limit gateway: 20 request / 10 detik per IP)', ...errRef },
  504: { description: 'Gateway tidak dapat menjangkau service tujuan', ...errRef },
};

async function buildSpec() {
  const merged = {
    openapi: '3.0.3',
    info: { title: 'Toko API (via Gateway)', version: '1.0.0' },
    servers: [{ url: '/' }],                    // "Try it out" memakai alamat gateway
    paths: {},
    components: {
      schemas: {},
      // API key gateway (lab 08): tombol Authorize di Swagger UI mengirim header X-API-Key
      securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' } },
    },
  };
  for (const s of DOC_SOURCES) {
    try {
      const spec = await fetch(s.url, { signal: AbortSignal.timeout(2000) }).then(r => r.json());
      for (const [path, ops] of Object.entries(spec.paths || {})) {
        for (const op of Object.values(ops)) {
          op.responses = { ...(op.responses || {}) };
          if (s.prefix === '/order-service') {
            op.security = [{ ApiKeyAuth: [] }];   // route ini wajib X-API-Key di gateway
            op.responses[401] = { description: 'API key salah atau tidak ada', ...errRef };
          }
          Object.assign(op.responses, GATEWAY_RESPONSES);
        }
        merged.paths[s.prefix + path] = ops;
      }
      Object.assign(merged.components.schemas, (spec.components || {}).schemas);
    } catch (e) {
      console.warn('dokumentasi gagal diambil dari', s.url);
    }
  }
  return merged;
}

app.get('/openapi.json', async (req, res) => res.json(await buildSpec()));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(null, { swaggerOptions: { url: '/openapi.json' } }));
// ---------------------------------------------------------------

// Cek API key (tantangan opsional Lab 08), diterapkan pada /order-service
if (!process.env.API_KEY) {
  console.warn('PERINGATAN: API_KEY belum diisi, semua request ke /order-service akan ditolak (401). Salin .env.example menjadi .env.');
}
const requireApiKey = (req, res, next) => {
  const expected = process.env.API_KEY;
  const given = req.get('X-API-Key') || '';
  let valid = false;
  if (expected) {
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  if (!valid) return res.status(401).json({ error: 'Unauthorized' });
  next();
};
app.use('/order-service', requireApiKey);

// Endpoint reserve hanya untuk order-service (panggilan antar-service), tidak boleh dipanggil klien lewat gateway
app.post('/product-service/products/:id/reserve', (req, res) =>
  res.status(404).json({ error: 'Route tidak ditemukan' }));

// Helper: cocokkan tepat "/prefix" atau "/prefix/..." (bukan "/prefixxyz")
const cocok = (prefix) => (pathname) => pathname === prefix || pathname.startsWith(prefix + '/');
const hapusPrefix = (prefix) => (path) => path.replace(new RegExp('^' + prefix), '') || '/';

const onError = (err, req, res) => {
  console.error(`Proxy error (${req.method} ${req.originalUrl || req.url}):`, err.code || err.message);
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gateway tidak dapat menjangkau service tujuan' }));
  }
};

// routing: /product-service/* diteruskan ke product-service
app.use(createProxyMiddleware({
  pathFilter: cocok('/product-service'),
  target: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: hapusPrefix('/product-service'),
  on: { error: onError },
}));

// routing: /order-service/* diteruskan ke order-service
app.use(createProxyMiddleware({
  pathFilter: cocok('/order-service'),
  target: process.env.ORDER_SERVICE_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: hapusPrefix('/order-service'),
  on: { error: onError },
}));

app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan' }));

app.listen(process.env.PORT || 8080, () => console.log(`Gateway berjalan di port ${process.env.PORT || 8080}`));
