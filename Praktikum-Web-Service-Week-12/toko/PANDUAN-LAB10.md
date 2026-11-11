# PANDUAN LAB 10: Komunikasi Antar Service via Message Queue

Lanjutan dari Lab 09 (folder `toko`). Kode sudah jadi: `notification-service/` (consumer), `order-service/order-service.js` (sudah berisi publisher), `kirim-order.js` (bantu kirim order), diagram baru, dan dokumen tugas.
Panduan ini berisi urutan menjalankan, apa yang diuji, screenshot yang harus diambil, dan daftar syarat soal.

Isi: A. Persiapan · B. Langkah 01 RabbitMQ · C. Langkah 02 Consumer · D. Langkah 03 Publisher · E. Langkah 04 Alur normal · F. Langkah 05 Consumer mati · G. Langkah 06 Dua consumer · H. Langkah 07 Crash dan idempotensi · I. Langkah 08 Diagram, commit, bukti · J. Daftar screenshot · K. Checklist · L. Tugas dan pengumpulan · M. Jika ada error

## A. Persiapan

1. `node -v` harus 18 atau lebih baru. Docker harus aktif (atau siapkan RabbitMQ cloud, lihat B).
2. Di folder `toko`, jalankan sekali: `npm run install:all` (sekarang juga memasang `amqplib` di `order-service` dan `notification-service`).
3. Prasyarat Lab 09 tetap berlaku: `gateway/.env` berisi `API_KEY` (dibuat otomatis oleh `npm run start:all` dari `.env.example`).
4. Siapkan terminal dengan pembagian ini (nama dipakai di seluruh panduan):

| Terminal | Isi |
|---|---|
| T1 | `product-service` (`cd product-service && node product-service.js`) |
| T2 | `order-service` (`cd order-service && node order-service.js`) |
| T3 | `gateway` (`cd gateway && node gateway.js`) |
| T4 | `notification-service` (consumer) |
| T5 | perintah uji (`node kirim-order.js`, `node smoke-test.js`) |
| T6 | consumer kedua (langkah 06) |

Catatan: `npm run start:all` hanya menjalankan product-service, order-service, dan gateway, dan Ctrl+C mematikan ketiganya sekaligus. Consumer sengaja dijalankan terpisah supaya bisa dimatikan sendiri.

Catatan stok: produk 1 hanya berstok 10. `kirim-order.js` memakai produk 2 (Mouse Wireless, stok 25) secara default agar stok tidak habis selama uji. Bila terjadi 409, restart product-service (data di memori).

Catatan penting soal `messageId`: id pesanan di order-service dimulai dari 1 setiap restart, sehingga `messageId` (`order-1`, ...) bisa sama dengan yang sudah pernah diproses consumer yang masih hidup, dan consumer akan mencatat "duplikat, dilewati". Jika kamu me-restart order-service, restart juga consumer.

## B. Langkah 01: Jalankan RabbitMQ

```bash
docker run -d --name rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```
(atau `npm run rabbit:up`). Tunggu sekitar 20 detik, lalu buka http://localhost:15672 (user `guest`, password `guest`) dan lihat tab **Queues**: masih kosong. Port 5672 dipakai aplikasi, 15672 untuk dashboard.

Jika Docker tidak bisa dipakai: buat instance gratis RabbitMQ di penyedia cloud (misalnya CloudAMQP) lalu isi alamatnya lewat environment variable `AMQP_URL` pada T2 dan T4/T6, misalnya `AMQP_URL="amqps://user:pass@host/vhost" node order-service.js`. Jangan menulis kredensial itu di file yang di-commit.

Screenshot: **S1** (`docker ps`), **S2** (dashboard, tab Queues kosong).

## C. Langkah 02: notification-service (consumer), dijalankan lebih dulu

```bash
cd notification-service
npm install
node notification-service.js
```
Hasil: `[notification-queue] menunggu pesan...`. Di dashboard, tab **Queues** menampilkan `notification-queue`, dan tab **Exchanges** menampilkan `orders` (fanout). Consumer harus dijalankan dulu supaya antrean sudah terikat ke exchange sebelum event pertama terbit.

Poin kode: `assertExchange('orders','fanout',{durable:true})`, `assertQueue` durable, `bindQueue`, `prefetch(1)`, pesan rusak di-`nack` tanpa requeue, `messageId` yang sudah ada dilewati lalu di-`ack`, `ack` setelah email "terkirim", dan opsi `--crash`.

Screenshot: **S3** (terminal consumer), **S4** (dashboard Queues dan Exchanges, dua gambar).

## D. Langkah 03: Publisher di order-service

Sudah diterapkan di `order-service/order-service.js`:
- `connectQueue()` dengan reconnect 3 detik, dipanggil sekali di `app.listen`
- `publishOrderCreated(order)` dengan `persistent: true`, `contentType: 'application/json'`, dan `messageId: order-<id>`
- pemanggilan `publishOrderCreated(order);` tepat setelah `orders.push(order);` dan sebelum `res.status(201)...`

Jalankan ulang order-service (T2). Hasil log: `terhubung ke RabbitMQ`. Jika RabbitMQ belum siap: `RabbitMQ belum tersedia, coba lagi dalam 3 detik`.

Screenshot: **S5** (log `terhubung ke RabbitMQ`), **S6** (potongan kode publisher dan pemanggilannya).

## E. Langkah 04: Uji alur normal

Pastikan T1, T2, T3, dan T4 hidup. Di T5:
```bash
node smoke-test.js
```
atau `node kirim-order.js 1`. Harapan: order dibalas **201** segera, dan beberapa detik kemudian T4 mencetak `email terkirim: pesanan #1 ...`. Balasan ke klien tidak menunggu email (lihat waktu `ms` pada `kirim-order.js`: puluhan ms, bukan 1000 ms).

Screenshot: **S7** (201 di T5 berdampingan dengan T4 yang mencetak email; 201 muncul lebih dulu).

## F. Langkah 05: Uji decoupling, consumer mati

1. (Disarankan) Di dashboard, buka `notification-queue` lalu **Purge Messages**, supaya hitungan pas.
2. Matikan consumer di T4 dengan Ctrl+C.
3. Di T5: `node kirim-order.js 3`. Ketiganya tetap 201. (**S8**)
4. Dashboard, tab **Queues**: kolom **Ready** pada `notification-queue` bernilai **3**. Tunggu beberapa detik (dashboard refresh sekitar 5 detik) lalu screenshot. (**S9**)
5. Nyalakan lagi consumer (T4): ketiga pesan diproses berurutan (masing-masing sekitar 1 detik) dan Ready kembali **0**. (**S10**, **S11**)

Kesimpulan: pengirim dan penerima tidak harus hidup bersamaan.

## G. Langkah 06: Dua consumer, berbagi beban vs pub/sub

**Competing consumers.** Jalankan `node notification-service.js` di dua terminal (T4 dan T6, antrean sama). Di T5: `node kirim-order.js 6`. Pesan dibagi di antara kedua consumer. (**S12**)

**Pub/Sub.** Hentikan salah satunya, lalu jalankan `node notification-service.js audit-queue` (antrean berbeda, tetap terikat ke exchange `orders`). Kirim beberapa order (`node kirim-order.js 3`): setiap antrean menerima salinan event yang sama. (**S13**: dashboard dengan kedua antrean dan log kedua consumer)

Catat perbedaannya untuk laporan:
- Competing consumers: banyak consumer pada satu antrean, tiap pesan hanya sampai ke satu consumer, tujuannya membagi beban kerja.
- Pub/Sub: banyak antrean pada satu exchange fanout, tiap antrean menerima salinan setiap event, tujuannya menyampaikan event yang sama ke beberapa penerima yang berbeda.

## H. Langkah 07: Uji pengiriman ulang dan idempotensi

1. Hentikan semua consumer. (Disarankan: Purge Messages pada `notification-queue` dan `audit-queue`.)
2. Jalankan satu consumer dengan `node notification-service.js --crash` (atau `npm run start:crash` dari `toko`).
3. Kirim satu order: `node kirim-order.js 1`. Consumer mencetak `email terkirim` lalu `crash sebelum ack!` dan berhenti. (**S14**)
4. Dashboard: pesan masih ada (status Ready, atau Unacked sesaat). Karena koneksi consumer terputus, broker segera mengembalikannya ke Ready, jadi kemungkinan besar kamu melihat Ready = 1. (**S15**)
5. Jalankan consumer biasa (tanpa `--crash`, di terminal yang sama atau tampilkan kedua terminal): pesan dikirim ulang dan `email terkirim` tercetak untuk **kedua kalinya**. (**S16**)

Kenapa duplikat tidak terdeteksi: daftar `processed` ada di memori dan hilang saat proses mati.

Kesimpulan yang harus ada di laporan: broker menjamin pesan setidaknya sekali sampai (at-least-once), bukan tepat sekali. Consumer harus idempotent, dan pencatatan "sudah diproses" harus disimpan di penyimpanan yang tahan restart (misalnya tabel database), bukan di memori.

### Opsional untuk refleksi (a): RabbitMQ mati saat order dibuat
Hentikan broker (`docker stop rabbit`), kirim `node kirim-order.js 1`: order tetap **201**, tetapi log order-service menampilkan `channel tidak tersedia, event TIDAK terkirim: <id>`. Nyalakan lagi dengan `docker start rabbit`. Event itu tidak pernah sampai ke consumer. Screenshot opsional: **S20**.

## I. Langkah 08: Diagram, commit, dan bukti

Diagram baru: `docs/arsitektur-toko-lab10.png` (juga `.svg`), memuat RabbitMQ, exchange `orders`, antrean, dan notification-service (serta audit-service opsional).

Commit ke repository yang sama (Lab 09), mencakup folder `notification-service` dan perubahan di `order-service`, tanpa `node_modules` dan tanpa kredensial:
```bash
git add .
git status          # pastikan TIDAK ada node_modules dan .env
git commit -m "Lab 10: event order.created via RabbitMQ, notification-service"
git push
```
`.gitignore` sudah memuat `node_modules/` dan `.env`. Alamat broker hanya lewat environment variable `AMQP_URL`, bukan ditulis di kode.

Screenshot: **S17** (halaman repository: folder `notification-service` dan `order-service`, tanpa `node_modules`), **S18** (`.gitignore` dan bukti tidak ada kredensial), **S19** (diagram).

## J. Daftar screenshot

Wajib (diminta soal Tugas Kelompok): **S9** (dashboard Ready = 3), **S10** (log consumer setelah dinyalakan kembali), **S14** dan **S16** (log uji `--crash` yang menunjukkan email terkirim dua kali), **S19** (diagram), ditambah **tautan repository**.

Pendukung agar laporan lengkap per langkah dan checklist:

| Kode | Isi |
|---|---|
| S1 | `docker ps`, container `rabbit` berjalan |
| S2 | Dashboard, tab Queues masih kosong |
| S3 | Consumer: `menunggu pesan...` |
| S4 | Dashboard: `notification-queue` (Queues) dan `orders` fanout (Exchanges) |
| S5 | order-service: `terhubung ke RabbitMQ` |
| S6 | Kode `publishOrderCreated` dan pemanggilannya |
| S7 | 201 lalu email tercetak (alur normal) |
| S8 | Consumer mati, tiga order tetap 201 |
| S9 | Dashboard Ready = 3 (wajib) |
| S10 | Consumer menyala lagi, tiga pesan diproses (wajib) |
| S11 | Dashboard Ready kembali 0 |
| S12 | Dua consumer, pesan terbagi (competing) |
| S13 | `audit-queue` dan `notification-queue`, salinan sama (pub/sub) |
| S14 | Log `--crash`: email terkirim lalu `crash sebelum ack!` (wajib) |
| S15 | Dashboard: pesan masih di antrean |
| S16 | Consumer biasa: email terkirim kedua kali (wajib) |
| S17 | Repository: `notification-service`, `order-service`, tanpa `node_modules` |
| S18 | `.gitignore` dan bukti tanpa kredensial |
| S19 | Diagram arsitektur terbaru (wajib) |
| S20 | Opsional: RabbitMQ mati, 201 tetapi event TIDAK terkirim |

Tips: sertakan perintah, kode status, dan nama terminal dalam satu tangkapan. Jangan menampilkan API key atau kredensial AMQP asli.

## K. Checklist kesiapan (dari soal)

- [ ] RabbitMQ berjalan dan dashboard dapat dibuka
- [ ] order-service menerbitkan event `order.created` dan tetap membalas `201` tanpa menunggu consumer
- [ ] notification-service mencetak email untuk tiap pesanan baru
- [ ] Saat consumer mati, pesan menumpuk (Ready > 0) dan terproses setelah consumer menyala
- [ ] Kamu sudah membedakan competing consumers dan pub/sub dari hasil percobaan
- [ ] Kamu sudah melihat pesan terkirim dua kali pada uji `--crash`
- [ ] Tidak ada kredensial atau `node_modules` di repository

## L. Tugas dan pengumpulan (sebelum Lab 11)

Kumpulkan: (1) tautan repository, (2) screenshot dashboard saat consumer mati (Ready = 3) dan log consumer setelah dinyalakan kembali, (3) screenshot log uji `--crash` yang menunjukkan email terkirim dua kali, (4) diagram arsitektur yang diperbarui.

Penerapan ke proyek kelompok: `docs/penerapan-async-proyek-kelompok.md` (event `booking.paid` di sistem reservasi kereta: nama event, isi pesan, producer, consumer, dan alasan cocok asinkron).

Refleksi 4 sampai 5 kalimat (a, b, c): `docs/refleksi-lab10.md`.

Laporan dibuat setelah semua screenshot terkumpul.

## M. Jika ada error

- `connect ECONNREFUSED 127.0.0.1:5672`: RabbitMQ belum siap atau container mati. Cek `docker ps`, tunggu sampai dashboard di port 15672 bisa dibuka. Jika port bentrok: `docker rm -f rabbit` lalu jalankan ulang.
- Event tidak muncul di consumer padahal order berhasil: pada exchange fanout, pesan yang terbit saat belum ada antrean terikat langsung hilang. Jalankan consumer minimal sekali sebelum menerbitkan event.
- `PRECONDITION_FAILED - inequivalent arg 'durable'`: antrean atau exchange sudah ada dengan pengaturan berbeda. Hapus lewat dashboard (tab Queues/Exchanges), lalu jalankan ulang.
- Pesan hilang setelah RabbitMQ di-restart: pastikan exchange dan antrean `durable: true` dan pesan diterbitkan dengan `persistent: true` (sudah ada di kode).
- Pesan terus berstatus Unacked: consumer tidak memanggil `ack` atau `nack` pada semua jalur kode. Setiap pesan harus diakhiri dengan salah satunya.
- Consumer mencetak `duplikat, dilewati: order-1` setelah order-service di-restart: id pesanan mulai dari 1 lagi. Restart consumer.
- `409` saat kirim order: stok produk habis. Restart product-service (data di memori).
- `429`: kena rate limit gateway (20 request per 10 detik). Tunggu 10 detik.
- `401`: `API_KEY` di `gateway/.env` berbeda atau belum ada. `kirim-order.js` membacanya otomatis dari `gateway/.env`.
