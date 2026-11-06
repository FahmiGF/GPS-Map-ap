-- NEXMAP Relational & Geospatial Schema
-- SQLite & PostGIS Dual Compatible

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT,
    username TEXT UNIQUE NOT NULL,
    level INTEGER DEFAULT 1,
    current_xp INTEGER DEFAULT 0,
    reputation_score REAL DEFAULT 0.500,
    nex_coins INTEGER DEFAULT 250,
    nex_gems INTEGER DEFAULT 50,
    active_vehicle TEXT DEFAULT 'motorcycle',
    active_skin TEXT DEFAULT 'cyberpunk',
    active_title TEXT DEFAULT 'Novice Navigator',
    privacy_mode TEXT DEFAULT 'public',
    fuzzy_radius_meters INTEGER DEFAULT 300,
    home_lat REAL,
    home_lon REAL,
    active_vehicle_icon TEXT,
    city TEXT DEFAULT 'Jakarta',
    two_factor_enabled INTEGER DEFAULT 0,
    total_km REAL DEFAULT 0,
    total_reports INTEGER DEFAULT 0,
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS live_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    author_name TEXT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    road_name TEXT,
    status TEXT DEFAULT 'pending',
    confidence_score REAL DEFAULT 1.0,
    confirmations INTEGER DEFAULT 0,
    denials INTEGER DEFAULT 0,
    image_url TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS report_votes (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL,
    voter_lat REAL,
    voter_lon REAL,
    created_at INTEGER NOT NULL,
    UNIQUE(report_id, user_id)
);

CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    distance_km REAL NOT NULL,
    duration_mins INTEGER NOT NULL,
    avg_speed_kmh REAL,
    max_speed_kmh REAL,
    earned_xp INTEGER DEFAULT 0,
    is_valid INTEGER DEFAULT 1,
    anti_cheat_flags TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS store_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    currency_type TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    icon TEXT,
    preview_data TEXT,
    is_exclusive INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_inventory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    is_equipped INTEGER DEFAULT 0,
    purchased_at INTEGER NOT NULL,
    UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS topup_transactions (
    order_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount_idr INTEGER NOT NULL,
    gems_awarded INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    qris_payload TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    paid_at INTEGER
);

CREATE TABLE IF NOT EXISTS civic_announcements (
    id TEXT PRIMARY KEY,
    source_agency TEXT NOT NULL,
    category TEXT NOT NULL,
    headline TEXT NOT NULL,
    details TEXT NOT NULL,
    affected_area TEXT,
    lat REAL,
    lon REAL,
    radius_km REAL,
    severity TEXT DEFAULT 'info',
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    goal_type TEXT NOT NULL,
    target_count INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    reward_coins INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_mission_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    current_count INTEGER DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    is_claimed INTEGER DEFAULT 0,
    UNIQUE(user_id, mission_id)
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT,
    created_at INTEGER
);
