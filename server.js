const express = require('express');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');

const db = require('./database/db');
const seedDatabase = require('./database/seed');
const TrustEngine = require('./src/services/trustEngine');
const GamificationService = require('./src/services/gamificationService');
const TrackingService = require('./src/services/trackingService');
const PaymentService = require('./src/services/paymentService');
const SafetyService = require('./src/services/safetyService');
const CivicService = require('./src/services/civicService');
const MissionService = require('./src/services/missionService');
const AchievementService = require('./src/services/achievementService');
const SocialService = require('./src/services/socialService');
const SupportService = require('./src/services/supportService');
const NewsService = require('./src/services/newsService');
const TrafficService = require('./src/services/trafficService');
const NotificationService = require('./src/services/notificationService');
const TripService = require('./src/services/tripService');
const PlaceService = require('./src/services/placeService');
const CommentService = require('./src/services/commentService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/v1/stream' });

// Active demo user (authentication is out of scope for this prototype)
const DEFAULT_USER_ID = 'usr-demo-001';

const REPORT_CATEGORIES = [
  'accident',
  'flood',
  'traffic_jam',
  'road_damage',
  'road_closure',
  'construction',
  'broken_traffic_light',
  'vehicle_breakdown',
  'fallen_tree',
  'weather_hazard',
  'other'
];

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// HELPERS: validation, rate limiting, audit, uploads
// -------------------------------------------------------------
const rateBuckets = new Map();

function rateLimit(key, max, windowMs) {
  const now = Date.now();

  // Prevent unbounded growth of the in-memory bucket map
  if (rateBuckets.size > 5000) {
    for (const [k, times] of rateBuckets) {
      if (!times.length || now - times[times.length - 1] > windowMs) rateBuckets.delete(k);
    }
  }

  const hits = (rateBuckets.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= max) {
    return false;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  return true;
}

function audit(action, target = null, details = null, actor = DEFAULT_USER_ID) {
  db.run(
    `INSERT INTO audit_logs (id, actor, action, target, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [`aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, actor, action, target, details, Date.now()]
  );
}

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, data: payload, timestamp: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// Push notifications to connected clients in real time
NotificationService.setBroadcaster(notification => broadcast('NOTIFICATION', notification));

function getUser(userId = DEFAULT_USER_ID) {
  return db.get('SELECT * FROM users WHERE id = ?', [userId]);
}

/**
 * CSV cell escaping with formula-injection protection (OWASP).
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@]/.test(str)) str = "'" + str;
  if (/[",\r\n]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

function enrichUser(user) {
  if (!user) return null;
  const rankTier = GamificationService.getRankTier(user.level);
  const nextLevelXp = GamificationService.getXpForLevel(user.level + 1);
  const currentLevelBaseXp = GamificationService.getXpForLevel(user.level);
  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      Math.round(((user.current_xp - currentLevelBaseXp) / Math.max(1, nextLevelXp - currentLevelBaseXp)) * 100)
    )
  );

  const inventory = db.all(
    `SELECT si.*, ui.is_equipped
     FROM user_inventory ui JOIN store_items si ON ui.item_id = si.id
     WHERE ui.user_id = ?`,
    [user.id]
  );

  return {
    ...user,
    rankTier,
    nextLevelXp,
    progressPercent,
    inventory,
    unreadNotifications: NotificationService.unreadCount(user.id),
    achievements: AchievementService.getUserAchievements(user.id)
  };
}

// Simple in-memory upload storage (swap for S3/MinIO in production)
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// -------------------------------------------------------------
// HEALTH & META
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nexmap-core',
    version: '1.2.0',
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.get('/api/meta', (req, res) => {
  res.json({
    categories: REPORT_CATEGORIES,
    voteTypes: TrustEngine.VALID_VOTE_TYPES,
    emergencyNumbers: SafetyService.EMERGENCY_NUMBERS,
    topupPackages: PaymentService.getPackages()
  });
});

// -------------------------------------------------------------
// MAP CONFIG (key-free tiles by default, with automatic fallback)
// -------------------------------------------------------------
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const FALLBACK_TILE_URLS = [
  'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
];

app.get('/api/config', (req, res) => {
  const custom = process.env.NEXMAP_TILE_URL;
  res.json({
    version: '1.2.0',
    tileUrl: custom || DEFAULT_TILE_URL,
    fallbackTileUrls: FALLBACK_TILE_URLS,
    usesOpenStreetMap: !custom
  });
});

// -------------------------------------------------------------
// UPLOAD EVIDENCE
// -------------------------------------------------------------
app.post('/api/upload', (req, res) => {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'dataUrl wajib diisi' });
    }
    const match = /^data:(image\/(png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return res.status(400).json({ error: 'Format gambar tidak didukung (png/jpg/webp)' });

    const mime = match[1];
    const buffer = Buffer.from(match[3], 'base64');
    if (buffer.length > 3 * 1024 * 1024) {
      return res.status(413).json({ error: 'Ukuran gambar maksimal 3MB' });
    }

    // Verify the bytes actually match the declared image type (prevents MIME spoofing)
    const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp =
      buffer.length > 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!isPng && !isJpeg && !isWebp) {
      return res.status(400).json({ error: 'Isi file bukan gambar yang valid' });
    }

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const filename = `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

    return res.status(201).json({ success: true, url: `/uploads/${filename}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// USER & PROFILE
// -------------------------------------------------------------
app.get('/api/user/profile', (req, res) => {
  const user = getUser();
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json(enrichUser(user));
});

app.post('/api/user/privacy', (req, res) => {
  try {
    const { privacyMode, fuzzyRadiusMeters, homeLat, homeLon } = req.body;
    const result = SafetyService.updatePrivacy(DEFAULT_USER_ID, {
      privacyMode,
      fuzzyRadiusMeters,
      homeLat,
      homeLon
    });
    audit('privacy.update', DEFAULT_USER_ID, JSON.stringify(result));
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/user/privacy/preview', (req, res) => {
  const { lat, lon } = req.body;
  const result = SafetyService.maskCoordinatesIfInPrivateZone(DEFAULT_USER_ID, lat, lon);
  res.json(result);
});

// UU PDP: data export & right to erasure
app.get('/api/user/export', (req, res) => {
  const user = getUser();
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const data = {
    exportedAt: new Date().toISOString(),
    profile: enrichUser(user),
    trips: db.all('SELECT * FROM trips WHERE user_id = ?', [DEFAULT_USER_ID]),
    reports: db.all('SELECT * FROM live_reports WHERE user_id = ?', [DEFAULT_USER_ID]),
    votes: db.all('SELECT * FROM report_votes WHERE user_id = ?', [DEFAULT_USER_ID]),
    transactions: db.all('SELECT * FROM topup_transactions WHERE user_id = ?', [DEFAULT_USER_ID]),
    tickets: SupportService.getUserTickets(DEFAULT_USER_ID),
    savedPlaces: PlaceService.list(DEFAULT_USER_ID),
    comments: db.all('SELECT * FROM report_comments WHERE user_id = ?', [DEFAULT_USER_ID]),
    notifications: NotificationService.list(DEFAULT_USER_ID, { limit: 200 })
  };
  audit('pdp.data_export', DEFAULT_USER_ID);
  res.setHeader('Content-Disposition', 'attachment; filename="nexmap-data-export.json"');
  res.json(data);
});

app.delete('/api/user/history', (req, res) => {
  const tripsDeleted = db.get('SELECT COUNT(*) AS c FROM trips WHERE user_id = ?', [DEFAULT_USER_ID]).c;
  const votesDeleted = db.get('SELECT COUNT(*) AS c FROM report_votes WHERE user_id = ?', [DEFAULT_USER_ID]).c;
  db.run('DELETE FROM trips WHERE user_id = ?', [DEFAULT_USER_ID]);
  db.run('DELETE FROM report_votes WHERE user_id = ?', [DEFAULT_USER_ID]);
  audit('pdp.trip_history_erased', DEFAULT_USER_ID, `trips=${tripsDeleted}, votes=${votesDeleted}`);
  res.json({
    success: true,
    deleted: { trips: tripsDeleted, votes: votesDeleted },
    message: 'Riwayat perjalanan dan voting telah dihapus permanen'
  });
});

// -------------------------------------------------------------
// NOTIFICATIONS
// -------------------------------------------------------------
app.get('/api/notifications', (req, res) => {
  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  res.json({
    unreadCount: NotificationService.unreadCount(DEFAULT_USER_ID),
    notifications: NotificationService.list(DEFAULT_USER_ID, { unreadOnly, limit })
  });
});

app.post('/api/notifications/:id/read', (req, res) => {
  try {
    res.json(NotificationService.markRead(DEFAULT_USER_ID, req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/notifications/read-all', (req, res) => {
  res.json(NotificationService.markAllRead(DEFAULT_USER_ID));
});

app.delete('/api/notifications', (req, res) => {
  audit('notification.clear', DEFAULT_USER_ID);
  res.json(NotificationService.clear(DEFAULT_USER_ID));
});

// -------------------------------------------------------------
// REAL-TIME VEHICLES & TRAFFIC
// -------------------------------------------------------------
app.get('/api/vehicles/live', (req, res) => {
  res.json(TrackingService.getLiveVehicles());
});

app.get('/api/traffic/segments', (req, res) => {
  res.json(TrafficService.getSegments());
});

app.get('/api/traffic/summary', (req, res) => {
  res.json(TrafficService.getSummary());
});

// -------------------------------------------------------------
// NAVIGATION
// -------------------------------------------------------------
app.get('/api/navigation/route', (req, res) => {
  const fromLat = parseFloat(req.query.fromLat) || -6.2088;
  const fromLon = parseFloat(req.query.fromLon) || 106.8229;
  const toLat = parseFloat(req.query.toLat) || -6.2440;
  const toLon = parseFloat(req.query.toLon) || 106.7990;
  res.json(TrackingService.generateNavigationRoute(fromLat, fromLon, toLat, toLon));
});

// -------------------------------------------------------------
// SAVED PLACES
// -------------------------------------------------------------
app.get('/api/places', (req, res) => {
  res.json(PlaceService.list(DEFAULT_USER_ID));
});

app.post('/api/places', (req, res) => {
  try {
    const place = PlaceService.create(DEFAULT_USER_ID, req.body);
    audit('place.create', place.id, place.label);
    res.status(201).json(place);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/places/:id', (req, res) => {
  try {
    const place = PlaceService.update(DEFAULT_USER_ID, req.params.id, req.body);
    audit('place.update', place.id, place.label);
    res.json(place);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/places/:id', (req, res) => {
  try {
    const result = PlaceService.remove(DEFAULT_USER_ID, req.params.id);
    audit('place.remove', req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// LIVE REPORTS
// -------------------------------------------------------------
app.get('/api/reports/active', (req, res) => {
  const now = Date.now();
  const limit = Math.min(200, parseInt(req.query.limit) || 100);
  const rows = db.all(
    `SELECT * FROM live_reports
     WHERE status IN ('pending', 'verified', 'active') AND expires_at > ?
     ORDER BY confidence_score DESC, created_at DESC LIMIT ?`,
    [now, limit]
  );
  res.json(rows);
});

app.get('/api/reports/:id', (req, res) => {
  const report = db.get('SELECT * FROM live_reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  const votes = db.all('SELECT vote_type, COUNT(*) AS count FROM report_votes WHERE report_id = ? GROUP BY vote_type', [
    req.params.id
  ]);
  res.json({ ...report, votes, commentCount: CommentService.count(req.params.id) });
});

app.post('/api/reports', (req, res) => {
  try {
    if (!rateLimit(`report:${DEFAULT_USER_ID}`, 1, 3 * 60 * 1000)) {
      return res.status(429).json({ error: 'Batas laporan: 1 laporan setiap 3 menit' });
    }

    const { category, title, description, lat, lon, roadName, imageUrl, city } = req.body;
    if (!category || !REPORT_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Kategori laporan tidak valid' });
    }
    if (!title || String(title).trim().length < 5) {
      return res.status(400).json({ error: 'Judul laporan minimal 5 karakter' });
    }
    const fLat = parseFloat(lat);
    const fLon = parseFloat(lon);
    if (!Number.isFinite(fLat) || !Number.isFinite(fLon) || Math.abs(fLat) > 90 || Math.abs(fLon) > 180) {
      return res.status(400).json({ error: 'Koordinat GPS tidak valid' });
    }

    // Anti-duplication: same category within 150 m in the last 15 minutes
    const nearby = db.all(
      `SELECT id, title, lat, lon, created_at FROM live_reports
       WHERE category = ? AND status IN ('pending', 'active', 'verified') AND created_at > ?`,
      [category, Date.now() - 15 * 60 * 1000]
    );
    const duplicate = nearby.find(r => db.haversineDistanceMeters(fLat, fLon, r.lat, r.lon) <= 150);
    if (duplicate) {
      return res.status(409).json({
        error: 'Laporan serupa sudah ada di sekitar lokasi ini. Verifikasi laporan tersebut alih-alih membuat yang baru.',
        existingReportId: duplicate.id
      });
    }

    const user = getUser();
    const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const weight = TrustEngine.CATEGORY_WEIGHTS[category] || 1.0;
    const initialScore = Number(((user ? user.reputation_score : 0.5) * weight).toFixed(2));

    // Category-specific lifetimes
    const lifetimes = {
      traffic_jam: 45,
      accident: 120,
      flood: 240,
      vehicle_breakdown: 90,
      road_damage: 7 * 24 * 60,
      road_closure: 12 * 60,
      construction: 7 * 24 * 60,
      default: 240
    };
    const ttlMins = lifetimes[category] || lifetimes.default;

    db.run(
      `INSERT INTO live_reports (
        id, user_id, author_name, category, title, description,
        lat, lon, road_name, status, confidence_score, confirmations,
        denials, image_url, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, 0, ?, ?, ?)`,
      [
        reportId,
        DEFAULT_USER_ID,
        user ? user.username : 'Komuter',
        category,
        String(title).trim(),
        description || '',
        fLat,
        fLon,
        roadName || 'Jalan Umum',
        initialScore,
        imageUrl || '',
        Date.now() + ttlMins * 60 * 1000,
        Date.now()
      ]
    );

    db.run('UPDATE users SET total_reports = total_reports + 1 WHERE id = ?', [DEFAULT_USER_ID]);
    GamificationService.addXp(DEFAULT_USER_ID, 20, 'submit_report');
    MissionService.progress(DEFAULT_USER_ID, 'report', 1);
    audit('report.create', reportId, `${category} | ${roadName || '-'}`);

    const created = db.get('SELECT * FROM live_reports WHERE id = ?', [reportId]);
    broadcast('NEW_REPORT', created);
    broadcast('USER_UPDATED', enrichUser(getUser()));

    res.status(201).json({ success: true, report: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports/:id/vote', (req, res) => {
  try {
    if (!rateLimit(`vote:${DEFAULT_USER_ID}`, 20, 60 * 1000)) {
      return res.status(429).json({ error: 'Terlalu banyak voting, coba lagi nanti' });
    }
    const { voteType, voterLat, voterLon } = req.body;
    const evaluation = TrustEngine.castVote({
      reportId: req.params.id,
      userId: DEFAULT_USER_ID,
      voteType,
      voterLat: voterLat != null ? parseFloat(voterLat) : null,
      voterLon: voterLon != null ? parseFloat(voterLon) : null
    });

    const updatedReport = db.get('SELECT * FROM live_reports WHERE id = ?', [req.params.id]);
    broadcast('REPORT_UPDATED', updatedReport);
    broadcast('USER_UPDATED', enrichUser(getUser()));

    res.json({ success: true, evaluation, report: updatedReport });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reports/:id/comments', (req, res) => {
  res.json(CommentService.list(req.params.id, req.query.limit));
});

app.post('/api/reports/:id/comments', (req, res) => {
  try {
    if (!rateLimit(`comment:${DEFAULT_USER_ID}`, 10, 60 * 1000)) {
      return res.status(429).json({ error: 'Terlalu banyak komentar, coba lagi sebentar' });
    }
    const comment = CommentService.add({
      reportId: req.params.id,
      userId: DEFAULT_USER_ID,
      body: req.body.body
    });
    audit('comment.create', comment.id, `report=${req.params.id}`);
    broadcast('REPORT_COMMENT', comment);
    res.status(201).json(comment);
  } catch (err) {
    const code = /tidak ditemukan/i.test(err.message) ? 404 : 400;
    res.status(code).json({ error: err.message });
  }
});

app.delete('/api/reports/comments/:commentId', (req, res) => {
  try {
    const result = CommentService.remove(req.params.commentId, DEFAULT_USER_ID, false);
    audit('comment.remove', req.params.commentId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// GAMIFICATION: TRIPS, LEADERBOARDS, MISSIONS, ACHIEVEMENTS
// -------------------------------------------------------------
app.post('/api/trips/finish', (req, res) => {
  try {
    const { vehicleType, distanceKm, durationMins, maxSpeedKmh, mockFlag, accelMps2 } = req.body;
    const result = GamificationService.recordTrip({
      userId: DEFAULT_USER_ID,
      vehicleType: ['motorcycle', 'car', 'bus', 'truck', 'bicycle'].includes(vehicleType) ? vehicleType : 'motorcycle',
      distanceKm: Math.max(0, parseFloat(distanceKm) || 5),
      durationMins: Math.max(1, parseInt(durationMins, 10) || 12),
      maxSpeedKmh: Math.max(0, parseFloat(maxSpeedKmh) || 45),
      mockFlag: Boolean(mockFlag),
      accelMps2: parseFloat(accelMps2) || 2.5
    });
    broadcast('USER_UPDATED', enrichUser(getUser()));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trips', (req, res) => {
  res.json(TripService.history(DEFAULT_USER_ID, req.query.limit));
});

app.get('/api/trips/stats', (req, res) => {
  res.json(TripService.stats(DEFAULT_USER_ID));
});

app.get('/api/gamification/leaderboard', (req, res) => {
  const category = req.query.category || 'explorer';
  const period = ['weekly', 'monthly', 'all'].includes(req.query.period) ? req.query.period : 'all';
  const scope = req.query.scope === 'friends' ? 'friends' : 'global';
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  res.json(
    GamificationService.getLeaderboards(category, { period, scope, viewerId: DEFAULT_USER_ID, limit })
  );
});

app.get('/api/gamification/missions', (req, res) => {
  res.json(MissionService.getUserMissions(DEFAULT_USER_ID));
});

app.post('/api/gamification/missions/:id/claim', (req, res) => {
  try {
    const result = MissionService.claim(DEFAULT_USER_ID, req.params.id);
    audit('mission.claim', req.params.id, `+${result.rewardXp} XP, +${result.rewardCoins} coins`);
    broadcast('USER_UPDATED', enrichUser(getUser()));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/gamification/achievements', (req, res) => {
  res.json(AchievementService.getUserAchievements(DEFAULT_USER_ID));
});

// -------------------------------------------------------------
// SOCIAL: PROFILES, FOLLOW
// -------------------------------------------------------------
app.get('/api/social/users', (req, res) => {
  res.json(SocialService.searchUsers(req.query.q || '', 20));
});

app.get('/api/social/profile/:id', (req, res) => {
  try {
    res.json(SocialService.getProfile(req.params.id, DEFAULT_USER_ID));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/social/follow/:id', (req, res) => {
  try {
    const result = SocialService.follow(DEFAULT_USER_ID, req.params.id);
    audit('social.follow', req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/social/unfollow/:id', (req, res) => {
  res.json(SocialService.unfollow(DEFAULT_USER_ID, req.params.id));
});

app.get('/api/social/following', (req, res) => {
  res.json(SocialService.getFollowing(DEFAULT_USER_ID));
});

app.get('/api/social/followers', (req, res) => {
  res.json(SocialService.getFollowers(DEFAULT_USER_ID));
});

// -------------------------------------------------------------
// TRAFFIC NEWS (personalized feed)
// -------------------------------------------------------------
app.get('/api/news', (req, res) => {
  const lat = req.query.lat != null ? parseFloat(req.query.lat) : -6.2088;
  const lon = req.query.lon != null ? parseFloat(req.query.lon) : 106.8229;
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  res.json(NewsService.getPersonalizedFeed({ lat, lon, limit }));
});

app.post('/api/news', (req, res) => {
  try {
    const result = NewsService.publishNews(req.body);
    audit('news.publish', result.id, result.headline);
    broadcast('TRAFFIC_NEWS', result);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// HELP CENTER & SUPPORT
// -------------------------------------------------------------
app.get('/api/help/faqs', (req, res) => {
  res.json({
    categories: SupportService.getFaqCategories(),
    faqs: SupportService.getFaqs({ category: req.query.category, q: req.query.q })
  });
});

app.get('/api/help/tickets', (req, res) => {
  res.json(SupportService.getUserTickets(DEFAULT_USER_ID));
});

app.post('/api/help/tickets', (req, res) => {
  try {
    if (!rateLimit(`ticket:${DEFAULT_USER_ID}`, 3, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Terlalu banyak tiket, coba lagi nanti' });
    }
    const result = SupportService.createTicket({ userId: DEFAULT_USER_ID, ...req.body });
    audit('support.ticket_create', result.id, req.body.subject);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// NEX STORE & PAYMENTS
// -------------------------------------------------------------
app.get('/api/store/items', (req, res) => {
  const items = db.all('SELECT * FROM store_items WHERE is_active = 1');
  const user = db.get('SELECT nex_coins, nex_gems FROM users WHERE id = ?', [DEFAULT_USER_ID]);
  const inventory = db.all('SELECT item_id, is_equipped FROM user_inventory WHERE user_id = ?', [DEFAULT_USER_ID]);
  res.json({ items, wallet: user, packages: PaymentService.TOPUP_PACKAGES, inventory });
});

app.post('/api/store/topup/initiate', (req, res) => {
  try {
    const { packageId, paymentMethod, idempotencyKey } = req.body;
    const result = PaymentService.initiateTopup({
      userId: DEFAULT_USER_ID,
      packageId,
      paymentMethod,
      idempotencyKey
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/store/topup/webhook', (req, res) => {
  try {
    const strict = process.env.PAYMENT_STRICT === 'true';
    const result = PaymentService.processWebhook({ ...req.body, strict });
    if (result.success && !result.alreadyProcessed) {
      audit('payment.paid', req.body.orderId, `+${result.gemsAwarded} gems`);
      broadcast('USER_UPDATED', enrichUser(getUser()));
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dev-only helper: simulates the gateway callback with a valid HMAC signature.
app.post('/api/store/topup/simulate-payment', (req, res) => {
  try {
    const { orderId } = req.body;
    const signature = PaymentService.signWebhook(orderId, 'paid');
    const result = PaymentService.processWebhook({ orderId, status: 'paid', signature });
    if (result.success && !result.alreadyProcessed) {
      audit('payment.paid', orderId, `+${result.gemsAwarded} gems (simulated)`);
      broadcast('USER_UPDATED', enrichUser(getUser()));
    }
    res.json({ ...result, signature });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/store/buy', (req, res) => {
  try {
    const result = PaymentService.purchaseItem(DEFAULT_USER_ID, req.body.itemId);
    audit('store.purchase', req.body.itemId, result.purchasedItem.name);
    broadcast('USER_UPDATED', enrichUser(getUser()));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/store/equip', (req, res) => {
  try {
    const result = PaymentService.equipItem(DEFAULT_USER_ID, req.body.itemId);
    audit('store.equip', req.body.itemId);
    broadcast('USER_UPDATED', enrichUser(getUser()));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SAFETY CENTER & SOS
// -------------------------------------------------------------
app.post('/api/safety/sos/trigger', (req, res) => {
  try {
    const { lat, lon, userNote } = req.body;
    const session = SafetyService.triggerSos({
      userId: DEFAULT_USER_ID,
      lat: lat != null ? parseFloat(lat) : -6.2088,
      lon: lon != null ? parseFloat(lon) : 106.8229,
      userNote
    });
    audit('safety.sos_trigger', session.sessionId);
    broadcast('SOS_ALERT', session);
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/safety/sos/resolve', (req, res) => {
  const result = SafetyService.resolveSos(req.body.sessionId);
  audit('safety.sos_resolve', req.body.sessionId || null);
  res.json(result);
});

app.get('/api/safety/sos/active', (req, res) => {
  res.json(SafetyService.getActiveSos(DEFAULT_USER_ID));
});

// Emergency contacts CRUD (used by SOS dispatch)
app.get('/api/safety/contacts', (req, res) => {
  res.json(db.all(
    'SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY created_at DESC, name',
    [DEFAULT_USER_ID]
  ));
});

app.post('/api/safety/contacts', (req, res) => {
  try {
    const { name, phone, relationship } = req.body;
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Nama kontak minimal 2 karakter' });
    }
    if (!phone || !/^\+?[0-9][0-9\s-]{5,19}$/.test(String(phone).trim())) {
      return res.status(400).json({ error: 'Nomor telepon tidak valid' });
    }
    const count = db.get(
      'SELECT COUNT(*) AS c FROM emergency_contacts WHERE user_id = ?',
      [DEFAULT_USER_ID]
    ).c;
    if (count >= 10) {
      return res.status(400).json({ error: 'Maksimal 10 kontak darurat' });
    }
    const id = `emg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.run(
      `INSERT INTO emergency_contacts (id, user_id, name, phone, relationship, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, DEFAULT_USER_ID, String(name).trim(), String(phone).trim(), relationship || 'Kontak Darurat', Date.now()]
    );
    audit('safety.contact_create', id, name);
    res.status(201).json(db.get('SELECT * FROM emergency_contacts WHERE id = ?', [id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/safety/contacts/:id', (req, res) => {
  const contact = db.get('SELECT * FROM emergency_contacts WHERE id = ? AND user_id = ?', [
    req.params.id,
    DEFAULT_USER_ID
  ]);
  if (!contact) return res.status(404).json({ error: 'Kontak tidak ditemukan' });
  db.run('DELETE FROM emergency_contacts WHERE id = ?', [req.params.id]);
  audit('safety.contact_remove', req.params.id, contact.name);
  res.json({ success: true, contactId: req.params.id });
});

// -------------------------------------------------------------
// CIVIC ANNOUNCEMENTS
// -------------------------------------------------------------
app.get('/api/civic/announcements', (req, res) => {
  const lat = req.query.lat ? parseFloat(req.query.lat) : null;
  const lon = req.query.lon ? parseFloat(req.query.lon) : null;
  res.json(CivicService.getAnnouncements(lat, lon));
});

app.post('/api/civic/announcements', (req, res) => {
  try {
    const result = CivicService.publishAnnouncement(req.body);
    audit('civic.publish', result.id, result.headline);
    broadcast('CIVIC_ANNOUNCEMENT', result);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ADMIN, MODERATION & AUDIT
// -------------------------------------------------------------
app.get('/api/admin/overview', (req, res) => {
  const users = db.get('SELECT COUNT(*) AS count FROM users');
  const reports = db.get('SELECT COUNT(*) AS count FROM live_reports');
  const pendingReports = db.all("SELECT * FROM live_reports WHERE status = 'pending' ORDER BY created_at DESC");
  const recentTransactions = db.all('SELECT * FROM topup_transactions ORDER BY created_at DESC LIMIT 5');
  const tickets = db.all("SELECT * FROM support_tickets WHERE status = 'open' ORDER BY created_at DESC LIMIT 10");

  res.json({
    stats: {
      totalUsers: users.count,
      totalReports: reports.count,
      pendingVerification: pendingReports.length,
      openTickets: tickets.length
    },
    pendingReports,
    recentTransactions,
    tickets
  });
});

app.post('/api/admin/reports/:id/moderate', (req, res) => {
  const { status } = req.body;
  const allowed = ['verified', 'rejected', 'resolved', 'expired'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Status moderasi tidak valid' });
  }
  db.run('UPDATE live_reports SET status = ? WHERE id = ?', [status, req.params.id]);
  const updated = db.get('SELECT * FROM live_reports WHERE id = ?', [req.params.id]);
  if (!updated) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

  if (updated.user_id) {
    NotificationService.notify({
      userId: updated.user_id,
      type: 'moderation',
      title: `Laporan ${status} oleh moderator`,
      body: `"${updated.title}" telah ditinjau oleh tim moderasi NEXMAP.`,
      link: `report:${updated.id}`
    });
  }

  audit('admin.report_moderate', req.params.id, status, 'admin');
  broadcast('REPORT_UPDATED', updated);
  res.json({ success: true, report: updated });
});

app.post('/api/admin/tickets/:id/reply', (req, res) => {
  try {
    const ticket = SupportService.replyTicket(req.params.id, req.body.reply, req.body.status || 'answered');
    audit('admin.ticket_reply', req.params.id, null, 'admin');
    res.json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/audit-logs', (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  res.json(db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit]));
});

// -------------------------------------------------------------
// ADMIN ANALYTICS & CSV EXPORT
// -------------------------------------------------------------
app.get('/api/admin/analytics', (req, res) => {
  const byCategory = db.all(
    'SELECT category, COUNT(*) AS count FROM live_reports GROUP BY category ORDER BY count DESC'
  );
  const byStatus = db.all(
    'SELECT status, COUNT(*) AS count FROM live_reports GROUP BY status ORDER BY count DESC'
  );

  const last7Days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end = start + 24 * 3600 * 1000;
    const row = db.get(
      'SELECT COUNT(*) AS reports FROM live_reports WHERE created_at >= ? AND created_at < ?',
      [start, end]
    );
    last7Days.push({ date: d.toISOString().slice(0, 10), reports: row.reports });
  }

  const revenue = db.get(
    "SELECT COALESCE(SUM(amount_idr), 0) AS idr, COUNT(*) AS paid FROM topup_transactions WHERE payment_status = 'paid'"
  );
  const tripSummary = db.get(
    `SELECT COUNT(*) AS trips,
            COALESCE(SUM(CASE WHEN is_valid = 1 THEN distance_km ELSE 0 END), 0) AS km,
            COALESCE(SUM(CASE WHEN is_valid = 0 THEN 1 ELSE 0 END), 0) AS rejected
     FROM trips`
  );
  const topContributors = db.all(
    `SELECT u.username, u.total_reports, u.total_km, u.reputation_score
     FROM users u ORDER BY u.total_reports DESC, u.reputation_score DESC LIMIT 5`
  );

  res.json({
    reportsByCategory: byCategory,
    reportsByStatus: byStatus,
    reportsLast7Days: last7Days,
    revenueIdr: revenue.idr,
    paidTransactions: revenue.paid,
    trips: {
      total: tripSummary.trips,
      km: Math.round(tripSummary.km * 10) / 10,
      rejected: tripSummary.rejected
    },
    topContributors
  });
});

app.get('/api/admin/export/:type', (req, res) => {
  const type = req.params.type;
  const datasets = {
    reports: {
      filename: 'nexmap-reports.csv',
      rows: db.all('SELECT * FROM live_reports ORDER BY created_at DESC'),
      columns: ['id', 'author_name', 'category', 'title', 'road_name', 'status', 'confidence_score', 'confirmations', 'denials', 'lat', 'lon', 'created_at']
    },
    trips: {
      filename: 'nexmap-trips.csv',
      rows: db.all('SELECT * FROM trips ORDER BY created_at DESC'),
      columns: ['id', 'user_id', 'vehicle_type', 'distance_km', 'duration_mins', 'avg_speed_kmh', 'max_speed_kmh', 'earned_xp', 'is_valid', 'created_at']
    },
    transactions: {
      filename: 'nexmap-transactions.csv',
      rows: db.all('SELECT * FROM topup_transactions ORDER BY created_at DESC'),
      columns: ['order_id', 'user_id', 'amount_idr', 'gems_awarded', 'payment_method', 'payment_status', 'paid_at', 'created_at']
    },
    tickets: {
      filename: 'nexmap-tickets.csv',
      rows: db.all('SELECT * FROM support_tickets ORDER BY created_at DESC'),
      columns: ['id', 'user_id', 'category', 'subject', 'status', 'created_at', 'updated_at']
    }
  };

  const dataset = datasets[type];
  if (!dataset) return res.status(404).json({ error: 'Jenis ekspor tidak ditemukan' });

  const header = dataset.columns.join(',');
  const lines = dataset.rows.map(row =>
    dataset.columns.map(col => csvEscape(row[col])).join(',')
  );
  const csv = '\uFEFF' + [header, ...lines].join('\r\n');

  audit('admin.export', type, `${dataset.rows.length} rows`, 'admin');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${dataset.filename}"`);
  res.send(csv);
});

// -------------------------------------------------------------
// WEBSOCKET TELEMETRY
// -------------------------------------------------------------
wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.send(
    JSON.stringify({
      type: 'INIT_STATE',
      data: {
        vehicles: TrackingService.getLiveVehicles(),
        reports: db.all(
          "SELECT * FROM live_reports WHERE status IN ('pending','verified','active') AND expires_at > ?",
          [Date.now()]
        ),
        traffic: TrafficService.getSegments(),
        notifications: NotificationService.list(DEFAULT_USER_ID, { limit: 20 }),
        user: enrichUser(getUser())
      }
    })
  );
});

// Heartbeat: drop half-open connections so broadcasts do not leak
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  }
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

let trafficTickCount = 0;
setInterval(() => {
  const updatedVehicles = TrackingService.tick();
  broadcast('VEHICLES_TELEMETRY', updatedVehicles);

  trafficTickCount++;
  if (trafficTickCount % 2 === 0) {
    broadcast('TRAFFIC_TELEMETRY', TrafficService.tick());
  }
}, 2000);

// Expire stale reports every 60s
setInterval(() => {
  const expired = TrustEngine.sweepExpired();
  if (expired > 0) broadcast('REPORTS_EXPIRED', { count: expired });
}, 60 * 1000);

// -------------------------------------------------------------
// 404 + ERROR HANDLING
// -------------------------------------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan' });
});

app.use((err, req, res, next) => {
  console.error('[NEXMAP ERROR]', err);
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan internal server' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  TrafficService.seedSegments();
  console.log('====================================================');
  console.log(`🚀 NEXMAP Core Engine running at http://localhost:${PORT}`);
  console.log(`🛰️ WebSocket Telemetry Stream: ws://localhost:${PORT}/v1/stream`);
  console.log(`📱 Demo user: ${DEFAULT_USER_ID}`);
  console.log('====================================================');
});

module.exports = { app, server };
