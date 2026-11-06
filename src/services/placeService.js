const db = require('../../database/db');

const MAX_PLACES = 20;

/**
 * Saved places (Home, Office, favourite destinations).
 * Capped per user to avoid unbounded data growth.
 */
const PlaceService = {
  list(userId) {
    return db.all(
      'SELECT * FROM saved_places WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  },

  create(userId, { label, address = null, lat, lon, icon = '📍' }) {
    if (!label || String(label).trim().length < 2) {
      throw new Error('Nama tempat minimal 2 karakter');
    }
    const fLat = parseFloat(lat);
    const fLon = parseFloat(lon);
    if (!Number.isFinite(fLat) || !Number.isFinite(fLon) || Math.abs(fLat) > 90 || Math.abs(fLon) > 180) {
      throw new Error('Koordinat tempat tidak valid');
    }

    const count = db.get('SELECT COUNT(*) AS c FROM saved_places WHERE user_id = ?', [userId]).c;
    if (count >= MAX_PLACES) {
      throw new Error(`Maksimal ${MAX_PLACES} tempat tersimpan. Hapus salah satu terlebih dahulu.`);
    }

    const duplicate = db.get(
      'SELECT id FROM saved_places WHERE user_id = ? AND label = ?',
      [userId, String(label).trim()]
    );
    if (duplicate) throw new Error('Tempat dengan nama tersebut sudah tersimpan');

    const id = `place-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    db.run(
      `INSERT INTO saved_places (id, user_id, label, address, lat, lon, icon, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, String(label).trim(), address, fLat, fLon, icon, now]
    );
    return db.get('SELECT * FROM saved_places WHERE id = ?', [id]);
  },

  update(userId, placeId, { label, address, lat, lon, icon } = {}) {
    const place = db.get('SELECT * FROM saved_places WHERE id = ? AND user_id = ?', [placeId, userId]);
    if (!place) throw new Error('Tempat tidak ditemukan');

    const nextLabel = label != null ? String(label).trim() : place.label;
    if (nextLabel.length < 2) throw new Error('Nama tempat minimal 2 karakter');

    if (label != null) {
      const duplicate = db.get(
        'SELECT id FROM saved_places WHERE user_id = ? AND label = ? AND id != ?',
        [userId, nextLabel, placeId]
      );
      if (duplicate) throw new Error('Tempat dengan nama tersebut sudah tersimpan');
    }

    const fLat = lat != null ? parseFloat(lat) : place.lat;
    const fLon = lon != null ? parseFloat(lon) : place.lon;
    if (!Number.isFinite(fLat) || !Number.isFinite(fLon) || Math.abs(fLat) > 90 || Math.abs(fLon) > 180) {
      throw new Error('Koordinat tempat tidak valid');
    }

    db.run(
      `UPDATE saved_places
       SET label = ?, address = ?, lat = ?, lon = ?, icon = ?
       WHERE id = ? AND user_id = ?`,
      [nextLabel, address != null ? address : place.address, fLat, fLon, icon || place.icon, placeId, userId]
    );
    return db.get('SELECT * FROM saved_places WHERE id = ?', [placeId]);
  },

  remove(userId, placeId) {
    const place = db.get('SELECT id FROM saved_places WHERE id = ? AND user_id = ?', [placeId, userId]);
    if (!place) throw new Error('Tempat tidak ditemukan');
    db.run('DELETE FROM saved_places WHERE id = ? AND user_id = ?', [placeId, userId]);
    return { success: true, placeId };
  }
};

module.exports = PlaceService;
