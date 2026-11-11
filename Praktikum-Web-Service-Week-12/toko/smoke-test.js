// Smoke test Lab 09: product-service + order-service lewat gateway.
// Jalankan: node smoke-test.js   (Node.js 18+; gateway, product-service, order-service harus hidup)
// Harapan: jumlah produk 3, status order 201, stok produk 1 berkurang 2.
const fs = require('fs');
const path = require('path');

// API key untuk /order-service: dari env API_KEY, jika tidak ada dibaca dari gateway/.env
function bacaApiKey() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    const env = fs.readFileSync(path.join(__dirname, 'gateway', '.env'), 'utf8');
    const m = env.match(/^API_KEY=(.*)$/m);
    if (m) return m[1].trim();
  } catch { /* gateway/.env belum ada */ }
  return 'ganti-dengan-key-rahasia-kelompok';
}

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const json = { 'Content-Type': 'application/json', 'X-API-Key': bacaApiKey() };
(async () => {
  const list = await fetch(`${BASE}/product-service/products`).then(r => r.json());
  console.log('jumlah produk:', list.length);
  const o = await fetch(`${BASE}/order-service/orders`, {
    method: 'POST', headers: json, body: JSON.stringify({ productId: 1, qty: 2 }) });
  console.log('buat order:', o.status, await o.json());
  const p = await fetch(`${BASE}/product-service/products/1`).then(r => r.json());
  console.log('stok produk 1 sekarang:', p.stock);
})().catch((e) => { console.error('Gagal menghubungi gateway:', e.cause?.code || e.message); process.exit(1); });
