# PANDUAN LAB 09: Langkah, Pengujian, dan Daftar Screenshot

Semua kode sudah jadi dan sudah diuji. Panduan ini berisi urutan menjalankan, apa yang harus dites, dan screenshot apa yang harus diambil.

Isi: A. Persiapan · B. Langkah 01 Monolit · C. Langkah 03 dan 04 Dua service · D. Langkah 05 Gateway dan smoke-test · E. Langkah 06 Uji kegagalan · F. Langkah 07 Diagram dan GitHub · G. Daftar screenshot · H. Checklist akhir · I. Jika ada error

## A. Persiapan

1. Cek `node -v`, harus 18 atau lebih baru.
2. Buka terminal di folder `toko`, lalu jalankan sekali saja:
   ```bash
   npm run install:all
   ```
3. Siapkan file env gateway (otomatis dibuat oleh `npm run start:all`, atau manual):
   ```bash
   cd gateway
   cp .env.example .env          # Windows PowerShell: copy .env.example .env
   cd ..
   ```
   Nilai `API_KEY` di `gateway/.env` dibaca otomatis oleh `smoke-test.js` dan `uji-kegagalan.js`. Jika kamu mengganti API key, ganti di `.env` dan di environment Postman (`apiKey`).
4. Impor ke Postman dua file di folder `postman/`: `toko-lab09.postman_collection.json` dan `lokal.postman_environment.json`, lalu pilih environment **Toko Lokal** di pojok kanan atas.

Penting: monolit dan product-service sama-sama memakai port 3000. Jangan jalankan keduanya bersamaan (kalau tabrakan akan muncul `EADDRINUSE`).

## B. Langkah 01: Jalankan monolit (bukti kondisi SEBELUM)

```bash
cd monolith
node monolith.js            # tampil: Monolith di :3000
```
Di Postman, buka folder **1. Monolit**, jalankan berurutan:
1. `GET /products` harus 200 dan berisi 3 produk.
2. `POST /orders` dengan `{"productId":1,"qty":2}` harus 201.
3. `GET /products/1`, stok harus turun menjadi 8.

Perhatikan kata kunci di kode: `p.stock -= qty` di dalam POST /orders. Itulah titik monolit saling mengikat. Setelah paham, hentikan monolit dengan Ctrl+C.

Screenshot: lihat nomor SS-1 sampai SS-3 di bagian G.

## C. Langkah 03 dan 04: Jalankan dua service

Cara 1 (tiga terminal, sesuai modul):
```bash
# terminal 1
cd product-service && node product-service.js      # product-service di :3000
# terminal 2
cd order-service && node order-service.js          # order-service di :3001
```
Cara 2 (satu terminal): `npm run start:all` dari folder `toko` (menjalankan product-service, order-service, dan gateway sekaligus).

Uji product-service langsung (folder Postman **2. product-service langsung**): `GET /products`, lalu `POST /products/1/reserve` dengan `{"qty":1}` harus 200 dan stok berkurang. Cek juga kasus 404 (produk 99), 409 (qty 999 pada produk 3), dan 400 (qty 0).

Uji order-service langsung (folder **3. order-service langsung**): `POST /orders` dengan `{"productId":1,"qty":2}` harus 201, lalu `GET localhost:3000/products/1` untuk memastikan stok berkurang. Hasilnya harus sama dengan monolit.

## D. Langkah 05: Gateway dan smoke-test

Gateway sudah disalin dari Lab 08 dan prefix sudah diganti: `/service-a` menjadi `/product-service`, `/service-b` menjadi `/order-service` (di `pathFilter` dan `pathRewrite`). Karena tantangan API key Lab 08 dikerjakan, route `/order-service` wajib memakai header `X-API-Key`. Smoke-test sudah menyertakan header itu.

1. Matikan semua proses lalu nyalakan ulang dari awal agar stok kembali 10 (data di memori): `npm run start:all`.
2. Di terminal lain (folder `toko`):
   ```bash
   node smoke-test.js
   ```
   Hasil yang benar:
   ```
   jumlah produk: 3
   buat order: 201 { id: 1, productId: 1, productName: 'Keyboard Mekanik', qty: 2, total: 900000, ... }
   stok produk 1 sekarang: 8
   ```
3. Uji tambahan di Postman, folder **4. Lewat Gateway**: tanpa API key harus 401, dan `POST /product-service/products/1/reserve` lewat gateway harus 404 (endpoint reserve sengaja diblokir dari luar, hanya order-service yang boleh memanggilnya).

## E. Langkah 06: Uji kegagalan service (inti praktikum)

Untuk uji ini pakai **tiga terminal terpisah** (Cara 1 di bagian C) supaya hanya product-service yang bisa dimatikan, sedangkan order-service dan gateway tetap hidup. (Gateway juga harus berjalan: `cd gateway && node gateway.js`, jadi totalnya tiga terminal untuk product-service, order-service, dan gateway.) Lakukan BERURUTAN. Di tiap tahap, ambil screenshot dari Postman (folder **5. Uji Kegagalan**) atau dari terminal dengan `node uji-kegagalan.js`. Salah satu cara saja sudah cukup, tetapi pastikan URL `localhost:8080` dan kode status terlihat jelas.

1. **Matikan product-service saja** dengan Ctrl+C di terminalnya. Kirim `POST /order-service/orders`: harus **503** dengan pesan `product-service tidak tersedia, coba lagi nanti`, bukan menggantung atau crash. (**SS-9**)
2. **Kirim `GET /order-service/orders`**: harus tetap **200**. Di monolit ini mustahil karena semuanya mati bersama. (**SS-10**)
3. **Nyalakan lagi product-service**, ulangi `POST /order-service/orders`: harus **201**. Catat bahwa stok kembali ke data awal karena data hanya di memori. (**SS-11**)
4. **Uji timeout (opsional).** Di `product-service.js`, ubah handler reserve menjadi `async` dan tambahkan sementara `await new Promise(r => setTimeout(r, 5000));` di baris pertama handler. Jalankan ulang product-service, kirim POST: order-service membalas 503 setelah sekitar 2 detik (di Postman terlihat waktu respons sekitar 2 s; `uji-kegagalan.js` menampilkan jumlah milidetik). **Hapus baris itu kembali** setelah selesai. (**SS-12**)

Catatan: dengan `npm run start:all`, Ctrl+C mematikan SEMUA proses sekaligus, jadi untuk uji kegagalan gunakan tiga terminal terpisah.

## F. Langkah 07: Diagram, commit, dan GitHub

Diagram sudah dibuat: `docs/arsitektur-toko.png` (juga `.svg`). Boleh dibuat ulang dengan gaya kelompok (draw.io atau Mermaid).

```bash
git init
git add .
git status          # pastikan TIDAK ada node_modules dan .env
git commit -m "Lab 09: pecah monolit toko menjadi product-service dan order-service"
git branch -M main
git remote add origin https://github.com/USERNAME/Praktikum-Web-Service-Week-9.git
git push -u origin main
```
`.gitignore` sudah berisi `node_modules/` dan `.env`. Yang boleh masuk hanya `.env.example`.

## G. Daftar screenshot untuk laporan dan pembuktian

Wajib (diminta soal Tugas Kelompok):
- **SS-4**: output `node smoke-test.js` lewat gateway (jumlah produk 3, order 201, stok berkurang 2).
- **SS-9**: POST /order-service/orders saat product-service mati, hasil 503.
- **SS-10**: GET /order-service/orders saat product-service mati, hasil 200.
- **SS-11**: POST /order-service/orders setelah product-service dinyalakan lagi, hasil 201.
- **Diagram arsitektur**: `docs/arsitektur-toko.png`.
- **Tautan repository GitHub** (berisi tiga folder dan smoke-test.js).

Pendukung (sangat disarankan agar bukti lengkap per langkah):
- **SS-1**: Monolit, GET /products (3 produk).
- **SS-2**: Monolit, POST /orders status 201.
- **SS-3**: Monolit, GET /products/1 stok 8.
- **SS-5**: product-service langsung, POST /products/1/reserve berhasil (stok berkurang).
- **SS-6**: order-service langsung, POST /orders status 201 (port 3001).
- **SS-7**: GET localhost:3000/products/1 setelah order, stok berkurang (bukti order memengaruhi data produk lewat API).
- **SS-8**: terminal yang menampilkan product-service di :3000, order-service di :3001, dan Gateway di port 8080.
- **SS-12**: uji timeout (opsional), 503 setelah sekitar 2 detik.
- **SS-13**: tanpa API key ke /order-service hasil 401 (bukti tantangan API key).
- **SS-14**: halaman repository GitHub memperlihatkan folder gateway, product-service, order-service, smoke-test.js, dan tidak ada node_modules.

Tips screenshot: sertakan URL, method, kode status, dan body respons dalam satu tangkapan. Hindari memperlihatkan API key asli bila repository atau laporan akan dibagikan.

## H. Checklist akhir (dari modul)

- [ ] Monolit berjalan dan kamu tahu bagian mana yang saling mengikat (`p.stock -= qty`)
- [ ] product-service dan order-service berjalan di port berbeda (3000 dan 3001), masing-masing dengan datanya sendiri
- [ ] order-service tidak punya data produk, ia memanggil `reserve` lewat HTTP dengan timeout 2 detik
- [ ] `smoke-test.js` lewat gateway berhasil: order 201, stok berkurang 2
- [ ] Saat product-service mati: `POST /orders` menjadi 503, `GET /orders` tetap 200
- [ ] Tidak ada secret atau `node_modules` di repository
- [ ] Diagram arsitektur, tabel pemetaan proyek kelompok (di laporan ditulis tanpa tabel), dan refleksi 4 sampai 5 kalimat sudah ada di laporan

Dikumpulkan sebelum lab 10: (1) tautan repository, (2) screenshot smoke-test dan tiga hasil uji kegagalan, (3) diagram arsitektur, ditambah pemetaan proyek kelompok dan refleksi.

## I. Jika ada error

- `EADDRINUSE :::3000` berarti monolit atau proses lama masih hidup. Hentikan dengan Ctrl+C.
- `503` padahal product-service menyala: cek `PRODUCT_SERVICE_URL` (default `http://localhost:3000`). Di Windows coba `127.0.0.1`.
- `fetch is not defined`: Node.js di bawah 18.
- POST lewat gateway menggantung: pastikan tidak ada `express.json()` sebelum middleware proxy di gateway.
- `404` dari service lewat gateway: prefix salah. Pakai `/product-service/...` dan `/order-service/...`, bukan `/service-a`.
- `401` di `/order-service`: header `X-API-Key` belum dikirim atau berbeda dengan `API_KEY` di `gateway/.env`.
- `429`: kena rate limit (20 request per 10 detik). Tunggu 10 detik.
