const db = require('../../database/db');

const EMERGENCY_NUMBERS = [
  { name: 'Polisi (Polri)', number: '110', icon: '👮' },
  { name: 'Panggilan Darurat Terpadu', number: '112', icon: '🚨' },
  { name: 'Ambulans / Medis', number: '119', icon: '🚑' },
  { name: 'Pemadam Kebakaran', number: '113', icon: '🚒' },
  { name: 'SAR / Evakuasi Basarnas', number: '115', icon: '🚁' }
];

const SafetyService = {
  EMERGENCY_NUMBERS,

  /**
   * Trigger Emergency SOS and persist the session.
   */
  triggerSos({ userId, lat, lon, userNote = 'Butuh pertolongan darurat segera!' }) {
    const user = db.get('SELECT username, phone FROM users WHERE id = ?', [userId]) || {
      username: 'Pengguna NEXMAP',
      phone: '-'
    };

    const contacts = db.all(
      'SELECT name, phone, relationship FROM emergency_contacts WHERE user_id = ?',
      [userId]
    );

    const sessionId = `sos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const expiresAt = Date.now() + 2 * 3600 * 1000;
    const liveTrackingUrl = `https://nexmap.id/sos/live/${sessionId}`;
    const offlineSmsText = `[NEXMAP SOS DARURAT] ${user.username} membutuhkan bantuan di koordinat: https://maps.google.com/?q=${lat},${lon} Waktu: ${new Date().toLocaleTimeString('id-ID')}`;

    db.run(
      `INSERT INTO sos_sessions (id, user_id, lat, lon, user_note, live_tracking_url, offline_sms_text, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE_EMERGENCY', ?)`,
      [sessionId, userId, lat, lon, userNote, liveTrackingUrl, offlineSmsText, Date.now()]
    );

    return {
      sessionId,
      userId,
      username: user.username,
      lat,
      lon,
      userNote,
      liveTrackingUrl,
      offlineSmsText,
      expiresAt,
      dispatchedContacts: contacts,
      emergencyNumbers: EMERGENCY_NUMBERS,
      status: 'ACTIVE_EMERGENCY'
    };
  },

  /**
   * End an active SOS session (persisted).
   */
  resolveSos(sessionId) {
    const session = db.get('SELECT * FROM sos_sessions WHERE id = ?', [sessionId]);
    if (!session) return { success: false, message: 'Sesi tidak ditemukan' };

    db.run("UPDATE sos_sessions SET status = 'RESOLVED', resolved_at = ? WHERE id = ?", [
      Date.now(),
      sessionId
    ]);
    return { success: true, message: 'Sesi darurat telah diakhiri' };
  },

  getActiveSos(userId) {
    return db.all(
      "SELECT * FROM sos_sessions WHERE user_id = ? AND status = 'ACTIVE_EMERGENCY' ORDER BY created_at DESC",
      [userId]
    );
  },

  /**
   * Apply Privacy Fuzzy Masking (UU PDP No. 27/2022 Compliance).
   * Masks coordinates within the user's private home/work radius.
   */
  maskCoordinatesIfInPrivateZone(userId, lat, lon, homeLat = null, homeLon = null) {
    const user = db.get('SELECT privacy_mode, fuzzy_radius_meters, home_lat, home_lon FROM users WHERE id = ?', [userId]);
    if (!user) return { isHidden: true, lat: null, lon: null };

    if (user.privacy_mode === 'ghost') {
      return { isHidden: true, lat: null, lon: null };
    }

    const hLat = homeLat != null ? homeLat : user.home_lat;
    const hLon = homeLon != null ? homeLon : user.home_lon;

    if (hLat != null && hLon != null) {
      const distance = db.haversineDistanceMeters(lat, lon, hLat, hLon);
      const radius = user.fuzzy_radius_meters || 300;
      if (distance <= radius) {
        const jitterLat = (Math.random() - 0.5) * 0.005;
        const jitterLon = (Math.random() - 0.5) * 0.005;
        return {
          isMasked: true,
          fuzzyRadius: radius,
          lat: Number((lat + jitterLat).toFixed(4)),
          lon: Number((lon + jitterLon).toFixed(4))
        };
      }
    }

    return { isMasked: false, lat, lon };
  },

  /**
   * Update privacy configuration (privacy mode + fuzzy zone center).
   */
  updatePrivacy(userId, { privacyMode, fuzzyRadiusMeters, homeLat, homeLon }) {
    const valid = ['public', 'friends_only', 'ghost'];
    if (privacyMode && !valid.includes(privacyMode)) {
      throw new Error('Mode privasi tidak valid');
    }
    const radius = fuzzyRadiusMeters != null ? Math.max(0, Math.min(5000, Number(fuzzyRadiusMeters))) : 300;

    db.run(
      `UPDATE users
       SET privacy_mode = COALESCE(?, privacy_mode),
           fuzzy_radius_meters = ?,
           home_lat = COALESCE(?, home_lat),
           home_lon = COALESCE(?, home_lon)
       WHERE id = ?`,
      [privacyMode || null, radius, homeLat ?? null, homeLon ?? null, userId]
    );

    return db.get(
      'SELECT privacy_mode, fuzzy_radius_meters, home_lat, home_lon FROM users WHERE id = ?',
      [userId]
    );
  }
};

module.exports = SafetyService;
