# NEXMAP — Open World GPS, Smart Mobility & Civic Gamification Platform
**Tagline:** *Navigate, Explore, Experience*  
**Platform Version:** 1.2.0 (Production Blueprint & Live Prototype)

---

## 🌟 Tentang NEXMAP
**NEXMAP** adalah ekosistem mobilitas cerdas masa depan yang menggabungkan:
1. **Open-World GPS Navigation:** Navigasi rute dengan visualisasi pergerakan armada multi-moda real-time (TransJakarta, Patroli Korlantas, Ambulans, Logistik, Pengemudi Komunitas).
2. **Community Live Reporting & Bayesian Trust Engine:** Pelaporan insiden jalan (kecelakaan, banjir, lubang, rekayasa lalin) berbasis konsensus komunitas dengan pembobotan reputasi untuk mencegah hoaks/spam.
3. **Safe Gamification & Anti-Cheat:** Sistem reward XP, level progression, rank tier, misi harian/mingguan, dan leaderboard multi-kategori yang aman dan tidak mendorong berkendara ugal-ugalan.
4. **Traffic Intelligence & Civic Hub:** Integrasi resmi dua arah dengan instansi pemerintah (Korlantas Polri, Dishub DKI, BMKG, BPBD) dan metrik Automated Congestion Index (ACI).
5. **NEX Store & Digital Economy:** Monetisasi etis murni kosmetik (Map Skins Cyberpunk/Dark Gold, ikon kendaraan 3D, title profil) menggunakan sistem dual-currency (NEX Coins & NEX Gems) dengan simulasi pembayaran QRIS idempoten.
6. **Safety Center & Kepatuhan UU PDP:** Tombol Emergency SOS darurat, direktori cepat 110/112/119/113, fallback SMS offline dengan kompresi koordinat, dan Fuzzy Privacy Masking sesuai UU No. 27/2022.

---

## 🏗️ Struktur Arsitektur Sistem

```
nexmap/
├── MASTER_PLAN.md                  # Dokumen resmi Master Plan & Spesifikasi Detail
├── README.md                       # Panduan instalasi dan dokumentasi sistem
├── package.json                    # Konfigurasi dependensi (Express, WS, CORS)
├── server.js                       # Server utama (Express REST API & WebSocket Telemetry Stream)
├── database/
│   ├── db.js                       # SQLite & PostGIS geospasial database wrapper (Node native SQLite)
│   ├── migrations.js               # Migrasi skema idempoten (aman untuk DB lama)
│   ├── schema.sql                  # Skema database relasional geospasial lengkap
│   └── seed.js                     # Seeder data realistis Jakarta (Users, Armada, Laporan, Toko, Berita)
├── src/
│   └── services/
│       ├── trackingService.js      # Simulasi telemetri armada real-time & routing sadar-insiden
│       ├── trustEngine.js          # Konsensus Bayesian, voting ber-geofence & lifecycle laporan
│       ├── gamificationService.js  # XP ledger, leveling, 6 kategori leaderboard & Anti-Cheat
│       ├── missionService.js       # Misi harian/mingguan & klaim hadiah idempoten
│       ├── achievementService.js   # 10 achievement, metrik & progress tracking
│       ├── socialService.js        # Follow/unfollow, profil publik & scope leaderboard teman
│       ├── supportService.js       # Help Center FAQ & tiket dukungan
│       ├── newsService.js          # Feed berita lalin terpersonalisasi (resmi + komunitas)
│       ├── trafficService.js       # Segmen lalu lintas, ACI & penalti ETA akibat insiden
│       ├── paymentService.js       # Transaksi idempoten, QRIS, Virtual Account & Store
│       ├── safetyService.js        # SOS persisten, tautan live tracking & UU PDP Privacy Zones
│       └── civicService.js         # Hub siaran resmi Korlantas/Dishub/BMKG
├── public/
│   ├── index.html                  # Antarmuka Single Page Application (SPA) responsif
│   ├── manifest.json               # Manifest PWA (installable, theme, ikon)
│   ├── sw.js                       # Service worker cache offline
│   ├── offline.html                # Halaman fallback saat offline
│   ├── css/
│   │   ├── style.css               # Desain Glassmorphism Cyberpunk & Dark-Gold
│   │   └── features.css            # UI notifikasi, perjalanan, komentar, analitik
│   └── js/
│       └── app.js                  # Engine client interaktif (Leaflet Map, WS, Modals, State)
├── scripts/
│   ├── smoke.js                    # End-to-end API smoke test (111 pemeriksaan)
│   └── inspect.js                  # Inspeksi tabel & kolom database
└── tests/
    └── nexmap.test.js              # Unit & Integration Test Suite komprehensif
```

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Prasyarat
- **Node.js:** Versi 22.0.0 atau lebih baru (direkomendasikan Node.js 22+ karena telah menyertakan engine SQLite bawaan performa tinggi).
- **NPM:** Versi 10+.

### 2. Instalasi & Setup Database
Buka terminal pada direktori `nexmap`:
```bash
# Instal dependensi
npm install

# Inisialisasi dan isi data awal database
npm run seed
```

### 3. Menjalankan Server & Aplikasi Web
```bash
npm start
```
Aplikasi akan aktif di:
- **Web App & Peta Interaktif:** [http://localhost:3000](http://localhost:3000)
- **WebSocket Telemetry Stream:** `ws://localhost:3000/v1/stream`

### 4. Konfigurasi Peta (Tile Provider)
Secara default NEXMAP memakai tile **OpenStreetMap** yang tidak memerlukan API key, lalu diwarnai ulang dengan CSS untuk tema *Cyberpunk*, *Dark Gold*, dan *Synthwave*. Jika ingin memakai penyedia lain (mis. MapTiler, Stadia, atau CARTO dengan key), set variabel lingkungan sebelum `npm start`:

```bash
# Windows PowerShell
$env:NEXMAP_TILE_URL="https://tile.openstreetmap.org/{z}/{x}/{y}.png"

# Linux/macOS
export NEXMAP_TILE_URL="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
```

Gunakan placeholder `{z}`, `{x}`, `{y}`; `{s}` juga didukung bila penyedia memakai subdomain. Jika Anda memakai layanan ber-key, sertakan key langsung pada URL template. Konfigurasi aktif dapat dicek di `GET /api/config`.

> Catatan: URL template seperti `https://tile.openstreetmap.org/{z}/{x}/{y}.png` **tidak bisa dibuka langsung di browser** karena `{z}/{x}/{y}` harus diganti Leaflet dengan nomor tile. Contoh tile valid: `https://tile.openstreetmap.org/12/3277/2128.png`.
>
> Jika penyedia utama gagal dimuat, klien otomatis beralih ke penyedia cadangan (OSM France HOT, lalu Esri World Dark Gray).

---

## 🧪 Menjalankan Automated Test Suite

Untuk memastikan seluruh algoritma (Trust Scoring, Anti-Cheat, Formula Level, Transaksi Idempoten, dan Privacy Masking) berfungsi 100%:
```bash
npm test
```

Untuk pengujian end-to-end seluruh REST API:
```bash
npm run smoke      # menyalakan server + database sementara sendiri, 111 pemeriksaan API
npm run verify     # unit test + smoke test sekaligus
```

`npm run smoke` bersifat mandiri: ia membuat database sementara di folder temp, menjalankan seeder, menyalakan server pada port acak, lalu membersihkan semuanya setelah selesai. Jadi suite ini dapat dijalankan berulang tanpa mengubah data pengembangan. Untuk menguji instance yang sudah berjalan, set `NEXMAP_SMOKE_BASE=http://localhost:3000`.

Hasil pengujian otomatis:
- ✔️ **Gamification Engine:** Perhitungan kurva level $100 \times L^{1.65}$ dan penentuan Rank Tiers.
- ✔️ **Anti-Cheat Engine:** Deteksi sinyal Mock GPS, batas kecepatan $> 180\text{ km/jam}$, dan akselerasi teleportasi $> 20\text{ m/s}^2$.
- ✔️ **Trust Engine:** Pembobotan konsensus Bayesian dan validasi geofence pemilih ($< 2\text{ km}$).
- ✔️ **Payment Engine:** Pencegahan pemrosesan transaksi ganda (*idempotency key*) dan webhook ledger.
- ✔️ **Safety Center:** Pemicu SOS darurat, direktori 110/112, dan penyamaran koordinat Fuzzy Privacy UU PDP.
- ✔️ **Civic Intelligence:** Indeks kemacetan Automated Congestion Index (ACI).
- ✔️ **Notification Service:** Persistensi, hitungan belum dibaca, tandai baca, dan validasi kepemilikan.
- ✔️ **Saved Places:** CRUD, validasi koordinat, dan penolakan duplikat.
- ✔️ **Report Comments:** Anti-spam, kepemilikan komentar, dan moderasi.
- ✔️ **Trip Service:** Riwayat, agregat statistik, dan seri 7 hari.
- ✔️ **PWA:** Manifest, service worker, halaman offline, dan ikon dapat diakses.

---

## 🗺️ Panduan Fitur yang Dapat Dicoba di Browser

1. **Navigasi Rute & Kepadatan Jalan:**
   - Pilih destinasi populer (*GBK Senayan*, *Bundaran HI*, *Blok M*, atau *Kuningan City*).
   - Perhatikan rute navigasi yang digambar dengan warna kemacetan (Hijau: Lancar, Kuning: Mulai Padat, Oranye: Padat).
2. **Telemetri Kendaraan Bergerak Real-Time:**
   - Ikon bus TransJakarta, mobil polisi, ambulans, dan truk logistik bergerak secara dinamis di sepanjang jalanan utama Jakarta setiap 2 detik via WebSocket.
3. **Kirim Laporan Kondisi Jalan (Live Report):**
   - Ketuk tombol **"📸 Lapor Kondisi Jalan"** di bagian bawah.
   - Pilih kategori (misal: Genangan Banjir, Lubang Jalan), masukkan judul, dan kirim.
   - Laporan langsung muncul sebagai pin interaktif di peta dan memberi Anda **+20 XP**!
4. **Validasi Konsensus Komunitas:**
   - Klik salah satu pin laporan di peta, lalu klik **"🔍 Validasi Kejadian"**.
   - Berikan suara (*Masih Terjadi / Selesai / Laporan Palsu*). Skor kepercayaan laporan akan diperbarui secara otomatis dan Anda mendapatkan reward **+5 XP**.
5. **Simulasi Perjalanan Tertib (+XP):**
   - Ketuk tombol **"🚗 Selesai Perjalanan (+XP)"** di bilah bawah.
   - Sistem akan memvalidasi perjalanan melalui modul Anti-Cheat dan menambahkan XP serta progress bar level Anda.
6. **NEX Store & Top-Up QRIS:**
   - Buka tab **"💎 NEX Store"**.
   - Beli atau pasang item kosmetik (tema peta *Cyberpunk* atau *Dark Gold* yang langsung mengubah gaya visual peta seketika).
   - Coba fitur **"Beli NEX Gems"** untuk membuka simulasi pembayaran QRIS dengan 1-klik konfirmasi sukses.
7. **Pusat Keselamatan (SOS) & Privasi UU PDP:**
   - Ketuk tombol merah **"🚨 SOS DARURAT"**.
   - Sistem akan menyimulasikan penyebaran siaran darurat ke kontak terdaftar, tautan pemantau live 2 jam, template pesan SMS offline, dan direktori panggilan 110 / 112.
   - Atur proteksi privasi lokasi (*Fuzzy Radius Masking*) pada menu pengaturan.
8. **Konsol Moderasi Admin & Siaran Resmi (B2G):**
   - Buka tab **"⚙️ Admin Moderasi"** untuk menyetujui/menolak laporan warga atau menyiarkan peringatan resmi atas nama Korlantas Polri / Dishub / BMKG.

---

## 🆕 Fitur Baru v1.1

1. **Gamifikasi Lanjutan**
   - Tab **🏆 Gamifikasi** memiliki 3 sub-tab: Leaderboard, Misi, dan Achievement.
   - Leaderboard mendukung 6 kategori (Explorer, Reporter, Contributor, Navigator, Safety Guardian, City Explorer), filter periode (*Weekly / Monthly / All Time*), dan scope (*Global / Friends*).
   - Misi harian/mingguan dengan progress bar dan tombol klaim hadiah (idempoten, tidak bisa diklaim dua kali).
   - 10 achievement dengan progress otomatis dan reward NEX Coins.
2. **Berita Lalu Lintas Terpersonalisasi**
   - Tab **📰 Berita Lalin** menggabungkan pengumuman resmi pemerintah, berita newsroom, dan live report terverifikasi.
   - Setiap berita menghitung jarak dari posisi Anda dan menandai yang relevan, dengan layer marker di peta.
3. **Profil & Sosial**
   - Tab **👤 Profil** untuk mencari pengguna, melihat profil publik, achievement, serta follow/unfollow.
   - Profil mode *ghost* menyembunyikan metrik sensitif dari pengguna lain (privacy-by-default).
4. **Help Center & Tiket Dukungan**
   - Tab **❓ Bantuan** berisi FAQ berkategori + pencarian, serta form tiket dukungan.
   - Admin dapat membalas tiket dari konsol moderasi.
5. **Upload Bukti Foto**
   - Form laporan menerima upload gambar (PNG/JPEG/WebP, maks. 3MB) yang divalidasi berdasarkan MIME dan disimpan di `public/uploads/`.
6. **Privasi & Hak Subjek Data (UU PDP)**
   - Pratinjau Fuzzy Privacy Zone, Ghost Mode, ekspor seluruh data pengguna (JSON), dan penghapusan riwayat perjalanan/voting.
7. **Keamanan Pembayaran**
   - Webhook pembayaran mendukung tanda tangan **HMAC-SHA256** (`orderId:status`). Set strict dengan `PAYMENT_STRICT=true`.
8. **Audit Log**
   - Semua aksi penting (laporan, moderasi, pembelian, privasi, pembayaran, tiket) dicatat dan dapat dilihat di konsol admin.

---

## 🆕 Fitur Baru v1.2

1. **Pusat Notifikasi Real-time**
   - Lonceng notifikasi di header dengan badge jumlah belum dibaca.
   - Notifikasi persisten untuk level-up, achievement, misi, pengikut baru, komentar, balasan tiket, pembayaran, moderasi, dan perubahan status laporan.
   - Dorong langsung lewat WebSocket (`NOTIFICATION`), bisa ditandai dibaca satu per satu atau semua sekaligus.
2. **Riwayat & Statistik Perjalanan**
   - Tab **🧾 Perjalanan** menampilkan total km, jam berkendara, rata-rata kecepatan, rasio perjalanan valid/ditolak, XP, dan grafik 7 hari terakhir.
   - Hanya perjalanan yang lolos anti-cheat yang dihitung untuk statistik dan hadiah.
3. **Tempat Tersimpan (Favorit)**
   - Simpan hingga 20 lokasi (Rumah, Kantor, Kampus) dari panel navigasi dan jadikan tujuan dengan satu klik.
   - Validasi duplikat nama, koordinat, dan batas maksimum.
4. **Diskusi pada Laporan**
   - Komentar pada setiap laporan dengan anti-spam (identik dalam 60 detik), moderasi status, dan notifikasi ke penulis laporan.
   - Komentar baru disiarkan real-time (`REPORT_COMMENT`).
5. **Manajemen Kontak Darurat**
   - Tambah/hapus hingga 10 kontak darurat dengan validasi nomor telepon; dipakai oleh alur SOS.
6. **Analitik & Ekspor Admin**
   - Ringkasan laporan per kategori/status, tren 7 hari, pendapatan, perjalanan, dan kontributor teratas.
   - Ekspor CSV untuk laporan, perjalanan, transaksi, dan tiket dengan proteksi formula-injection.
7. **Progressive Web App (PWA)**
   - `manifest.json`, service worker dengan cache offline, halaman offline, dan ikon aplikasi.
   - Aset statis memakai cache-first; navigasi memakai network-first dengan fallback offline.
8. **Perbaikan Bug & Hardening**
   - Guard anti-duplikasi laporan (kategori sama dalam 150 m / 15 menit → HTTP 409).
   - Sanitasi input XP (NaN/negatif), pruning notifikasi per pengguna, heartbeat WebSocket, dan escaping CSV.

---

## 🔌 Ringkasan REST API

| Grup | Endpoint |
|------|----------|
| Meta | `GET /api/health`, `GET /api/meta`, `GET /api/config` |
| Pengguna | `GET /api/user/profile`, `POST /api/user/privacy`, `POST /api/user/privacy/preview`, `GET /api/user/export`, `DELETE /api/user/history` |
| Notifikasi | `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`, `DELETE /api/notifications` |
| Perjalanan | `POST /api/trips/finish`, `GET /api/trips`, `GET /api/trips/stats` |
| Tempat Tersimpan | `GET /api/places`, `POST /api/places`, `PATCH /api/places/:id`, `DELETE /api/places/:id` |
| Kendaraan & Lalu Lintas | `GET /api/vehicles/live`, `GET /api/traffic/segments`, `GET /api/traffic/summary` |
| Navigasi | `GET /api/navigation/route` |
| Laporan | `GET /api/reports/active`, `GET /api/reports/:id`, `POST /api/reports`, `POST /api/reports/:id/vote`, `GET /api/reports/:id/comments`, `POST /api/reports/:id/comments`, `DELETE /api/reports/comments/:commentId` |
| Gamifikasi | `POST /api/trips/finish`, `GET /api/gamification/leaderboard`, `GET /api/gamification/missions`, `POST /api/gamification/missions/:id/claim`, `GET /api/gamification/achievements` |
| Sosial | `GET /api/social/users`, `GET /api/social/profile/:id`, `POST /api/social/follow/:id`, `POST /api/social/unfollow/:id`, `GET /api/social/following`, `GET /api/social/followers` |
| Berita | `GET /api/news`, `POST /api/news` |
| Bantuan | `GET /api/help/faqs`, `GET /api/help/tickets`, `POST /api/help/tickets` |
| Store & Pembayaran | `GET /api/store/items`, `POST /api/store/buy`, `POST /api/store/equip`, `POST /api/store/topup/initiate`, `POST /api/store/topup/webhook`, `POST /api/store/topup/simulate-payment` |
| Keselamatan | `POST /api/safety/sos/trigger`, `POST /api/safety/sos/resolve`, `GET /api/safety/sos/active`, `GET /api/safety/contacts`, `POST /api/safety/contacts`, `DELETE /api/safety/contacts/:id` |
| Civic | `GET /api/civic/announcements`, `POST /api/civic/announcements` |
| Admin | `GET /api/admin/overview`, `GET /api/admin/analytics`, `GET /api/admin/export/:type`, `POST /api/admin/reports/:id/moderate`, `POST /api/admin/tickets/:id/reply`, `GET /api/admin/audit-logs` |
| Upload | `POST /api/upload` |
| WebSocket | `ws://localhost:3000/v1/stream` |

### Channel WebSocket
`INIT_STATE`, `VEHICLES_TELEMETRY`, `TRAFFIC_TELEMETRY`, `NEW_REPORT`, `REPORT_UPDATED`, `REPORTS_EXPIRED`, `USER_UPDATED`, `SOS_ALERT`, `CIVIC_ANNOUNCEMENT`, `TRAFFIC_NEWS`, `NOTIFICATION`, `REPORT_COMMENT`.

---

## 🔐 Catatan Keamanan & Produksi

- Autentikasi belum diimplementasikan; seluruh request memakai demo user `usr-demo-001`. Ganti dengan JWT/sesi sebelum produksi.
- `NEXMAP_WEBHOOK_SECRET` wajib diisi dari secret manager, dan aktifkan `PAYMENT_STRICT=true`.
- Upload disimpan lokal; gunakan S3/MinIO + pemindaian malware untuk produksi.
- SQLite cocok untuk prototipe; skema kompatibel untuk migrasi ke PostgreSQL/PostGIS.
