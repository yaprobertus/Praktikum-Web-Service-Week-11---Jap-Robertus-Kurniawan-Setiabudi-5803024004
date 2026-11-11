// Bantu bukti Langkah 06 (uji kegagalan service). Jalankan di tiap tahap:
//   1) saat product-service MATI   -> POST /orders harus 503, GET /orders harus 200
//   2) saat product-service HIDUP lagi -> POST /orders harus 201
// Jalankan: node uji-kegagalan.js   (lewat gateway; ubah BASE_URL jika perlu)
const fs = require('fs');
const path = require('path');
function bacaApiKey() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    const m = fs.readFileSync(path.join(__dirname, 'gateway', '.env'), 'utf8').match(/^API_KEY=(.*)$/m);
    if (m) return m[1].trim();
  } catch { /* abaikan */ }
  return 'ganti-dengan-key-rahasia-kelompok';
}
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const headers = { 'Content-Type': 'application/json', 'X-API-Key': bacaApiKey() };
(async () => {
  console.log('Waktu:', new Date().toLocaleTimeString('id-ID'));
  const t0 = Date.now();
  const post = await fetch(`${BASE}/order-service/orders`, {
    method: 'POST', headers, body: JSON.stringify({ productId: 1, qty: 1 }) });
  console.log(`POST /order-service/orders -> ${post.status} (${Date.now() - t0} ms)`, await post.json());
  const get = await fetch(`${BASE}/order-service/orders`, { headers });
  const daftar = await get.json();
  console.log(`GET  /order-service/orders -> ${get.status}, jumlah pesanan tersimpan: ${daftar.length}`);
})().catch((e) => { console.error('Gagal menghubungi gateway:', e.cause?.code || e.message); process.exit(1); });
