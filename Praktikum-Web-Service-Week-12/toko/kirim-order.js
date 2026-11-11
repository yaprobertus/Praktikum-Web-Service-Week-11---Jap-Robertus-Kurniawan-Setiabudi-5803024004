// Kirim beberapa order beruntun lewat gateway (bantu Langkah 05, 06, 07 Lab 10).
// Jalankan: node kirim-order.js [jumlah] [productId] [qty]
//   contoh : node kirim-order.js 3        -> 3 order produk 2, qty 1
//            node kirim-order.js 6        -> 6 order beruntun (uji dua consumer)
// Default memakai produk 2 (Mouse Wireless, stok 25) supaya stok produk 1 (10) tidak cepat habis.
// Env opsional: BASE_URL, API_KEY (jika kosong dibaca dari gateway/.env, sama seperti smoke-test.js)
const fs = require('fs');
const path = require('path');

function bacaApiKey() {
  if (process.env.API_KEY) return process.env.API_KEY;
  try {
    const m = fs.readFileSync(path.join(__dirname, 'gateway', '.env'), 'utf8').match(/^API_KEY=(.*)$/m);
    if (m) return m[1].trim();
  } catch { /* gateway/.env belum ada */ }
  return 'ganti-dengan-key-rahasia-kelompok';
}

const jumlah = parseInt(process.argv[2] || '1', 10);
const productId = parseInt(process.argv[3] || '2', 10);
const qty = parseInt(process.argv[4] || '1', 10);
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const headers = { 'Content-Type': 'application/json', 'X-API-Key': bacaApiKey() };

(async () => {
  console.log(`Mengirim ${jumlah} order (productId=${productId}, qty=${qty}) ke ${BASE}/order-service/orders`);
  for (let i = 1; i <= jumlah; i++) {
    const t0 = Date.now();
    const r = await fetch(`${BASE}/order-service/orders`, {
      method: 'POST', headers, body: JSON.stringify({ productId, qty }) });
    const body = await r.json();
    const ringkas = r.ok ? `id=${body.id} ${body.productName} x${body.qty}` : JSON.stringify(body);
    console.log(`order ${i}/${jumlah} -> ${r.status} (${Date.now() - t0} ms) ${ringkas}`);
    if (r.status === 429) { console.log('Kena rate limit gateway (20 request / 10 detik). Tunggu 10 detik.'); break; }
  }
})().catch((e) => { console.error('Gagal menghubungi gateway:', e.cause?.code || e.message); process.exit(1); });
