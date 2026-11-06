# MASTER PLAN: NEXMAP PLATFORM
**Tagline:** *Navigate, Explore, Experience*  
**Document Version:** 1.0.0 (Master Blueprint)  
**Target Domain:** Smart Mobility, Open-World Geospatial Crowdsourcing, Gamified Commute & Civic Intelligence  
**Applicable Jurisdictions & Standards:** Indonesia (UU PDP No. 27/2022, Kominfo PSE, BI Payment Standards) & Global Geospatial Standards (OGC, WGS84)

---

## DAFTAR ISI
1. [EXECUTIVE SUMMARY & PRODUCT VISION](#1-executive-summary--product-vision)
2. [TARGET AUDIENCE & VALUE PROPOSITION](#2-target-audience--value-proposition)
3. [SYSTEM ARCHITECTURE & TECH STACK](#3-system-architecture--tech-stack)
4. [CORE MODULE 1: GPS ENGINE & REAL-TIME TRACKING](#4-core-module-1-gps-engine--real-time-tracking)
5. [CORE MODULE 2: COMMUNITY LIVE REPORT & TRUST ENGINE](#5-core-module-2-community-live-report--trust-engine)
6. [CORE MODULE 3: GAMIFICATION, ANTI-CHEAT & REPUTATION SYSTEM](#6-core-module-3-gamification-anti-cheat--reputation-system)
7. [CORE MODULE 4: TRAFFIC INTELLIGENCE & CIVIC PORTAL](#7-core-module-4-traffic-intelligence--civic-portal)
8. [CORE MODULE 5: DIGITAL ECONOMY & NEX STORE (MONETIZATION)](#8-core-module-5-digital-economy--nex-store-monetization)
9. [CORE MODULE 6: SAFETY CENTER, EMERGENCY SOS & PRIVACY (UU PDP)](#9-core-module-6-safety-center-emergency-sos--privacy-uu-pdp)
10. [CORE MODULE 7: ADMIN, MODERATION & B2G/B2B DASHBOARD](#10-core-module-7-admin-moderation--b2gb2b-dashboard)
11. [DATABASE ARCHITECTURE & CORE DATA SCHEMA](#11-database-architecture--core-data-schema)
12. [API CONTRACTS & REAL-TIME PROTOCOLS](#12-api-contracts--real-time-protocols)
13. [ROADMAP, IMPLEMENTATION PHASES & RISK MITIGATION](#13-roadmap-implementation-phases--risk-mitigation)

---

## 1. EXECUTIVE SUMMARY & PRODUCT VISION

### 1.1 Visi Produk: The Open-World Living Map
Mayoritas aplikasi navigasi konvensional (Google Maps, Apple Maps, Waze) memperlakukan peta semata-mata sebagai alat utilitas statis: memasukkan titik A ke B, lalu mengikuti suara belokan. Interaksi sosial sangat terbatas, dan perjalanan harian terasa menjemukan.

**NEXMAP** mendefinisikan ulang peta digital menjadi **Living Digital Twin / Open World Mobility Ecosystem**:
1. **Dinamis & Terbuka:** Peta hidup dengan visualisasi pergerakan kendaraan multi-moda (armada bus, logistik, pengemudi komunitas) yang disiarkan secara aman dan real-time.
2. **Kekuatan Crowdsourcing Cerdas:** Setiap pengguna bukan sekadar penumpang pasif, melainkan *sensor hidup kota* yang melaporkan lubang jalan, banjir, kemacetan, hingga penutupan jalur.
3. **Gamifikasi Beretika & Sehat:** Mengubah perjalanan komuter menjadi eksplorasi ala RPG tanpa mendorong perilaku berkendara ugal-ugalan atau ngebut.
4. **Pusat Informasi Sipil Resmi:** Jembatan komunikasi dua arah antara otoritas resmi (Dishub, Korlantas Polri, BMKG, BPBD) dan masyarakat pengguna jalan.
5. **Ekonomi Kosmetik Berkelanjutan:** Monetisasi berbasis vanity items (skin peta, efek jejak jalan, ikon kendaraan, avatar badge) yang adil tanpa elemen pay-to-win.

```
                           +--------------------------------------+
                           |          NEXMAP ECOSYSTEM            |
                           |   "Navigate, Explore, Experience"    |
                           +------------------+-------------------+
                                              |
      +-------------------+-------------------+-------------------+-------------------+
      |                   |                   |                   |                   |
+-----v-----+       +-----v-----+       +-----v-----+       +-----v-----+       +-----v-----+
| REAL-TIME |       | COMMUNITY |       | GAMIFIED  |       | CIVIC &   |       | DIGITAL   |
| TELEMETRY |       | SENSING   |       | COMMUTE   |       | TRAFFIC   |       | STORE &   |
| & MAPPING |       | (REPORTS) |       | (XP/RANK) |       | INTELL.   |       | COSMETICS |
+-----------+       +-----------+       +-----------+       +-----------+       +-----------+
```

---

## 2. TARGET AUDIENCE & VALUE PROPOSITION

| Segmen Pengguna | Kebutuhan Utama | Solusi Unik NEXMAP |
|---|---|---|
| **Komuter Harian (Motor & Mobil)** | Rute tercepat, hindari razia/titik banjir/macet dadakan. | Lapisan peta real-time interaktif, report terverifikasi cepat, rewards XP perjalanan harian. |
| **Pengguna Transportasi Umum** | Kepastian kedatangan bus/angkot/kereta. | Live tracker armada resmi dengan perkiraan menit kedatangan (ETA) riil di halte. |
| **Komunitas Gowes & Pejalan Kaki** | Rute ramah pejalan/sepeda, kualitas udara, keselamatan rute. | Filter layer khusus rute non-motor, SOS keselamatan, achievement eksplorasi zona baru. |
| **Pengemudi Logistik & Armada Truk** | Hambatan jalan sempit, jembatan timbang, jalan rusak, titik istirahat. | Peringatan clearance jalan, hazard reporting spesifik truk, status rest-area. |
| **Pemerintah & Dinas Terkait (Dishub/Polri/BPBD)** | Monitoring kepadatan real-time, sebaran kecelakaan/bencana, kanal siaran langsung ke warga. | B2G Smart Mobility Portal: analisis titik rawan laka/banjir, siaran geofencing darurat. |

---

## 3. SYSTEM ARCHITECTURE & TECH STACK

NEXMAP dibangun dengan arsitektur **Event-Driven Microservices** dengan pemisahan tegas antara ingestion layer berkecepatan tinggi (telemetri) dan business transactional layer.

```
[Mobile Apps (Flutter/React Native)]  <--->  [Cloudflare CDN & WAF]
[Web Portal & Admin (Next.js/React)]           |
                                               v
                                      [API Gateway (Kong / Envoy)]
                                               |
         +-------------------------------------+-------------------------------------+
         | (HTTP / REST / gRPC)                                                      | (MQTT / WebSockets)
         v                                                                           v
  [Microservices Core]                                                     [High-Throughput Ingestion]
  - Auth & Profile Service                                                 - Telemetry Broker (EMQX / VerneMQ)
  - Live Report Service                                                    - Realtime Location Streamer (Go/Rust)
  - Gamification Engine (XP, Anti-Cheat)                                   - Spatial Dead-Reckoning Workers
  - NEX Store & Payment Gateway (Midtrans/Xendit)                          - Geofence & Proximity Detection
  - Safety & SOS Emergency Dispatcher                                                |
         |                                                                           v
         +-------------------------------------+-------------------------------------+
                                               v
                                    [Data & Storage Layer]
     +---------------------------------------------------------------------------------------+
     | - PostgreSQL + PostGIS : Data geospasial persisten, routing, laporan, user profile   |
     | - Redis Enterprise Cluster: Geohash spatial index, active vehicle cache, rate limiter|
     | - Apache Kafka / RabbitMQ : Event bus antrean scoring, analitik, notifikasi push      |
     | - TimescaleDB / ClickHouse : Historical time-series telemetry trips & heatmaps        |
     | - MinIO / AWS S3 : Media penyimpanan bukti laporan (foto/video), asset kosmetik      |
     +---------------------------------------------------------------------------------------+
```

### 3.1 Pilihan Teknologi Inti
- **Client Framework:** Flutter (Dart) untuk Mobile Android/iOS demi performa visual rendering 60-120 FPS pada map layer dan animasi gamifikasi.
- **Web Frontend (Admin & Civic Portal):** Next.js (TypeScript) + TailwindCSS + MapLibre GL.
- **Geospatial & Vector Tiles:** MapLibre GL Native / Mapbox GL SDK, Vector Tile Server (Tippecanoe / Martin / PostGIS ST_MVT).
- **Routing Engine:** Open-Source Routing Machine (OSRM) atau Valhalla yang di-host sendiri dengan modifikasi bobot jalanan dinamis berbasis Live Reports.
- **Spatial Indexing:** Uber H3 (Hexagonal hierarchical spatial index) level 7-9 untuk agregasi kepadatan dan pengelompokan laporan (clustering).
- **High Concurrency Services:** Golang untuk GPS Telemetry Ingestion Service dan Trust Engine.
- **Core Business API:** Node.js (NestJS) / Go dengan arsitektur Clean/Hexagonal Architecture.

---

## 4. CORE MODULE 1: GPS ENGINE & REAL-TIME TRACKING

### 4.1 Kebijakan Data Tracking & Anti-Phantom Vehicle
Aplikasi **tidak pernah** merekayasa atau memalsukan posisi kendaraan buatan (*ghost car*). Terdapat 3 level sumber data:
1. **User Active Fleet (Opt-In):** Pengguna yang secara sadar mengaktifkan "Share Live Position with Friends/Community".
2. **Enterprise / Public Transit Telematics:** Bus kota, taksi, dan armada logistik yang terintegrasi melalui API GTFS-RT (General Transit Feed Specification Realtime) atau webhook GPS tracker mitra (Teltonika, Meitrack, dll).
3. **Aggregated Density (Anonymous Probe Data):** Pengguna yang sedang bernavigasi tanpa berbagi identitas; posisi mereka hanya berkontribusi sebagai titik kecepatan rata-rata pada segmen jalan untuk menghitung kemacetan warna (Green/Yellow/Orange/Red/Dark Red).

### 4.2 Map-Matching & Dead Reckoning Algorithm
Untuk menjaga pergerakan ikon kendaraan di peta terlihat mulus tanpa lompatan sinyal (jittering):
- **Kalman Filter:** Membersihkan noise GPS dari multipath sinyal perkotaan.
- **Map-Matching (HMM - Hidden Markov Model):** Memetakan koordinat latitude/longitude acak ke segmen jalan (edge) terdekat yang valid di jaringan OpenStreetMap.
- **Dead Reckoning & Client Interpolation:** Saat aplikasi kehilangan sinyal selama 1–3 detik (misal terowongan/flyover), posisi diinterpolasi ke depan mengikuti kurvatur jalan dan kecepatan terakhir.

### 4.3 Multi-Layer Map Controller
Pengguna dapat mengaktifkan filter layer sesuai preferensi:
- `Layer_Live_Vehicles` (Motor, Mobil, Bus, Kereta, Pesawat/Kapal di area pelabuhan/bandara).
- `Layer_Live_Reports` (Kecelakaan, Banjir, Lubang, Razia/Checkpoint terverifikasi).
- `Layer_Traffic_Density` (Polylines berwarna berdasarkan kecepatan rata-rata vs kecepatan batas jalan).
- `Layer_Public_Services` (Halte, Stasiun, SPBU, SPKLU Listrik, Tambal Ban, Pos Polisi, Rumah Sakit).
- `Layer_Weather_Radar` (Overlaid curah hujan live dari radar BMKG).

---

## 5. CORE MODULE 2: COMMUNITY LIVE REPORT & TRUST ENGINE

### 5.1 Kategori Laporan & Atribut Data
Setiap laporan yang dibuat pengguna memuat:
- **Identifier:** `report_id`, `user_id`, `category` (10 kategori utama).
- **Spatial Data:** `geom (Point)`, `road_name`, `subdistrict`, `city`.
- **Temporal Data:** `created_at`, `expires_at`, `last_confirmed_at`.
- **Evidence:** `photo_url`, `video_snippet_url`, `user_comment`.
- **State Machine:** `Pending_Verification` -> `Verified` -> `Active` -> `Resolved` -> `Expired` / `Rejected`.

### 5.2 Algoritma Trust Score & Validasi Konsensus (Bayesian Weighting)
Setiap pengguna memiliki nilai **User Reputation Index ($R_{user}$)** dengan rentang 0.0 hingga 1.0 (nilai awal akun baru = 0.5).

Rumus Skor Bobot Laporan ($S_{report}$):
$$S_{report} = (R_{reporter} \times W_{category}) + \sum_{i=1}^{n} (C_i \times R_i) - \sum_{j=1}^{m} (D_j \times R_j)$$

Dimana:
- $R_{reporter}$: Reputasi pembuat laporan.
- $W_{category}$: Bobot kepentingan kategori (misal: Banjir/Kecelakaan = 1.5, Lubang Jalan = 1.0).
- $C_i$: Konfirmasi positif ("Masih Terjadi") dari pengguna ke-$i$ yang berjarak $\le 500\text{ m}$ dari titik kejadian.
- $D_j$: Sanggahan ("Tidak Ada / Hoaks") dari pengguna ke-$j$.
- $R_i, R_j$: Reputasi masing-masing pemberi suara.

**Kriteria Transisi Status:**
1. **Auto-Publish to General Map:** Saat $S_{report} \ge 2.0$.
2. **Mark as Resolved / Cleared:** Saat jumlah sanggahan $D > C$ atau menerima minimal 3 konfirmasi berturut-turut "Sudah Selesai/Lancar".
3. **Decay Time:** Setiap laporan memiliki masa kadaluarsa alami (misal: Kemacetan = 30 menit; Pohon Tumbang = 3 jam; Jalan Lubang = 7 hari kecuali ada laporan perbaikan).

### 5.3 Anti-Spam & Geofence Protection
- Pengguna hanya dapat membuat laporan jika GPS mereka secara fisik berada dalam radius toleransi $< 200\text{ meter}$ dari titik marker.
- Limit pembuatan laporan: maksimal 1 laporan per 3 menit per pengguna untuk mencegah flooding.

---

## 6. CORE MODULE 3: GAMIFICATION, ANTI-CHEAT & REPUTATION SYSTEM

### 6.1 Filosofi Gamifikasi: Keselamatan di Atas Kecepatan
Gamifikasi NEXMAP dirancang dengan prinsip **Safe Mobility**:
- ❌ **Dilarang Keras:** Reward berbasis kecepatan tertinggi (*Top Speed*), memacu berkendara larut malam tanpa henti, atau interaksi layar saat kecepatan kendaraan $> 10\text{ km/jam}$.
- ✔️ **Didorong:** Konsistensi perjalanan tertib, akurasi laporan bahaya jalan yang menyelamatkan komuter lain, dan eksplorasi distrik baru secara aman.

### 6.2 Kurva Level & XP Progression Formula
Level Progression dihitung dengan formula polinomial halus:
$$\text{Required XP for Level } L = 100 \times L^{1.65}$$

| Level Tier | Nama Rank | Rentang Level | Keuntungan Kosmetik & Fitur |
|---|---|---|---|
| **Tier 1** | Rookie Navigator | Level 1 – 5 | Standard Map Marker, Basic Bronze Profile Frame |
| **Tier 2** | Urban Scout | Level 6 – 15 | Unlocks Custom Vehicle Colors, "Scout" Title |
| **Tier 3** | Road Pathfinder | Level 16 – 30 | Neon Trail Effect (Peta), Perak Frame, Priority Report Voting (Bobot x1.2) |
| **Tier 4** | Horizon Voyager | Level 31 – 50 | Exclusive Animated Avatars, Gold Frame, Custom Voice Alert Packs |
| **Tier 5** | Master Cartographer | Level 51 – 75 | Platinum Holographic Frame, Special Vehicle Skins, Community Moderator Eligibility |
| **Tier 6** | Nex Legendary | Level 76 – 100+ | Mythic Rainbow Aura, Custom Road Titles, Hall of Fame Plaque |

### 6.3 Mesin Anti-Cheat Multi-Layer
Untuk mencegah exploit perolehan XP ilegal (GPS Spoofing / Bot emulator):
1. **Mock Location Detection:** Membaca OS-level flag `isMockProvider()` pada Android Location API dan sensor mock di iOS.
2. **Speed & Physics Plausibility Check:** 
   - Kecepatan $> 180\text{ km/jam}$ otomatis membatalkan penghitungan XP trip.
   - Akselerasi instan tak wajar ($> 20\text{ m/s}^2$) mengindikasikan teleportasi koordinat GPS.
3. **Deadzone Cooldown:** Perpindahan jarak ratusan kilometer dalam hitungan menit otomatis mengunci status perjalanan sebagai *Flagged Review*.
4. **Hardware Sensor Cross-Check:** Sensor Accelerometer dan Gyroscope perangkat dicocokkan dengan vektor pergerakan GPS. Jika koordinat GPS bergerak $60\text{ km/jam}$ di jalan raya namun akselerometer perangkat diam mutlak di atas meja, trip dianulir.

---

## 7. CORE MODULE 4: TRAFFIC INTELLIGENCE & CIVIC PORTAL

### 7.1 Automated Congestion Index (ACI)
Sistem menghitung rasio kelancaran jalan menggunakan metrik:
$$ACI = \frac{V_{actual}}{V_{freeflow}}$$
- $ACI \ge 0.85$ : **Hijau (Lancar)**
- $0.60 \le ACI < 0.85$ : **Kuning (Mulai Padat)**
- $0.40 \le ACI < 0.60$ : **Oranye (Padat)**
- $0.20 \le ACI < 0.40$ : **Merah (Macet)**
- $ACI < 0.20$ : **Merah Gelap (Macet Total / Gridlock)**

### 7.2 Hub Integrasi Instansi Resmi (Government & Civic Portal)
Modul ini menghubungkan instansi resmi ke dalam platform dengan tanda verifikasi berlisensi:
- **Korlantas Polri / Satlantas:** Siaran rekayasa lalu lintas (*one way*, ganjil genap, operasi tertib, penutupan jalur VVIP).
- **Dinas Perhubungan (Dishub):** Perubahan rute angkutan massal, perawatan fasilitas lampu merah, jadwal uji emisi dan penertiban parkir.
- **BMKG:** Peringatan dini cuaca hidrometeorologi (hujan badai, potensi longsor jalur pegunungan, kabut tebal).
- **BPBD / SAR:** Jalur evakuasi bencana banjir, lahar, gempa bumi, serta titik posko logistik.

Setiap pengumuman resmi instansi memiliki tag **Verified Official Broadcast** dengan prioritas tampilan teratas pada feed dan notifikasi geofencing (hanya dikirim ke warga yang berada di area terdampak).

---

## 8. CORE MODULE 5: DIGITAL ECONOMY & NEX STORE (MONETIZATION)

### 8.1 Model Ekonomi Dual-Currency
| Parameter | NEX Coins (Soft Currency) | NEX Gems (Hard Currency) |
|---|---|---|
| **Cara Perolehan** | Didapat gratis dari aktivitas valid: perjalanan, verifikasi laporan, daily mission. | Dibeli melalui top-up uang fiat (IDR) via Payment Gateway. |
| **Kegunaan** | Membeli skin kendaraan standar, title komunitas, frame avatar basic, sound pack biasa. | Membeli item eksklusif edisi terbatas, skin map futuristik (Cyberpunk/Dark Mode), seasonal pass. |
| **Nilai Tukar** | Tidak dapat ditukar menjadi uang fiat / cashout (mencegah judi dan regulasi money-laundering). | Nilai konversi patokan: misal 1.000 Gems $\approx$ Rp10.000. |

### 8.2 Katalog NEX Store
1. **Map Thematic Skins:** Tema visual peta alternatif seperti *Neon Cyberpunk*, *Minimalist Dark Gold*, *Retro 80s Synthwave*, *Satellite High-Contrast*.
2. **Custom Vehicle Marker 3D:** Model 3D mobil sport futuristik, motor chopper retro, helikopter drone, angkot modern unik.
3. **Road Trail Effects:** Jejak partikel cahaya yang ditinggalkan kendaraan di layar pengguna (hanya kosmetik lokal).
4. **Voice Navigation Packs:** Pilihan suara navigasi unik (suara karakter animasi, dialek lokal ramah, pemandu santai).
5. **Titles & Prestiges:** Gelar profil seperti *"Penguasa Pantura"*, *"Penakluk Puncak"*, *"Penjaga Keselamatan Jakarta"*.

### 8.3 Arsitektur Transaksi Finansial Idempoten
- Integrasi Midtrans / Xendit / DOKU: QRIS, GoPay, OVO, ShopeePay, Virtual Account BCA/Mandiri/BRI, Kartu Debit.
- **Webhook Verifier:** Setiap notifikasi pembayaran diverifikasi menggunakan hashing HMAC SHA-512 dengan secret key resmi.
- **Idempotency Key:** Mencegah terjadinya top-up ganda jika payment gateway mengirimkan callback berulang pada jaringan lambat.
- **Audit Ledger:** Setiap mutasi Gems dan Coins dicatat dalam tabel `ledger_entries` (pembukuan berpasangan / double-entry bookkeeping).

---

## 9. CORE MODULE 6: SAFETY CENTER, EMERGENCY SOS & PRIVACY (UU PDP)

### 9.1 Mekanisme Emergency SOS
Tombol SOS didesain untuk situasi darurat riil (kecelakaan berat, pembegalan, ancaman bahaya):
1. **Aktivasi Cepat (Fast Trigger):** Tekan dan tahan tombol SOS selama 3 detik untuk mencegah salah pencet, atau fitur *quick-tap* 5 kali.
2. **Broadcasting Darurat:**
   - Mengirim notifikasi push darurat beserta titik koordinat live tracking kepada 3 **Kontak Darurat Terdaftar**.
   - Menyediakan tautan web terenkripsi sekali pakai (*Ephemeral Emergency URL*) berbatas waktu (aktif 2 jam) yang dapat dipantau keluarga tanpa perlu menginstal aplikasi.
3. **Direktori Darurat Lokal:** Tombol panggilan satu sentuhan ke layanan tanggap darurat resmi terdekat: **110 (Kepolisian)**, **112 (Panggilan Darurat Kota)**, **119 (Ambulans)**, **113 (Damkar)**.
4. **Offline Fallback (SMS Protocol):** Jika koneksi data internet terputus, aplikasi secara otomatis menyusun template pesan SMS berformat:
   `[NEXMAP SOS] [Nama User] butuh bantuan! Lokasi: https://maps.google.com/?q=-6.2000,106.8166` dan membuka dialer SMS perangkat.

### 9.2 Kepatuhan UU No. 27 Tahun 2022 (UU Pelindungan Data Pribadi)
Data lokasi adalah **Data Pribadi yang Bersifat Spesifik**:
- **Privacy Zones (Fuzzy Masking):** Pengguna dapat mengatur "Zona Pribadi" (misal: radius 300 meter di sekitar Rumah dan Kantor). Di dalam zona ini, marker live tracking otomatis disamarkan atau disembunyikan dari pantauan teman/publik.
- **Explicit Consent:** Izin akses lokasi latar belakang (*Background Location*) dijelaskan secara transparan kepada pengguna dengan opsi "Hanya saat aplikasi dibuka" atau "Izinkan sepanjang perjalanan".
- **Right to Erasure (Hak Penghapusan):** Fitur self-service untuk menghapus riwayat jejak perjalanan (*trip logs*) secara permanen kapan saja.
- **Anonymization of Probe Data:** Data yang digunakan untuk kalkulasi kemacetan jalan dibersihkan dari ID pengguna dan di-hash secara acak setiap sesi.

---

## 10. CORE MODULE 7: ADMIN, MODERATION & B2G/B2B DASHBOARD

### 10.1 Super Admin Control Hub
- Manajemen pengguna, pembekuan akun pelanggar TOS atau pelaku GPS spoofing berulang.
- Konfigurasi parameter game: XP multiplier akhir pekan, event festival jalan, rotasi katalog store.
- Rekonsiliasi finansial harian dan log transaksi pembayaran.

### 10.2 Moderator Live Operations Console
- **Feed Laporan Berisiko Tinggi:** Laporan kategori kecelakaan fatal atau bahaya lalu lintas diprioritaskan untuk diverifikasi admin jika menerima sanggahan.
- **Pembersihan Konten (Content Cleansing):** Filter otomatis gambar berbasis OCR/AI untuk mencegah unggahan foto tidak senonoh atau materi sensitif pada bukti laporan jalan.
- **Merge Tool:** Menggabungkan 5 laporan berbeda yang melaporkan 1 titik kecelakaan yang sama menjadi 1 *Incident Master Record*.

### 10.3 Dashboard Smart City / B2G & Operator
Akses aman berbasis Role-Based Access Control (RBAC) untuk dinas kota:
- Peta sebaran titik jalan rusak kronis di seluruh kota sebagai acuan prioritas perbaikan aspal Dinas Bina Marga.
- Matriks waktu tunda perjalanan pada ruas-ruas arteri utama untuk rekayasa fase lampu lalu lintas (*Area Traffic Control System / ATCS*).
- Pemantauan keteraturan armada bus kota dan jarak antar armada (*headway*).

---

## 11. DATABASE ARCHITECTURE & CORE DATA SCHEMA

Sistem mengadopsi skema relasional geospasial pada PostgreSQL didukung ekstensi **PostGIS**.

```sql
-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. USERS & PROFILES
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    reputation_score NUMERIC(4, 3) DEFAULT 0.500, -- Range 0.000 to 1.000
    level INTEGER DEFAULT 1,
    current_xp BIGINT DEFAULT 0,
    nex_coins BIGINT DEFAULT 0,
    nex_gems BIGINT DEFAULT 0,
    active_vehicle_type VARCHAR(20) DEFAULT 'motorcycle',
    privacy_mode VARCHAR(20) DEFAULT 'friends_only', -- 'ghost', 'friends_only', 'public'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. LIVE REPORTS TABLE
CREATE TABLE live_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL, -- 'accident', 'traffic_jam', 'road_damage', etc.
    title VARCHAR(120),
    description TEXT,
    evidence_media_url VARCHAR(500),
    location GEOMETRY(Point, 4326) NOT NULL,
    road_name VARCHAR(150),
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'verified', 'resolved', 'rejected'
    confidence_score NUMERIC(5, 2) DEFAULT 1.00,
    confirmations_count INTEGER DEFAULT 0,
    denials_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_live_reports_geom ON live_reports USING GIST(location);
CREATE INDEX idx_live_reports_status ON live_reports(status);

-- 4. REPORT CONFIRMATION VOTES (CONSENSUS)
CREATE TABLE report_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES live_reports(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(20) NOT NULL, -- 'still_happening', 'not_happening', 'resolved'
    voter_location GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_vote_per_report UNIQUE (report_id, user_id)
);

-- 5. USER COMPLETED TRIPS (FOR GAMIFICATION & AUDIT)
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    transport_mode VARCHAR(20) NOT NULL,
    distance_meters NUMERIC(10, 2) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    avg_speed_kmh NUMERIC(5, 2),
    max_speed_kmh NUMERIC(5, 2),
    route_geom GEOMETRY(LineString, 4326),
    earned_xp INTEGER DEFAULT 0,
    is_valid_trip BOOLEAN DEFAULT TRUE,
    anti_cheat_flags TEXT[],
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_trips_geom ON trips USING GIST(route_geom);

-- 6. STORE PRODUCTS & USER INVENTORY
CREATE TABLE store_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    item_type VARCHAR(30) NOT NULL, -- 'map_skin', 'vehicle_icon', 'profile_frame', 'title'
    price_currency VARCHAR(10) NOT NULL, -- 'coins' or 'gems'
    price_amount INTEGER NOT NULL,
    asset_url VARCHAR(500) NOT NULL,
    is_exclusive BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES store_items(id) ON DELETE RESTRICT,
    is_equipped BOOLEAN DEFAULT FALSE,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_item UNIQUE (user_id, item_id)
);

-- 7. TOP-UP TRANSACTIONS (FINANCIAL AUDIT)
CREATE TABLE topup_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    payment_provider VARCHAR(50) NOT NULL, -- 'midtrans', 'xendit'
    amount_idr NUMERIC(12, 2) NOT NULL,
    gems_awarded INTEGER NOT NULL,
    payment_status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'paid', 'expired', 'failed'
    payment_method VARCHAR(50), -- 'qris', 'bca_va', 'gopay'
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 12. API CONTRACTS & REAL-TIME PROTOCOLS

### 12.1 Real-Time Telemetry Socket Protocol
- **Transport:** WebSocket / WSS (`wss://telemetry.nexmap.id/v1/stream`)
- **Protocol Payload (Binary Protobuf / Lightweight JSON):**
```json
// Client -> Server (Lokasi Aktif)
{
  "trip_id": "8e3c63be-3b36-4c2f-b442-990a4dfb7c25",
  "lat": -6.2087634,
  "lon": 106.845599,
  "heading": 85.5,
  "speed_kmh": 42.1,
  "altitude": 18.2,
  "accuracy": 4.5,
  "mock_flag": false,
  "timestamp": 1793869200000
}
```

### 12.2 Restful Endpoints Utama
| Method | Endpoint | Fungsi | Auth Level |
|---|---|---|---|
| `POST` | `/api/v1/reports` | Mengunggah laporan insiden baru beserta geolokasi dan bukti foto. | User Token (JWT) |
| `GET` | `/api/v1/reports/active?bbox={minX,minY,maxX,maxY}` | Mengambil semua marker insiden aktif dalam bidang pandang peta. | Public / User |
| `POST` | `/api/v1/reports/{id}/vote` | Mengonfirmasi keberadaan kejadian ("Still Happening" / "Resolved"). | User Token (JWT) |
| `GET` | `/api/v1/navigation/route` | Kalkulasi rute multi-alternatif dengan penyesuaian bobot insiden live. | Public / User |
| `GET` | `/api/v1/gamification/leaderboard?type=weekly&scope=city` | Mendapatkan papan peringkat pengguna berdasarkan kategori & wilayah. | Public / User |
| `POST` | `/api/v1/store/topup/initiate` | Membuka invoice pembayaran QRIS/VA untuk top-up NEX Gems. | User Token (JWT) |
| `POST` | `/api/v1/store/topup/webhook` | Webhook aman penerima notifikasi sukses dari Payment Gateway. | Signature HMAC Check |
| `POST` | `/api/v1/safety/sos/trigger` | Mengaktifkan sesi darurat dan membroadcast lokasi ke kontak darurat. | User Token (JWT) |
| `POST` | `/api/v1/gov/broadcast` | Siaran darurat resmi / rekayasa lalin oleh Korlantas/Dishub berizin. | Government Admin Role |

---

## 13. ROADMAP, IMPLEMENTATION PHASES & RISK MITIGATION

### 13.1 Tahapan Eksekusi (Phase Roadmap)

```
[Phase 1: Foundation (Bulan 1-3)]
├── Setup Core Geo-Infrastructure (PostGIS, OSRM/Valhalla, MapLibre SDK)
├── Aplikasi Mobile MVP: Peta dasar, Navigasi Turn-by-Turn, Tracking GPS Pribadi
└── Modul Live Report V1: Pelaporan insiden, upload foto, verifikasi komunitas lokal

[Phase 2: Engagement & Gamification (Bulan 4-6)]
├── Gamification Core: Sistem XP, Kalkulasi Level, Daily/Weekly Quests
├── Anti-Cheat V1: Deteksi mock-location, speed threshold, physics filter
├── Leaderboard Regional (Provinsi & Kota)
└── Safety SOS V1: Emergency Contact & Quick Dial 110/112

[Phase 3: Digital Economy & Civic Hub (Bulan 7-9)]
├── NEX Store & Dual-Currency System (Coins & Gems)
├── Integrasi Payment Gateway (QRIS, E-Wallet, Virtual Account)
├── Katalog Kosmetik: Thematic Map Skins, Vehicle Markers, Titles
└── Portal Mitra Pemerintah (Dishub/Korlantas): Kanal siaran resmi lalu lintas

[Phase 4: Ecosystem Scale & Smart City Expansion (Bulan 10-12)]
├── Integrasi Telematika Transportasi Publik (GTFS-RT Bus Kota & KRL)
├── AI Visual Cleansing & Auto-Deduplication Laporan
├── Predictive Congestion Engine berbasis historical Big Data
└── Pemenuhan Standar Audit Keamanan Informasi ISO 27001 & Kepatuhan Penuh UU PDP
```

### 13.2 Analisis Risiko & Mitigasi
1. **Risiko Laporan Palsu (Fake / Spam Reports):**
   - *Mitigasi:* Algoritma skor reputasi dinamis. Akun yang membuat laporan palsu akan diturunkan bobot suaranya menjadi 0 dan terancam penangguhan akun. Laporan membutuhkan validasi konsensus pengguna terdekat.
2. **Risiko Keselamatan Berkendara (Distracted Driving):**
   - *Mitigasi:* Pembatasan input saat berkendara. Antarmuka pelaporan memiliki mode "Quick Tap 1 Sentuhan" berukuran besar dan dukungan navigasi suara bebas genggam (*Voice Command*).
3. **Risiko Kebocoran Data Privasi Lokasi (UU PDP):**
   - *Mitigasi:* Fitur Privacy Fuzzy Zones secara otomatis memotong jejak GPS dalam radius 300 meter dari kediaman/kantor pengguna. Data pergerakan yang disimpan untuk analitik lalu lintas dienkripsi dan dianonimkan tanpa tautan identitas pengguna.
4. **Beban Server & Skalabilitas Telemetri:**
   - *Mitigasi:* Penggunaan arsitektur Message Broker MQTT (EMQX) dan arsitektur pengelompokan spasial H3. Data telemetri hanya disiarkan pada pengguna di dalam radius pandang (viewport) yang sama dengan strategi *Spatial Throttling*.

---
*Dokumen ini merupakan cetak biru resmi perencanaan arsitektur, fungsionalitas, dan tata kelola platform NEXMAP.*

---

## 13. Status Implementasi v1.2 (Living Document)

Bagian ini mencatat realisasi teknis dari cetak biru di atas pada prototipe berjalan.

| Area Master Plan | Status | Implementasi |
|------------------|--------|--------------|
| GPS & Navigasi | ✅ Prototipe | Leaflet + routing simulasi, segmen berwarna sesuai ACI, ETA sadar-insiden |
| Live Tracking | ✅ Prototipe | Telemetri WebSocket 2 detik untuk 7 armada simulasi (bukan klaim kendaraan nyata) |
| Live Report & Trust Engine | ✅ | Laporan 11 kategori, TTL per kategori, voting ber-geofence 2 km, skor Bayesian |
| Gamifikasi & Anti-Cheat | ✅ | XP ledger, kurva level, 6 leaderboard, misi, 10 achievement, penolakan mock GPS/kecepatan ekstrem |
| Civic & Traffic News | ✅ | Pengumuman B2G, newsroom, feed terpersonalisasi berbasis jarak, ACI |
| NEX Store & Pembayaran | ✅ Prototipe | Dual currency kosmetik, QRIS/VA simulasi, webhook HMAC + idempotensi |
| Safety Center & UU PDP | ✅ | SOS persisten + fallback SMS, Ghost Mode, Fuzzy Zone, ekspor & hapus data |
| Admin & Moderasi | ✅ | Antrean moderasi, balasan tiket, audit log, siaran resmi |
| Sosial | ✅ | Profil publik, follow/unfollow, leaderboard teman |
| Help Center | ✅ | FAQ berkategori + pencarian, tiket dukungan |
| Upload Bukti | ✅ Prototipe | Validasi MIME & ukuran, penyimpanan lokal |
| Notifikasi & Diskusi | ✅ | Pusat notifikasi persisten + realtime, komentar laporan dengan anti-spam |
| Riwayat & Tempat Favorit | ✅ | Statistik perjalanan 7 hari, hingga 20 tempat tersimpan |
| Kontak Darurat | ✅ | CRUD hingga 10 kontak, dipakai alur SOS |
| Analitik Admin | ✅ | Kategori/status laporan, tren 7 hari, pendapatan, ekspor CSV aman |
| PWA & Offline | ✅ | Manifest, service worker cache, halaman offline, ikon |
| Autentikasi & Otorisasi | ⏳ Belum | Demo user tunggal `usr-demo-001` |
| PostGIS / Skala Produksi | ⏳ Belum | SQLite kompatibel; perlu PostgreSQL/PostGIS, MQTT, object storage |

**Verifikasi:** `npm test` (10 unit test) + `npm run smoke` (111 pemeriksaan API) — seluruhnya lulus.
