const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = process.env.NEXMAP_DB_PATH || path.join(__dirname, 'nexmap.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schema
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSql);

/**
 * Calculates great-circle distance between two coordinates in meters (Haversine formula).
 */
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const dbWrapper = {
  raw: db,

  run(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  },

  get(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  },

  all(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },

  exec(sql) {
    return db.exec(sql);
  },

  haversineDistanceMeters,

  /**
   * Filter entities within a radius from center point
   */
  findWithinRadius(items, centerLat, centerLon, radiusMeters, latKey = 'lat', lonKey = 'lon') {
    return items.filter(item => {
      const d = haversineDistanceMeters(centerLat, centerLon, item[latKey], item[lonKey]);
      return d <= radiusMeters;
    });
  }
};

// Run idempotent migrations (safe on existing databases)
require('./migrations')(dbWrapper);

module.exports = dbWrapper;
