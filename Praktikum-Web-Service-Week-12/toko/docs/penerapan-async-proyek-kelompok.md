# Penerapan ke Proyek Kelompok (Lab 10): Interaksi yang Dibuat Asinkron

Sistem: reservasi tiket kereta (Topik A), terdiri dari jadwal-service (data kursi) dan booking-service (data booking).
Di Lab 09 hubungan antar-service dipetakan. Pada Lab 10 satu interaksi diubah menjadi asinkron lewat event.

## Interaksi yang dipilih: pemberitahuan e-tiket setelah pembayaran lunas

Saat ini, setelah penumpang membayar (`POST /booking/:id/bayar`), booking-service memanggil jadwal-service (`/internal/confirm`) lalu membalas. Pengiriman e-tiket
atau email konfirmasi ke penumpang belum ada, dan bila ditambahkan secara sinkron, pembayaran akan ikut lambat atau gagal ketika layanan email bermasalah.
Karena itu pengiriman e-tiket dijadikan event.

Bagian yang tetap sinkron: `lock`, `confirm`, dan `release` kursi. Ketiganya menentukan hasil yang langsung dibutuhkan klien (kursi sudah dikunci atau bentrok 409), sehingga harus selesai sebelum booking-service membalas.

## Rincian event

Nama event: `booking.paid`

Exchange: `bookings` (fanout, durable). Antrean: `ticket-notification-queue` (durable). Antrean tambahan opsional: `booking-audit-queue`.

Producer: booking-service. Event diterbitkan setelah status booking menjadi `LUNAS` dan kursi berhasil dikonfirmasi, tepat sebelum membalas `200` ke klien.

Consumer: ticket-notification-service (mengirim e-tiket dan email konfirmasi). Consumer kedua yang opsional: audit-service (mencatat transaksi pembayaran).

Isi pesan (JSON, `persistent: true`, properti `messageId` = `booking-<id>`):

```json
{
  "type": "booking.paid",
  "data": {
    "id": "BK-1A2B3C4D",
    "status": "LUNAS",
    "perjalananId": "KA-002",
    "kursi": ["3A", "3B"],
    "penumpang": { "nama": "Budi Santoso" },
    "total": 450000,
    "dibayar": "2026-11-04T08:30:00.000Z"
  }
}
```

Alasan cocok dibuat asinkron:
1. Klien tidak perlu menunggu email terkirim. Pembayaran sudah sah begitu kursi menjadi BOOKED, sedangkan e-tiket boleh tiba beberapa detik kemudian.
2. Kegagalan layanan notifikasi tidak boleh membatalkan pembayaran. Dengan antrean, event menunggu sampai consumer pulih (terbukti di Lab 10 Langkah 05).
3. Penerima baru (audit, statistik penjualan, poin loyalitas) dapat ditambahkan sebagai antrean baru tanpa mengubah booking-service (pola pub/sub, Langkah 06).
4. Beban lonjakan (misalnya banyak pembayaran saat libur panjang) diratakan oleh antrean, dan beberapa consumer dapat berbagi beban (competing consumers).

Konsekuensi yang harus ditangani: pengiriman setidaknya sekali (at-least-once) berarti e-tiket bisa terkirim dua kali. Consumer harus idempotent dengan mencatat `messageId`
(`booking-<id>`) yang sudah diproses di penyimpanan tahan restart, misalnya tabel dengan kunci unik, bukan di memori.
