const db = require('./db');

function seedDatabase() {
  console.log('Seeding NEXMAP database with realistic Indonesian mobility data...');

  const now = Date.now();
  const oneHour = 3600 * 1000;
  const oneDay = 24 * oneHour;

  // 1. Seed Users
  const users = [
    {
      id: 'usr-demo-001',
      phone: '+6281234567890',
      username: 'NEX_Rider',
      level: 12,
      current_xp: 2850,
      reputation_score: 0.88,
      nex_coins: 1450,
      nex_gems: 180,
      active_vehicle: 'motorcycle',
      active_skin: 'cyberpunk',
      active_title: 'Urban Explorer',
      privacy_mode: 'public',
      fuzzy_radius_meters: 300,
      total_km: 420.5,
      total_reports: 14,
      created_at: now - 30 * oneDay
    },
    {
      id: 'usr-top-001',
      phone: '+6281198765432',
      username: 'RoadMaster_ID',
      level: 45,
      current_xp: 34200,
      reputation_score: 0.96,
      nex_coins: 8900,
      nex_gems: 650,
      active_vehicle: 'car',
      active_skin: 'dark_gold',
      active_title: 'Penguasa Pantura',
      privacy_mode: 'public',
      fuzzy_radius_meters: 500,
      total_km: 1850.0,
      total_reports: 62,
      created_at: now - 90 * oneDay
    },
    {
      id: 'usr-top-002',
      phone: '+6281355551234',
      username: 'UrbanRider_JKT',
      level: 28,
      current_xp: 8900,
      reputation_score: 0.91,
      nex_coins: 3400,
      nex_gems: 210,
      active_vehicle: 'motorcycle',
      active_skin: 'synthwave',
      active_title: 'Penjaga Jalur Puncak',
      privacy_mode: 'public',
      fuzzy_radius_meters: 250,
      total_km: 1120.4,
      total_reports: 39,
      created_at: now - 60 * oneDay
    },
    {
      id: 'usr-top-003',
      phone: '+6281788889999',
      username: 'MapHunter_BDG',
      level: 19,
      current_xp: 4350,
      reputation_score: 0.82,
      nex_coins: 1900,
      nex_gems: 90,
      active_vehicle: 'bicycle',
      active_skin: 'cyberpunk',
      active_title: 'City Traveler',
      privacy_mode: 'public',
      fuzzy_radius_meters: 300,
      total_km: 840.2,
      total_reports: 28,
      created_at: now - 45 * oneDay
    }
  ];

  for (const u of users) {
    db.run(
      `INSERT OR REPLACE INTO users (
        id, phone, username, level, current_xp, reputation_score,
        nex_coins, nex_gems, active_vehicle, active_skin, active_title,
        privacy_mode, fuzzy_radius_meters, total_km, total_reports, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        u.id, u.phone, u.username, u.level, u.current_xp, u.reputation_score,
        u.nex_coins, u.nex_gems, u.active_vehicle, u.active_skin, u.active_title,
        u.privacy_mode, u.fuzzy_radius_meters, u.total_km, u.total_reports, u.created_at
      ]
    );
  }

  // 2. Seed Store Items
  const items = [
    // Map Skins
    {
      id: 'skin-cyberpunk',
      name: 'Cyberpunk Neon',
      category: 'map_skin',
      currency_type: 'coins',
      price: 500,
      description: 'Gaya visual malam neon futuristik dengan pencahayaan polylines berkilau.',
      icon: '🌃',
      preview_data: JSON.stringify({ tileFilter: 'hue-rotate(180deg) invert(100%)', color: '#00f7ff' }),
      is_exclusive: 0
    },
    {
      id: 'skin-dark-gold',
      name: 'Stealth Dark Gold',
      category: 'map_skin',
      currency_type: 'gems',
      price: 150,
      description: 'Desain minimalis hitam elegan dengan aksen garis jalan emas mewah.',
      icon: '✨',
      preview_data: JSON.stringify({ tileFilter: 'invert(90%) hue-rotate(20deg) contrast(150%)', color: '#ffd700' }),
      is_exclusive: 1
    },
    {
      id: 'skin-synthwave',
      name: '80s Synthwave Sunset',
      category: 'map_skin',
      currency_type: 'coins',
      price: 850,
      description: 'Nuansa retro sunset ungu dan pink bergaya arcade klasik.',
      icon: '🌆',
      preview_data: JSON.stringify({ tileFilter: 'hue-rotate(280deg) contrast(120%)', color: '#ff007f' }),
      is_exclusive: 0
    },
    // Vehicle Icons
    {
      id: 'veh-hoverbike',
      name: 'Cyber Hover-Bike 3D',
      category: 'vehicle_icon',
      currency_type: 'gems',
      price: 200,
      description: 'Ikon motor melayang futuristik dengan jet trail berwarna cyan.',
      icon: '🏍️⚡',
      preview_data: JSON.stringify({ iconSymbol: '🏍️', glowColor: '#00ffff' }),
      is_exclusive: 1
    },
    {
      id: 'veh-sportscar',
      name: 'Hyper GT Cruiser',
      category: 'vehicle_icon',
      currency_type: 'coins',
      price: 600,
      description: 'Ikon supercar aerodinamis modern di layar navigasi.',
      icon: '🏎️',
      preview_data: JSON.stringify({ iconSymbol: '🏎️', glowColor: '#ff3366' }),
      is_exclusive: 0
    },
    // Titles
    {
      id: 'title-pantura',
      name: 'Penguasa Pantura',
      category: 'title',
      currency_type: 'coins',
      price: 300,
      description: 'Gelar kehormatan untuk penjelajah jalur utara Jawa.',
      icon: '🛡️',
      preview_data: JSON.stringify({ badge: 'PANTURA' }),
      is_exclusive: 0
    },
    {
      id: 'title-wali-jkt',
      name: 'Wali Keselamatan Jakarta',
      category: 'title',
      currency_type: 'gems',
      price: 100,
      description: 'Gelar prestisius kontributor pelindung lalu lintas ibu kota.',
      icon: '👑',
      preview_data: JSON.stringify({ badge: 'GUARDIAN' }),
      is_exclusive: 1
    }
  ];

  for (const it of items) {
    db.run(
      `INSERT OR REPLACE INTO store_items (
        id, name, category, currency_type, price, description, icon, preview_data, is_exclusive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [it.id, it.name, it.category, it.currency_type, it.price, it.description, it.icon, it.preview_data, it.is_exclusive]
    );
  }

  // 3. Seed Live Reports (around Central Jakarta, Sudirman, Thamrin, Kuningan)
  const reports = [
    {
      id: 'rep-001',
      user_id: 'usr-top-001',
      author_name: 'RoadMaster_ID',
      category: 'accident',
      title: 'Kecelakaan Beruntun Ringan 2 Mobil',
      description: 'Kecelakaan di lajur kanan arah Bundaran HI. Petugas sudah di lokasi, jalur padat merayap.',
      lat: -6.2088,
      lon: 106.8229,
      road_name: 'Jl. Jenderal Sudirman',
      status: 'verified',
      confidence_score: 3.4,
      confirmations: 8,
      denials: 0,
      image_url: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?w=500',
      expires_at: now + 2 * oneHour,
      created_at: now - 25 * 60 * 1000
    },
    {
      id: 'rep-002',
      user_id: 'usr-top-002',
      author_name: 'UrbanRider_JKT',
      category: 'flood',
      title: 'Genangan Air 25cm Pasca Hujan',
      description: 'Genangan setinggi ban motor di depan halte busway. Motor disarankan ambil lajur tengah.',
      lat: -6.2250,
      lon: 106.8090,
      road_name: 'Jl. Gatot Subroto',
      status: 'active',
      confidence_score: 2.8,
      confirmations: 5,
      denials: 1,
      image_url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=500',
      expires_at: now + 4 * oneHour,
      created_at: now - 45 * 60 * 1000
    },
    {
      id: 'rep-003',
      user_id: 'usr-top-003',
      author_name: 'MapHunter_BDG',
      category: 'road_damage',
      title: 'Lubang Jalan Dalam Menunggu Perbaikan',
      description: 'Lubang berdiameter 40cm rawan bagi pengendara roda dua di tikungan.',
      lat: -6.1950,
      lon: 106.8230,
      road_name: 'Jl. M.H. Thamrin',
      status: 'verified',
      confidence_score: 4.1,
      confirmations: 12,
      denials: 0,
      image_url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=500',
      expires_at: now + 72 * oneHour,
      created_at: now - 2 * oneHour
    },
    {
      id: 'rep-004',
      user_id: 'usr-demo-001',
      author_name: 'NEX_Rider',
      category: 'traffic_jam',
      title: 'Penyempitan Jalan Akibat Galian Kabel',
      description: 'Galian utilitas bawah tanah memakan 1 lajur kiri, kecepatan tersisa 10 km/jam.',
      lat: -6.2155,
      lon: 106.8315,
      road_name: 'Jl. H.R. Rasuna Said',
      status: 'active',
      confidence_score: 2.2,
      confirmations: 4,
      denials: 0,
      image_url: '',
      expires_at: now + 3 * oneHour,
      created_at: now - 15 * 60 * 1000
    }
  ];

  for (const r of reports) {
    db.run(
      `INSERT OR REPLACE INTO live_reports (
        id, user_id, author_name, category, title, description,
        lat, lon, road_name, status, confidence_score, confirmations,
        denials, image_url, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id, r.user_id, r.author_name, r.category, r.title, r.description,
        r.lat, r.lon, r.road_name, r.status, r.confidence_score, r.confirmations,
        r.denials, r.image_url, r.expires_at, r.created_at
      ]
    );
  }

  // 4. Seed Civic Announcements (Official government feeds)
  const announcements = [
    {
      id: 'civic-001',
      source_agency: 'Korlantas Polri',
      category: 'traffic_regulation',
      headline: 'Rekayasa Lalu Lintas Contraflow Akhir Pekan',
      details: 'Pemberlakuan Contraflow Tol Jagorawi KM 14 hingga KM 21 arah Puncak Bogor untuk mengurai kepadatan wisatawan.',
      affected_area: 'Tol Jagorawi & Jalur Puncak',
      lat: -6.2800,
      lon: 106.8700,
      radius_km: 15.0,
      severity: 'warning',
      expires_at: now + 24 * oneHour,
      created_at: now - 3 * oneHour
    },
    {
      id: 'civic-002',
      source_agency: 'Dishub DKI Jakarta',
      category: 'public_transport',
      headline: 'Operasional Armada Tambahan TransJakarta Rute Koridor 1',
      details: 'Peningkatan frekuensi headway bus menjadi 3 menit sekali pada jam sibuk sore hari (16:00 - 20:00 WIB).',
      affected_area: 'Koridor Blok M - Kota',
      lat: -6.2000,
      lon: 106.8200,
      radius_km: 8.0,
      severity: 'info',
      expires_at: now + 12 * oneHour,
      created_at: now - 5 * oneHour
    },
    {
      id: 'civic-003',
      source_agency: 'BMKG',
      category: 'weather_hazard',
      headline: 'Peringatan Dini Cuaca Ekstrem Hujan Lebat Disertai Angin Kencang',
      details: 'Waspada potensi genangan air di kawasan Jakarta Selatan dan Jakarta Timur antara pukul 14:00 - 18:00 WIB.',
      affected_area: 'Jabodetabek',
      lat: -6.2100,
      lon: 106.8400,
      radius_km: 25.0,
      severity: 'emergency',
      expires_at: now + 8 * oneHour,
      created_at: now - 1 * oneHour
    }
  ];

  for (const a of announcements) {
    db.run(
      `INSERT OR REPLACE INTO civic_announcements (
        id, source_agency, category, headline, details, affected_area,
        lat, lon, radius_km, severity, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.source_agency, a.category, a.headline, a.details, a.affected_area, a.lat, a.lon, a.radius_km, a.severity, a.expires_at, a.created_at]
    );
  }

  // 5. Seed Missions
  const missions = [
    {
      id: 'msn-daily-1',
      title: 'Komuter Tangguh',
      type: 'daily',
      goal_type: 'distance',
      target_count: 5, // 5 km
      reward_xp: 50,
      reward_coins: 30
    },
    {
      id: 'msn-daily-2',
      title: 'Mata Jalanan',
      type: 'daily',
      goal_type: 'report',
      target_count: 1, // 1 report
      reward_xp: 40,
      reward_coins: 25
    },
    {
      id: 'msn-daily-3',
      title: 'Verifikator Komunitas',
      type: 'daily',
      goal_type: 'verify',
      target_count: 3, // 3 votes
      reward_xp: 60,
      reward_coins: 40
    },
    {
      id: 'msn-weekly-1',
      title: 'Penjelajah Metropolis',
      type: 'weekly',
      goal_type: 'distance',
      target_count: 50, // 50 km
      reward_xp: 250,
      reward_coins: 150
    }
  ];

  for (const m of missions) {
    db.run(
      `INSERT OR REPLACE INTO missions (
        id, title, type, goal_type, target_count, reward_xp, reward_coins
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [m.id, m.title, m.type, m.goal_type, m.target_count, m.reward_xp, m.reward_coins]
    );
  }

  // 6. Seed Demo User Inventory
  db.run(
    `INSERT OR REPLACE INTO user_inventory (id, user_id, item_id, is_equipped, purchased_at)
     VALUES (?, ?, ?, ?, ?)`,
    ['inv-001', 'usr-demo-001', 'skin-cyberpunk', 1, now - 10 * oneDay]
  );

  // 7. Seed Emergency Contacts for Demo User
  db.run(
    `INSERT OR REPLACE INTO emergency_contacts (id, user_id, name, phone, relationship, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['emg-001', 'usr-demo-001', 'Keluarga Rumah', '+6281299990001', 'Keluarga Inti', now]
  );

  // 8. Achievements
  const achievements = [
    { id: 'ach-first-journey', name: 'First Journey', description: 'Menyelesaikan perjalanan valid pertama.', icon: '🚗', metric: 'trips_count', threshold: 1, reward_coins: 20 },
    { id: 'ach-road-explorer', name: 'Road Explorer', description: 'Melaporkan kondisi di 5 ruas jalan berbeda.', icon: '🧭', metric: 'distinct_roads', threshold: 5, reward_coins: 50 },
    { id: 'ach-community-hero', name: 'Community Hero', description: 'Mengirim 10 laporan komunitas.', icon: '🦸', metric: 'total_reports', threshold: 10, reward_coins: 100 },
    { id: 'ach-safety-guardian', name: 'Safety Guardian', description: 'Memverifikasi 10 laporan komunitas.', icon: '🛡️', metric: 'valid_confirmations', threshold: 10, reward_coins: 100 },
    { id: 'ach-long-distance', name: 'Long Distance', description: 'Menempuh total 1.000 km perjalanan valid.', icon: '🛣️', metric: 'total_km', threshold: 1000, reward_coins: 150 },
    { id: 'ach-city-traveler', name: 'City Traveler', description: 'Menjelajahi 10 ruas jalan berbeda.', icon: '🏙️', metric: 'distinct_roads', threshold: 10, reward_coins: 120 },
    { id: 'ach-early-explorer', name: 'Early Explorer', description: 'Melakukan 3 perjalanan pagi (05:00–07:00).', icon: '🌅', metric: 'early_trips', threshold: 3, reward_coins: 60 },
    { id: 'ach-level-10', name: 'Rising Navigator', description: 'Mencapai Level 10.', icon: '⭐', metric: 'level', threshold: 10, reward_coins: 80 },
    { id: 'ach-level-50', name: 'Elite Navigator', description: 'Mencapai Level 50.', icon: '🌟', metric: 'level', threshold: 50, reward_coins: 300 },
    { id: 'ach-legendary', name: 'Legendary Navigator', description: 'Mencapai Level 100.', icon: '👑', metric: 'level', threshold: 100, reward_coins: 1000 }
  ];
  for (const a of achievements) {
    db.run(
      `INSERT OR REPLACE INTO achievements (id, name, description, icon, metric, threshold, reward_coins)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.name, a.description, a.icon, a.metric, a.threshold, a.reward_coins]
    );
  }

  // 9. FAQ / Help Center
  const faqs = [
    { id: 'faq-1', category: 'general', q: 'Apa itu NEXMAP?', a: 'NEXMAP adalah platform peta GPS open-world yang menggabungkan navigasi real-time, laporan komunitas, gamifikasi perjalanan, dan pusat informasi lalu lintas resmi.', o: 1 },
    { id: 'faq-2', category: 'general', q: 'Bagaimana cara membuat akun?', a: 'Buka aplikasi NEXMAP, pilih Daftar, verifikasi nomor telepon melalui OTP, lalu lengkapi username dan jenis kendaraan Anda.', o: 2 },
    { id: 'faq-3', category: 'general', q: 'Apakah NEXMAP bisa digunakan offline?', a: 'Peta yang telah diunduh dan rute tersimpan dapat digunakan offline. Laporan komunitas dan kondisi lalu lintas live membutuhkan koneksi internet.', o: 3 },
    { id: 'faq-4', category: 'gps', q: 'Mengapa lokasi GPS saya tidak akurat?', a: 'Pastikan izin lokasi aktif dan Anda berada di area terbuka. Di gedung tinggi atau terowongan, sinyal GPS dapat terganggu. NEXMAP menggunakan Kalman Filter dan map-matching untuk mengurangi noise.', o: 1 },
    { id: 'faq-5', category: 'gps', q: 'Bagaimana cara mengubah jenis kendaraan?', a: 'Buka Profil > Pengaturan Kendaraan, lalu pilih motor, mobil, bus, truk, atau sepeda. Jenis kendaraan memengaruhi rute yang disarankan.', o: 2 },
    { id: 'faq-6', category: 'live_report', q: 'Bagaimana cara melaporkan kondisi jalan?', a: 'Ketuk tombol Lapor Kondisi Jalan, pilih kategori, ambil foto bukti, lalu kirim. Laporan akan diverifikasi oleh komunitas di sekitar lokasi.', o: 1 },
    { id: 'faq-7', category: 'live_report', q: 'Mengapa laporan saya ditolak?', a: 'Laporan dapat ditolak jika tidak sesuai lokasi GPS, minim bukti, duplikat, atau mendapat sanggahan komunitas. Jaga akurasi laporan untuk mempertahankan reputasi.', o: 2 },
    { id: 'faq-8', category: 'gamification', q: 'Bagaimana cara mendapatkan XP?', a: 'Anda mendapatkan XP dari perjalanan valid (+10 XP dan bonus jarak), laporan valid (+20 XP), verifikasi laporan (+5 XP), serta misi harian dan mingguan.', o: 1 },
    { id: 'faq-9', category: 'gamification', q: 'Apakah kecepatan tinggi menambah XP?', a: 'Tidak. NEXMAP tidak memberi reward berdasarkan kecepatan. Reward berfokus pada perjalanan tertib, eksplorasi aman, dan kontribusi komunitas.', o: 2 },
    { id: 'faq-10', category: 'payment', q: 'Metode pembayaran apa yang didukung?', a: 'NEXMAP mendukung QRIS, Virtual Account bank, e-wallet (GoPay, OVO, ShopeePay), dan kartu debit/kredit melalui payment gateway resmi.', o: 1 },
    { id: 'faq-11', category: 'payment', q: 'Apakah NEX Gems bisa diuangkan?', a: 'Tidak. NEX Gems dan NEX Coins hanya dapat digunakan untuk item kosmetik non-kompetitif dan tidak dapat ditukar menjadi uang tunai.', o: 2 },
    { id: 'faq-12', category: 'security', q: 'Bagaimana cara mengaktifkan Emergency SOS?', a: 'Buka Safety Center dan tahan tombol SOS selama 3 detik. Aplikasi akan menyiarkan lokasi ke kontak darurat dan menampilkan nomor darurat 110/112/119.', o: 1 },
    { id: 'faq-13', category: 'security', q: 'Apakah lokasi saya selalu dibagikan?', a: 'Tidak. Sesuai UU PDP No. 27/2022, lokasi hanya dibagikan sesuai izin Anda. Gunakan Ghost Mode atau Fuzzy Privacy Zone untuk menyamarkan lokasi rumah/kantor.', o: 2 }
  ];
  for (const f of faqs) {
    db.run(
      `INSERT OR REPLACE INTO faqs (id, category, question, answer, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [f.id, f.category, f.q, f.a, f.o]
    );
  }

  // 10. Traffic News
  const trafficNews = [
    {
      id: 'tnews-001',
      headline: 'Peningkatan Volume Kendaraan di Jalur Puncak Siang Ini',
      body: 'Diperkirakan terjadi kepadatan mulai KM 14 hingga KM 21. Pengendara disarankan berangkat lebih awal atau menggunakan jalur alternatif Cibubur.',
      category: 'traffic',
      severity: 'warning',
      source: 'NEXMAP Newsroom',
      lat: -6.2800,
      lon: 106.8700,
      radiusKm: 15,
      hours: 12
    },
    {
      id: 'tnews-002',
      headline: 'Uji Coba Ganjil-Genap Diperluas Mulai Pekan Depan',
      body: 'Pemerintah Provinsi DKI Jakarta mengumumkan perluasan kawasan ganjil-genap pada 5 ruas jalan baru. Pengendara diimbau menyesuaikan jadwal perjalanan.',
      category: 'policy',
      severity: 'info',
      source: 'Dishub DKI Jakarta',
      lat: -6.2088,
      lon: 106.8229,
      radiusKm: 20,
      hours: 48
    }
  ];
  for (const n of trafficNews) {
    db.run(
      `INSERT OR REPLACE INTO traffic_news (id, headline, body, category, severity, source, lat, lon, radius_km, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [n.id, n.headline, n.body, n.category, n.severity, n.source, n.lat, n.lon, n.radiusKm, now + n.hours * oneHour, now - oneHour]
    );
  }

  // 11. Social graph (demo user follows top explorers)
  const follows = [
    { id: 'flw-001', follower: 'usr-demo-001', following: 'usr-top-001' },
    { id: 'flw-002', follower: 'usr-demo-001', following: 'usr-top-002' },
    { id: 'flw-003', follower: 'usr-top-001', following: 'usr-demo-001' },
    { id: 'flw-004', follower: 'usr-top-002', following: 'usr-top-001' }
  ];
  for (const f of follows) {
    db.run(
      'INSERT OR REPLACE INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)',
      [f.id, f.follower, f.following, now - 5 * oneDay]
    );
  }

  // 12. Historical trips (for weekly leaderboards & achievements)
  const trips = [
    { id: 'trip-seed-1', user: 'usr-top-001', dist: 32.4, mins: 48, max: 62, hoursAgo: 20 },
    { id: 'trip-seed-2', user: 'usr-top-001', dist: 18.2, mins: 35, max: 55, hoursAgo: 50 },
    { id: 'trip-seed-3', user: 'usr-top-002', dist: 22.1, mins: 40, max: 58, hoursAgo: 10 },
    { id: 'trip-seed-4', user: 'usr-top-003', dist: 9.8, mins: 30, max: 28, hoursAgo: 40 },
    { id: 'trip-seed-5', user: 'usr-demo-001', dist: 6.8, mins: 18, max: 48, hoursAgo: 26 },
    { id: 'trip-seed-6', user: 'usr-demo-001', dist: 4.2, mins: 12, max: 41, hoursAgo: 3 },
    { id: 'trip-seed-7', user: 'usr-demo-001', dist: 11.5, mins: 28, max: 52, hoursAgo: 8 },
    { id: 'trip-seed-8', user: 'usr-demo-001', dist: 7.4, mins: 20, max: 44, hoursAgo: 60 }
  ];
  for (const t of trips) {
    db.run(
      `INSERT OR REPLACE INTO trips (id, user_id, vehicle_type, distance_km, duration_mins,
        avg_speed_kmh, max_speed_kmh, earned_xp, is_valid, anti_cheat_flags, created_at)
       VALUES (?, ?, 'motorcycle', ?, ?, ?, ?, ?, 1, '[]', ?)`,
      [t.id, t.user, t.dist, t.mins, t.dist / (t.mins / 60), t.max, 10 + Math.floor(t.dist / 5) * 5, now - t.hoursAgo * oneHour]
    );
  }

  // 13. XP ledger events (weekly/monthly leaderboards)
  const xpEvents = [
    { user: 'usr-top-001', amount: 120, reason: 'completed_trip', hoursAgo: 20 },
    { user: 'usr-top-001', amount: 60, reason: 'vote_report', hoursAgo: 30 },
    { user: 'usr-top-002', amount: 90, reason: 'submit_report', hoursAgo: 10 },
    { user: 'usr-top-003', amount: 45, reason: 'completed_trip', hoursAgo: 40 },
    { user: 'usr-demo-001', amount: 25, reason: 'completed_trip', hoursAgo: 26 }
  ];
  let xpSeq = 0;
  for (const x of xpEvents) {
    db.run(
      'INSERT OR REPLACE INTO xp_events (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)',
      [`xp-seed-${++xpSeq}`, x.user, x.amount, x.reason, now - x.hoursAgo * oneHour]
    );
  }

  // 14. Report votes (consistent with seeded confirmations)
  const voteSeed = [];
  const confirmers = ['usr-top-001', 'usr-top-002', 'usr-top-003'];
  for (let i = 0; i < 3; i++) {
    voteSeed.push({ report: 'rep-001', user: confirmers[i], type: 'still_happening' });
  }
  for (let i = 0; i < 2; i++) {
    voteSeed.push({ report: 'rep-002', user: confirmers[i], type: 'still_happening' });
  }
  voteSeed.push({ report: 'rep-002', user: 'usr-top-003', type: 'resolved' });
  for (let i = 0; i < 3; i++) {
    voteSeed.push({ report: 'rep-003', user: confirmers[i], type: 'still_happening' });
  }
  voteSeed.push({ report: 'rep-004', user: 'usr-top-001', type: 'still_happening' });
  let voteSeq = 0;
  for (const v of voteSeed) {
    db.run(
      `INSERT OR REPLACE INTO report_votes (id, report_id, user_id, vote_type, voter_lat, voter_lon, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`vote-seed-${++voteSeq}`, v.report, v.user, v.type, -6.2088, 106.8229, now - oneHour]
    );
  }

  // 15. Mission progress rows for demo user
  const missionRows = [
    { user: 'usr-demo-001', mission: 'msn-daily-1', count: 4.5, completed: 0, claimed: 0 },
    { user: 'usr-demo-001', mission: 'msn-daily-2', count: 0, completed: 0, claimed: 0 },
    { user: 'usr-demo-001', mission: 'msn-daily-3', count: 1, completed: 0, claimed: 0 },
    { user: 'usr-demo-001', mission: 'msn-weekly-1', count: 12, completed: 0, claimed: 0 }
  ];
  for (const m of missionRows) {
    db.run(
      `INSERT OR REPLACE INTO user_mission_progress (id, user_id, mission_id, current_count, is_completed, is_claimed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`ump-seed-${m.mission}`, m.user, m.mission, m.count, m.completed, m.claimed]
    );
  }

  // 16. Extra store items (profile frames & effects)
  const extraItems = [
    { id: 'frame-neon', name: 'Neon Aura Frame', category: 'profile_frame', currency: 'coins', price: 450, desc: 'Bingkai profil bercahaya cyan yang berdenyut halus.', icon: '🔷' },
    { id: 'frame-gold', name: 'Royal Gold Frame', category: 'profile_frame', currency: 'gems', price: 120, desc: 'Bingkai profil emas eksklusif untuk Navigator legendaris.', icon: '🏅' },
    { id: 'effect-trail', name: 'Road Light Trail', category: 'profile_effect', currency: 'coins', price: 700, desc: 'Jejak cahaya kosmetik di belakang ikon kendaraan Anda.', icon: '✨' },
    { id: 'effect-rain', name: 'Holographic Rain', category: 'profile_effect', currency: 'gems', price: 180, desc: 'Efek partikel hujan holografik pada kartu profil Anda.', icon: '🌧️' }
  ];
  for (const it of extraItems) {
    db.run(
      `INSERT OR REPLACE INTO store_items (id, name, category, currency_type, price, description, icon, preview_data, is_exclusive, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [it.id, it.name, it.category, it.currency, it.price, it.desc, it.icon, JSON.stringify({})]
    );
  }

  // Ensure all store items are active (migration default safeguard)
  db.run('UPDATE store_items SET is_active = 1 WHERE is_active IS NULL');

  // 17. Clear stale SOS sessions
  db.run("UPDATE sos_sessions SET status = 'RESOLVED', resolved_at = ? WHERE status = 'ACTIVE_EMERGENCY'", [now]);

  // 18. Home/privacy zone for demo user
  db.run('UPDATE users SET home_lat = ?, home_lon = ? WHERE id = ?', [-6.2100, 106.8200, 'usr-demo-001']);

  // 19. Ensure traffic segments exist
  require('../src/services/trafficService').seedSegments();

  // 20. Notifications
  const notifications = [
    { id: 'ntf-seed-1', type: 'achievement', title: 'Achievement terbuka: First Journey', body: 'Menyelesaikan perjalanan valid pertama. (+20 NEX Coins)', link: 'gamification', read: 0, hoursAgo: 2 },
    { id: 'ntf-seed-2', type: 'follow', title: 'Pengikut baru', body: 'RoadMaster_ID mulai mengikuti Anda.', link: 'profile', read: 0, hoursAgo: 5 },
    { id: 'ntf-seed-3', type: 'comment', title: 'Komentar baru pada laporan Anda', body: 'UrbanRider_JKT: Petugas sudah datang, terima kasih infonya.', link: 'report:rep-004', read: 0, hoursAgo: 7 },
    { id: 'ntf-seed-4', type: 'payment', title: 'Top-Up berhasil', body: 'Pembayaran diterima. +260 NEX Gems telah masuk ke dompet Anda.', link: 'store', read: 1, hoursAgo: 30 },
    { id: 'ntf-seed-5', type: 'mission', title: 'Misi selesai: Komuter Harian', body: 'Hadiah +70 XP dan +40 NEX Coins telah ditambahkan.', link: 'gamification', read: 1, hoursAgo: 48 }
  ];
  for (const n of notifications) {
    db.run(
      `INSERT OR REPLACE INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
       VALUES (?, 'usr-demo-001', ?, ?, ?, ?, ?, ?)`,
      [n.id, n.type, n.title, n.body, n.link, n.read, now - n.hoursAgo * oneHour]
    );
  }

  // 21. Saved places
  const places = [
    { id: 'place-seed-1', label: 'Rumah', address: 'Kebayoran Baru, Jakarta Selatan', lat: -6.2100, lon: 106.8200, icon: '🏠' },
    { id: 'place-seed-2', label: 'Kantor', address: 'Jl. Jend. Sudirman, Jakarta Pusat', lat: -6.2088, lon: 106.8229, icon: '🏢' },
    { id: 'place-seed-3', label: 'GBK Senayan', address: 'Gelora Bung Karno, Jakarta Pusat', lat: -6.2185, lon: 106.8025, icon: '🏟️' }
  ];
  for (const p of places) {
    db.run(
      `INSERT OR REPLACE INTO saved_places (id, user_id, label, address, lat, lon, icon, created_at)
       VALUES (?, 'usr-demo-001', ?, ?, ?, ?, ?, ?)`,
      [p.id, p.label, p.address, p.lat, p.lon, p.icon, now - 10 * oneDay]
    );
  }

  // 22. Report comments
  const comments = [
    { id: 'cmt-seed-1', report: 'rep-001', user: 'usr-top-002', name: 'UrbanRider_JKT', body: 'Konfirmasi, masih padat merayap arah selatan. Alternatif lewat Rasuna lebih lancar.', hoursAgo: 20 },
    { id: 'cmt-seed-2', report: 'rep-001', user: 'usr-demo-001', name: 'NEX_Rider', body: 'Terima kasih infonya, saya ambil jalur alternatif.', hoursAgo: 18 },
    { id: 'cmt-seed-3', report: 'rep-002', user: 'usr-top-001', name: 'RoadMaster_ID', body: 'Genangan mulai surut, lajur kiri sudah bisa dilalui motor.', hoursAgo: 1 },
    { id: 'cmt-seed-4', report: 'rep-004', user: 'usr-top-002', name: 'UrbanRider_JKT', body: 'Petugas sudah datang, terima kasih infonya.', hoursAgo: 7 }
  ];
  for (const c of comments) {
    db.run(
      `INSERT OR REPLACE INTO report_comments (id, report_id, user_id, author_name, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'visible', ?)`,
      [c.id, c.report, c.user, c.name, c.body, now - c.hoursAgo * oneHour]
    );
  }

  console.log('NEXMAP database successfully initialized and seeded!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
