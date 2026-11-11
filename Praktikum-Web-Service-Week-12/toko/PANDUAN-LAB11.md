# PANDUAN LAB 11: Dokumentasi API Otomatis (OpenAPI/Swagger)

Lanjutan dari Lab 09 dan Lab 10 (folder `toko`). Kode Langkah 01 sampai 03 sudah terpasang: `product-service.js`, `order-service.js`, dan `gateway.js` sudah berisi anotasi `@openapi`, `/openapi.json`, dan `/docs`.

## A. Persiapan

1. `node -v` harus 18 atau lebih baru.
2. Di folder `toko`: `npm run install:all` (memasang `swagger-jsdoc` dan `swagger-ui-express`).
3. Tiga terminal: T1 product-service, T2 order-service, T3 gateway (lihat `README.md` di akar repository). RabbitMQ tidak wajib: order-service hanya menampilkan peringatan di log.
4. API key: lihat `gateway/.env` (baris `API_KEY=...`).

## B. Penyesuaian terhadap soal

- Gateway memakai API key untuk `/order-service`. Agar Try it out menghasilkan 201, spesifikasi gabungan diberi `securitySchemes` (`ApiKeyAuth`, header `X-API-Key`) sehingga muncul tombol **Authorize** di `/docs`.
- Respons yang dihasilkan gateway sendiri (401 untuk `/order-service`, 429 rate limit, 504 service tidak terjangkau) ditambahkan ke tiap operasi pada spesifikasi gabungan, supaya tidak menjadi celah dokumentasi.
- `POST /product-service/products/{id}/reserve` didokumentasikan di product-service, tetapi diblokir gateway (404) karena hanya untuk panggilan antar-service. Lewat `:8080/docs` endpoint ini selalu 404; coba langsung di `:3000/docs`.
- Rate limit gateway 20 request per 10 detik: bila `/docs` kosong atau error 429, tunggu 10 detik lalu muat ulang.

## C. Langkah 05 (drift), dilakukan manual

1. Di `product-service/product-service.js`, tambahkan `category: 'Periferal'` pada ketiga objek produk (jangan ubah anotasi), restart T1, panggil `GET /product-service/products` lewat Try it out: respons memuat `category`, skema tidak (drift).
2. Pada skema `Product` di anotasi, tambahkan satu baris di bawah `stock`:
   ` *         category: { type: string, example: Periferal }`
   restart T1, muat ulang `/docs`: skema dan contoh kini memuat `category`.
3. Code-first mengurangi drift karena kontrak ditulis berdampingan dengan kode dan dikirim bersama service, tetapi tidak menghilangkannya karena anotasi hanya komentar: tidak ada yang memeriksa bahwa isi komentar sesuai perilaku kode, sehingga pengembang masih bisa mengubah kode tanpa mengubah anotasi.

## D. Langkah 06 dan 07

- Simpan ulang `http://localhost:8080/openapi.json` sebagai `toko/openapi.json` (setelah drift diperbaiki), validasi di editor.swagger.io, impor ke Postman.
- Commit tanpa `node_modules` dan `.env`.

## E. Celah dokumentasi yang ditemukan (bahan catatan Langkah 04)

- Status 401, 429, dan 504 muncul lewat gateway tetapi tidak ada di anotasi service; ditutup di spesifikasi gabungan (lihat B).
- Respons 200 untuk `reserve` tidak bisa dicoba lewat gateway karena diblokir (404).
- Skema `Error` dimiliki kedua service dengan contoh berbeda; pada spesifikasi gabungan contoh milik order-service yang dipakai.

## F. Dokumentasi proyek kelompok

`proyek-kelompok/docs/openapi-jadwal-service.yaml` (3 endpoint) dan `proyek-kelompok/docs/openapi-booking-service.yaml` (5 endpoint), lengkap dengan skema permintaan, skema respons, dan kode error. Buka dengan menempelkan isinya di editor.swagger.io.

## G. Refleksi

Lihat `docs/refleksi-lab11.md`.
