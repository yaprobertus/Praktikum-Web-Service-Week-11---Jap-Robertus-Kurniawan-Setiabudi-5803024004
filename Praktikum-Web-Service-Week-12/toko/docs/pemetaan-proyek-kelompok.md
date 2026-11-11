# Penerapan ke Proyek Kelompok (Topik A: Reservasi Tiket Kereta)

Pola yang sama dengan toko diterapkan ke sistem reservasi kereta (kode lengkap ada di folder `proyek-kelompok/`).
Seandainya sistem ini masih monolit, titik ikatnya sama seperti `p.stock -= qty` pada toko: proses booking
mengubah status kursi secara langsung. Pada versi microservices, ikatan itu diganti dengan panggilan API ke
pemilik data kursi (jadwal-service), sedangkan pemesanan menyimpan salinan harga dan total saat transaksi.

## Pemetaan fitur dan data

Service 1: jadwal-service (port 3000)
- Data yang dimiliki: daftar perjalanan (KA-001, KA-002, KA-003), status 40 kursi per perjalanan (AVAILABLE, LOCKED, BOOKED), dan daftar lock beserta masa berlakunya (TTL 10 menit). Pemilik tunggal data kursi.
- API yang ditawarkan ke klien (lewat gateway, prefix /jadwal): GET /jadwal/, GET /jadwal/:id, GET /jadwal/:id/kursi, dan GET /jadwal/:id/kursi/stream (Server-Sent Events untuk kursi real-time).
- API internal untuk service lain (diblokir dari luar oleh gateway dan dilindungi header X-Internal-Token): POST /internal/lock, POST /internal/confirm, POST /internal/release.

Service 2: booking-service (port 3001)
- Data yang dimiliki: daftar booking (id, status, penumpang, kursi, total, batas bayar, lockId) dan catatan Idempotency-Key. Tidak menyimpan status kursi sendiri.
- API yang ditawarkan ke klien (lewat gateway, prefix /booking, wajib X-API-Key): GET /booking/, POST /booking/, GET /booking/:id, POST /booking/:id/bayar, POST /booking/:id/batal.
- Salinan data saat transaksi: total harga, kode kursi, dan batas bayar disimpan di booking, sehingga riwayat tetap benar walau data perjalanan berubah.

## Tempat service saling memanggil

booking-service memanggil jadwal-service pada tiga titik: saat membuat booking (POST /internal/lock untuk mengunci kursi), saat pembayaran (POST /internal/confirm agar kursi menjadi BOOKED), dan saat pembatalan atau kedaluwarsa (POST /internal/release agar kursi kembali AVAILABLE). Panggilan memakai HTTP dengan timeout 5 detik, dan bila jadwal-service tidak dapat dihubungi, booking-service membalas 502 dengan pesan yang jelas. jadwal-service tidak pernah memanggil booking-service, sehingga arah ketergantungan hanya satu arah.
