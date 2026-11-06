/**
 * Idempotent schema migrations for existing NEXMAP databases.
 * Receives the db wrapper to avoid a circular require.
 */
function runMigrations(db) {
  const columnExists = (table, column) =>
    db.all(`PRAGMA table_info(${table})`).some(c => c.name === column);

  const addColumnIfMissing = (table, column, definition) => {
    if (!columnExists(table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  // ---------- Existing table fixes ----------
  addColumnIfMissing('store_items', 'is_active', 'INTEGER DEFAULT 1');
  addColumnIfMissing('users', 'home_lat', 'REAL');
  addColumnIfMissing('users', 'home_lon', 'REAL');
  addColumnIfMissing('users', 'two_factor_enabled', 'INTEGER DEFAULT 0');
  addColumnIfMissing('users', 'active_vehicle_icon', 'TEXT');
  addColumnIfMissing('users', 'city', "TEXT DEFAULT 'Jakarta'");
  addColumnIfMissing('emergency_contacts', 'created_at', 'INTEGER');

  // ---------- New tables ----------
  db.exec(`
    CREATE TABLE IF NOT EXISTS xp_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT,
      metric TEXT NOT NULL,
      threshold REAL NOT NULL,
      reward_coins INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL,
      UNIQUE(user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS sos_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lat REAL,
      lon REAL,
      user_note TEXT,
      live_tracking_url TEXT,
      offline_sms_text TEXT,
      status TEXT DEFAULT 'ACTIVE_EMERGENCY',
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      status TEXT DEFAULT 'open',
      admin_reply TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      details TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS traffic_news (
      id TEXT PRIMARY KEY,
      headline TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      source TEXT,
      lat REAL,
      lon REAL,
      radius_km REAL DEFAULT 10,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS traffic_segments (
      id TEXT PRIMARY KEY,
      road_name TEXT NOT NULL,
      start_lat REAL NOT NULL,
      start_lon REAL NOT NULL,
      end_lat REAL NOT NULL,
      end_lon REAL NOT NULL,
      speed_kmh REAL NOT NULL,
      free_flow_kmh REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_places (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      address TEXT,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      icon TEXT DEFAULT '📍',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_comments (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'visible',
      created_at INTEGER NOT NULL
    );
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events(user_id, created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_reports_expires ON live_reports(expires_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_saved_places_user ON saved_places(user_id, created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_report_comments_report ON report_comments(report_id, created_at)');
}

module.exports = runMigrations;
