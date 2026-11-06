// =============================================================
// NEXMAP Client Application v1.2
// =============================================================
'use strict';

// ---------- STATE ----------
let map = null;
let ws = null;

const vehicleMarkers = new Map();
const reportMarkers = new Map();
const newsMarkers = new Map();
const trafficLayers = new Map();

let currentRouteGroup = null;
let activeTileLayer = null;

let currentUser = null;
let currentActiveSkin = 'cyberpunk';
let pendingEvidenceDataUrl = null;

const DEMO_LAT = -6.2088;
const DEMO_LON = 106.8229;

const currentNavigationCoords = {
  fromLat: -6.1754,
  fromLon: 106.8272,
  toLat: -6.2185,
  toLon: 106.8025
};

const layerState = { vehicles: true, reports: true, traffic: true, news: false };

let newsCache = [];
let currentNewsFilter = 'all';
let helpState = { category: 'all', q: '' };
let activeProfileId = 'usr-demo-001';

const CATEGORY_ICONS = {
  accident: '🚨',
  flood: '🌊',
  traffic_jam: '🚗',
  road_damage: '🕳️',
  road_closure: '⛔',
  construction: '🚧',
  broken_traffic_light: '🚦',
  vehicle_breakdown: '🔧',
  fallen_tree: '🌳',
  weather_hazard: '🌧️',
  other: '⚠️'
};

const MAP_SKIN_TILES = {
  cyberpunk: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
  },
  dark_gold: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
  },
  synthwave: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
  }
};

let mapTileConfig = {
  url: MAP_SKIN_TILES.cyberpunk.url,
  attribution: MAP_SKIN_TILES.cyberpunk.attribution
};

async function loadMapConfig() {
  try {
    const cfg = await api('/api/config');
    if (cfg && typeof cfg.tileUrl === 'string' && /^https:\/\//.test(cfg.tileUrl)) {
      mapTileConfig.url = cfg.tileUrl;
      mapTileConfig.attribution = cfg.usesOpenStreetMap
        ? '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        : '&copy; Peta oleh penyedia tile terkonfigurasi';
    }
  } catch (_) {
    /* keep OpenStreetMap default when config is unavailable */
  }
}

// ---------- UTILITIES ----------
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error((data && data.error) || `HTTP ${res.status}`);
  }
  return data;
}

function postJson(path, body) {
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function showGlobalAlert(message, type = 'info') {
  const div = document.createElement('div');
  const bg = type === 'danger' ? 'rgba(239,68,68,0.96)' : type === 'success' ? 'rgba(34,197,94,0.96)' : 'rgba(14,165,233,0.96)';
  div.style.cssText = `position:fixed;top:74px;right:20px;z-index:9999;background:${bg};color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.5);max-width:420px`;
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4800);
}

function openModal(id) {
  closeAllModals();
  const el = document.getElementById(id);
  if (el) el.classList.add('open');

  if (id === 'gamification-modal') {
    loadLeaderboard();
    loadMissions();
    loadAchievements();
  } else if (id === 'store-modal') {
    loadStoreItems('all');
  } else if (id === 'news-modal') {
    loadNewsFeed();
  } else if (id === 'profile-modal') {
    loadProfileDetail(activeProfileId);
  } else if (id === 'help-modal') {
    loadHelpCenter();
    loadMyTickets();
  } else if (id === 'admin-modal') {
    loadAdminOverview();
    loadAdminAnalytics();
  } else if (id === 'safety-modal') {
    loadActiveSos();
    loadEmergencyContacts();
  } else if (id === 'notifications-modal') {
    loadNotifications();
  } else if (id === 'trips-modal') {
    loadTrips();
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

// =============================================================
// MAP
// =============================================================
function initMap() {
  map = L.map('map-container', { zoomControl: false, attributionControl: false }).setView([DEMO_LAT, DEMO_LON], 13);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
  setMapSkin(currentActiveSkin);
}

function setMapSkin(skinKey) {
  if (!map) return;
  if (activeTileLayer) map.removeLayer(activeTileLayer);
  const key = MAP_SKIN_TILES[skinKey] ? skinKey : 'cyberpunk';
  const skin = MAP_SKIN_TILES[key];
  const tileUrl = mapTileConfig.url || skin.url;
  const options = {
    maxZoom: 19,
    attribution: mapTileConfig.attribution || skin.attribution
  };
  // Only pass subdomains when the URL actually uses the {s} placeholder
  if (tileUrl.includes('{s}')) options.subdomains = 'abc';

  activeTileLayer = L.tileLayer(tileUrl, options).addTo(map);

  const container = document.getElementById('map-container');
  container.classList.remove('map-skin-cyberpunk', 'map-skin-dark_gold', 'map-skin-synthwave');
  container.classList.add(`map-skin-${key}`);
  currentActiveSkin = key;
}

// =============================================================
// WEBSOCKET
// =============================================================
function initWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/v1/stream`);
  const badge = document.getElementById('ws-status-badge');

  ws.onopen = () => {
    badge.textContent = '🛰️ ONLINE';
    badge.style.borderColor = 'var(--accent-green)';
    badge.style.color = 'var(--accent-green)';
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    switch (msg.type) {
      case 'INIT_STATE':
        updateVehiclePositions(msg.data.vehicles || []);
        (msg.data.reports || []).forEach(renderReportMarker);
        renderReportsQuickFeed(msg.data.reports || []);
        if (msg.data.traffic) renderTrafficSegments(msg.data.traffic);
        if (msg.data.user) applyUserProfile(msg.data.user);
        break;
      case 'VEHICLES_TELEMETRY':
        updateVehiclePositions(msg.data);
        break;
      case 'TRAFFIC_TELEMETRY':
        renderTrafficSegments(msg.data);
        break;
      case 'NEW_REPORT':
      case 'REPORT_UPDATED':
        renderReportMarker(msg.data);
        loadReportsFeed();
        break;
      case 'REPORTS_EXPIRED':
        loadReportsFeed();
        break;
      case 'USER_UPDATED':
        applyUserProfile(msg.data);
        break;
      case 'SOS_ALERT':
        showGlobalAlert(`🚨 SOS DARURAT: ${msg.data.username} butuh bantuan di (${msg.data.lat}, ${msg.data.lon})`, 'danger');
        break;
      case 'CIVIC_ANNOUNCEMENT':
        showGlobalAlert(`📢 ${msg.data.sourceAgency}: ${msg.data.headline}`, 'info');
        loadQuickNews();
        break;
      case 'TRAFFIC_NEWS':
        showGlobalAlert(`📰 ${msg.data.headline}`, 'info');
        loadQuickNews();
        break;
      case 'NOTIFICATION':
        handleIncomingNotification(msg.data);
        break;
      case 'REPORT_COMMENT':
        handleIncomingComment(msg.data);
        break;
      default:
        break;
    }
  };

  ws.onclose = () => {
    badge.textContent = '⚠️ RECONNECTING';
    badge.style.borderColor = 'var(--accent-orange)';
    badge.style.color = 'var(--accent-orange)';
    setTimeout(initWebSocket, 3000);
  };
}

// =============================================================
// VEHICLES & TRAFFIC
// =============================================================
function updateVehiclePositions(vehicles) {
  for (const v of vehicles) {
    if (vehicleMarkers.has(v.id)) {
      const marker = vehicleMarkers.get(v.id);
      marker.setLatLng([v.lat, v.lon]);
      marker.setPopupContent(vehiclePopup(v));
      marker.setOpacity(layerState.vehicles ? 1 : 0);
    } else {
      const icon = L.divIcon({
        className: 'vehicle-pulse-icon',
        html: `<div>${esc(v.icon)}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const marker = L.marker([v.lat, v.lon], { icon }).addTo(map).bindPopup(vehiclePopup(v));
      marker.setOpacity(layerState.vehicles ? 1 : 0);
      vehicleMarkers.set(v.id, marker);
    }
  }
}

function vehiclePopup(v) {
  return `
    <div style="font-size:12px;line-height:1.5;">
      <b style="color:var(--accent-cyan);font-size:13px;">${esc(v.icon)} ${esc(v.name)}</b><br>
      Kecepatan: <b>${esc(v.speedKmh)} km/h</b> | Arah: <b>${esc(v.heading)}°</b><br>
      Status: <span style="color:var(--accent-green);">${esc(v.status)}</span>
      ${v.privacyMasked ? '<br><span style="font-size:10px;color:var(--accent-gold);">🔒 Zona privasi — lokasi disamarkan</span>' : ''}
    </div>`;
}

function renderTrafficSegments(segments) {
  for (const layer of trafficLayers.values()) map.removeLayer(layer);
  trafficLayers.clear();

  for (const s of segments) {
    const line = L.polyline([s.start, s.end], {
      color: s.color,
      weight: 8,
      opacity: 0.85,
      lineCap: 'round'
    }).addTo(map);
    line.bindTooltip(`${esc(s.roadName)} • ${esc(s.speedKmh)} km/h • ${esc(s.label)}`, { sticky: true });
    if (!layerState.traffic) line.setStyle({ opacity: 0 });
    trafficLayers.set(s.id, line);
  }
}

function updateAci(summary) {
  document.getElementById('aci-speed').textContent = `${summary.avgSpeed} km/h`;
  const aciEl = document.getElementById('aci-val');
  aciEl.textContent = `${summary.avgAci.toFixed(2)} ${summary.label}`;
  aciEl.style.color = summary.color;
  document.getElementById('aci-note').textContent = `${summary.segments} segmen jalan dipantau • diperbarui otomatis`;
}

// =============================================================
// REPORTS
// =============================================================
async function loadReportsFeed() {
  try {
    const reports = await api('/api/reports/active');
    reports.forEach(renderReportMarker);
    renderReportsQuickFeed(reports);
  } catch (err) {
    console.error('loadReportsFeed', err);
  }
}

function renderReportMarker(report) {
  if (reportMarkers.has(report.id)) {
    map.removeLayer(reportMarkers.get(report.id));
    reportMarkers.delete(report.id);
  }
  if (report.status === 'expired' || report.status === 'rejected' || report.status === 'resolved') return;

  const emoji = CATEGORY_ICONS[report.category] || '⚠️';
  const icon = L.divIcon({
    className: 'report-marker-icon',
    html: `<div>${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  const marker = L.marker([report.lat, report.lon], { icon }).addTo(map);
  marker.bindPopup(reportPopup(report));
  if (!layerState.reports) marker.setOpacity(0);
  reportMarkers.set(report.id, marker);
}

function reportPopup(r) {
  const statusColor = r.status === 'verified' ? 'var(--accent-green)' : 'var(--accent-gold)';
  const img = r.image_url
    ? `<img src="${esc(r.image_url)}" alt="bukti" style="width:100%;max-height:110px;object-fit:cover;border-radius:6px;margin:6px 0;" />`
    : '';
  return `
    <div style="min-width:220px;line-height:1.5;">
      <div style="font-size:10px;text-transform:uppercase;color:${statusColor};font-weight:800;">
        ${r.status === 'verified' ? '✓ TERVERIFIKASI KOMUNITAS' : '• MENUNGGU KONFIRMASI'}
      </div>
      <b style="font-size:14px;color:#fff;">${esc(CATEGORY_ICONS[r.category] || '⚠️')} ${esc(r.title)}</b>
      <div style="font-size:11px;color:var(--text-muted);margin:2px 0;">${esc(r.road_name)} • ${esc(timeAgo(r.created_at))}</div>
      ${img}
      <p style="font-size:12px;color:var(--text-secondary);margin:6px 0;">${esc(r.description)}</p>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:8px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;">
        <span>Konfirmasi: <b style="color:var(--accent-green);">${esc(r.confirmations)}</b></span>
        <span>Skor: <b style="color:var(--accent-cyan);">${esc(r.confidence_score)}</b></span>
      </div>
      <button onclick="openVoteModal('${esc(r.id)}')" style="width:100%;margin-top:8px;background:var(--accent-cyan);border:none;color:#000;font-weight:700;padding:6px;border-radius:6px;cursor:pointer;">
        🔍 Validasi Kejadian (+5 XP)
      </button>
    </div>`;
}

function renderReportsQuickFeed(reports) {
  const container = document.getElementById('quick-reports-feed');
  document.getElementById('reports-count-badge').textContent = `${reports.length} Aktif`;

  if (!reports.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">Belum ada laporan aktif di sekitar Anda.</div>';
    return;
  }

  container.innerHTML = reports.map(r => `
    <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);padding:8px 10px;border-radius:6px;cursor:pointer;"
         onclick="panToReport(${r.lat}, ${r.lon})">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;gap:6px;">
        <span style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(CATEGORY_ICONS[r.category] || '⚠️')} ${esc(r.title)}</span>
        <span style="font-size:9px;padding:1px 4px;border-radius:4px;flex-shrink:0;background:${r.status === 'verified' ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.2)'};color:${r.status === 'verified' ? 'var(--accent-green)' : 'var(--accent-gold)'};">
          ${esc(r.status)}
        </span>
      </div>
      <div style="font-size:10px;color:var(--text-muted);">${esc(r.road_name)} • ${esc(timeAgo(r.created_at))}</div>
    </div>`).join('');
}

window.panToReport = (lat, lon) => map.setView([lat, lon], 16, { animate: true });

window.openVoteModal = async (reportId) => {
  try {
    const r = await api(`/api/reports/${reportId}`);
    const content = document.getElementById('vote-modal-content');
    content.innerHTML = `
      <div style="line-height:1.5;">
        <h3 style="color:#fff;font-size:16px;">${esc(CATEGORY_ICONS[r.category] || '⚠️')} ${esc(r.title)}</h3>
        <div style="font-size:11px;color:var(--text-muted);margin:4px 0 12px 0;">📍 ${esc(r.road_name)} • ${esc(timeAgo(r.created_at))}</div>
        ${r.image_url ? `<img src="${esc(r.image_url)}" alt="bukti" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-bottom:10px;" />` : ''}
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">"${esc(r.description)}"</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;font-size:11px;">
          <span class="chip verified">Konfirmasi ${esc(r.confirmations)}</span>
          <span class="chip warning">Sanggahan ${esc(r.denials)}</span>
          <span class="chip info">Skor ${esc(r.confidence_score)}</span>
        </div>
        <div style="display:flex;gap:8px;flex-direction:column;">
          <button onclick="submitVote('${esc(r.id)}','still_happening')" class="action-btn-primary" style="justify-content:center;background:linear-gradient(135deg,#10b981,#059669);">✓ Masih Terjadi (+5 XP)</button>
          <button onclick="submitVote('${esc(r.id)}','resolved')" class="action-btn-primary" style="justify-content:center;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);">• Sudah Selesai / Lancar</button>
          <button onclick="submitVote('${esc(r.id)}','fake')" class="action-btn-danger" style="justify-content:center;">✗ Laporan Palsu / Hoaks</button>
        </div>
        <div id="report-comments-${esc(r.id)}" class="report-comments"></div>
      </div>`;
    openModal('vote-modal');
    loadReportComments(r.id);
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

window.submitVote = async (reportId, voteType) => {
  try {
    await postJson(`/api/reports/${reportId}/vote`, {
      voteType,
      voterLat: DEMO_LAT,
      voterLon: DEMO_LON
    });
    showGlobalAlert('Suara verifikasi tercatat! (+5 XP)', 'success');
    closeAllModals();
    await loadUserProfile();
    loadReportsFeed();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

// =============================================================
// NAVIGATION
// =============================================================
async function loadNavigationRoute() {
  try {
    const { fromLat, fromLon, toLat, toLon } = currentNavigationCoords;
    const data = await api(`/api/navigation/route?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}`);

    document.getElementById('nav-dist').textContent = `${data.distanceKm} km`;
    document.getElementById('nav-eta').textContent = `${data.etaMins} mnt`;
    document.getElementById('nav-status').textContent = data.congestionLabel;

    if (currentRouteGroup) map.removeLayer(currentRouteGroup);
    currentRouteGroup = L.featureGroup();
    for (const seg of data.segments) {
      L.polyline([seg.from, seg.to], { color: seg.color, weight: 6, opacity: 0.9, lineCap: 'round' }).addTo(currentRouteGroup);
    }
    L.marker([fromLat, fromLon], {
      icon: L.divIcon({ className: '', html: '<div style="font-size:20px;">📍</div>', iconSize: [20, 20] })
    }).addTo(currentRouteGroup);
    L.marker([toLat, toLon], {
      icon: L.divIcon({ className: '', html: '<div style="font-size:20px;">🏁</div>', iconSize: [20, 20] })
    }).addTo(currentRouteGroup);
    currentRouteGroup.addTo(map);
  } catch (err) {
    console.error('loadNavigationRoute', err);
  }
}

// =============================================================
// USER PROFILE / HUD
// =============================================================
async function loadUserProfile() {
  try {
    applyUserProfile(await api('/api/user/profile'));
  } catch (err) {
    console.error('loadUserProfile', err);
  }
}

function applyUserProfile(user) {
  if (!user) return;
  currentUser = user;

  document.getElementById('hud-username').textContent = user.username || 'Pengguna';
  document.getElementById('hud-level').textContent = `LV.${user.level}`;
  document.getElementById('hud-coins').textContent = Number(user.nex_coins || 0).toLocaleString('id-ID');
  document.getElementById('hud-gems').textContent = Number(user.nex_gems || 0).toLocaleString('id-ID');
  document.getElementById('hud-title').textContent = user.active_title || 'Novice';
  document.getElementById('hud-xp-fill').style.width = `${user.progressPercent || 0}%`;
  document.getElementById('hud-avatar-icon').textContent = user.active_vehicle_icon || '🏍️';

  if (typeof user.unreadNotifications === 'number') updateNotifBadge(user.unreadNotifications);

  if (user.active_skin) setMapSkin(user.active_skin);

  // Keep privacy form in sync
  const pm = document.getElementById('privacy-mode-select');
  if (pm && user.privacy_mode) pm.value = user.privacy_mode;
  const pr = document.getElementById('privacy-radius');
  if (pr && user.fuzzy_radius_meters != null) pr.value = user.fuzzy_radius_meters;
  const phLat = document.getElementById('privacy-home-lat');
  if (phLat && user.home_lat != null) phLat.value = user.home_lat;
  const phLon = document.getElementById('privacy-home-lon');
  if (phLon && user.home_lon != null) phLon.value = user.home_lon;
}

// =============================================================
// NEWS
// =============================================================
async function loadQuickNews() {
  try {
    const news = await api(`/api/news?lat=${DEMO_LAT}&lon=${DEMO_LON}&limit=8`);
    newsCache = news;
    const container = document.getElementById('quick-news-feed');
    const top = news.slice(0, 3);
    container.innerHTML = top.length
      ? top.map(n => `
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);padding:8px 10px;border-radius:6px;cursor:pointer;"
             onclick="openModal('news-modal')">
          <div style="font-size:11px;font-weight:700;">${esc(n.headline)}</div>
          <div style="font-size:9.5px;color:var(--text-muted);margin-top:2px;">${esc(n.source)} • ${esc(timeAgo(n.createdAt))}</div>
        </div>`).join('')
      : '<div style="font-size:11px;color:var(--text-muted);">Belum ada berita.</div>';
  } catch (err) {
    console.error('loadQuickNews', err);
  }
}

async function loadNewsFeed() {
  try {
    newsCache = await api(`/api/news?lat=${DEMO_LAT}&lon=${DEMO_LON}&limit=30`);
    renderNewsFeed();
    renderNewsMarkers();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

function renderNewsFeed() {
  const container = document.getElementById('news-list-container');
  const filtered = currentNewsFilter === 'all' ? newsCache : newsCache.filter(n => n.kind === currentNewsFilter);

  if (!filtered.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Tidak ada berita untuk filter ini.</div>';
    return;
  }

  container.innerHTML = filtered.map(n => `
    <div class="news-item sev-${esc(n.severity)}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div class="news-headline">${esc(n.headline)}</div>
        <span class="chip ${n.kind === 'community' ? 'community' : n.verified ? 'verified' : 'info'}">${esc(n.kind === 'community' ? 'Komunitas' : n.kind === 'official' ? 'Resmi' : 'Berita')}</span>
      </div>
      <div class="news-body">${esc(n.body)}</div>
      <div class="news-meta">
        <span>🏛️ ${esc(n.source)}</span>
        <span>🕒 ${esc(timeAgo(n.createdAt))}</span>
        ${n.distanceKm != null ? `<span>📍 ${esc(n.distanceKm)} km dari Anda</span>` : ''}
        ${n.relevant ? '<span class="chip warning">Relevan</span>' : ''}
        <span class="chip ${esc(n.severity)}">${esc(n.severity)}</span>
      </div>
    </div>`).join('');
}

function renderNewsMarkers() {
  for (const m of newsMarkers.values()) map.removeLayer(m);
  newsMarkers.clear();

  for (const n of newsCache) {
    if (n.lat == null || n.lon == null) continue;
    const color = n.severity === 'emergency' ? '#ef4444' : n.severity === 'warning' ? '#eab308' : '#38bdf8';
    const marker = L.circleMarker([n.lat, n.lon], {
      radius: 9,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.35
    }).addTo(map);
    marker.bindPopup(`<div style="font-size:12px;line-height:1.5;"><b>${esc(n.headline)}</b><br><span style="color:var(--text-muted);font-size:11px;">${esc(n.source)}</span></div>`);
    if (!layerState.news) marker.setStyle({ opacity: 0, fillOpacity: 0 });
    newsMarkers.set(n.id, marker);
  }
}

// =============================================================
// LEADERBOARD / MISSIONS / ACHIEVEMENTS
// =============================================================
async function loadLeaderboard() {
  try {
    const category = document.getElementById('lb-category').value;
    const period = document.getElementById('lb-period').value;
    const scope = document.getElementById('lb-scope').value;
    const data = await api(`/api/gamification/leaderboard?category=${category}&period=${period}&scope=${scope}`);

    const unit = {
      explorer: 'km',
      reporter: 'laporan',
      navigator: 'trip',
      safety: 'verifikasi',
      city_explorer: 'ruas',
      contributor: '% reputasi'
    }[category] || 'XP';

    document.getElementById('leaderboard-container').innerHTML = data.length
      ? data.map(u => `
        <div class="leaderboard-row ${u.rank === 1 ? 'top-1' : ''}">
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="loadProfileDetail('${esc(u.id)}');openModal('profile-modal');">
            <span class="rank-number">${u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : '#' + u.rank}</span>
            <div>
              <b style="color:#fff;font-size:13px;">${esc(u.username)}</b>
              <div style="font-size:10px;color:var(--accent-cyan);">${esc(u.active_title || 'Novice')} • ${esc(u.tier.badge)}</div>
            </div>
          </div>
          <div style="font-size:14px;font-weight:800;color:var(--accent-gold);">${esc(u.metric)} ${esc(unit)}</div>
        </div>`).join('')
      : '<div style="font-size:12px;color:var(--text-muted);">Belum ada data pada periode ini.</div>';
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

async function loadMissions() {
  try {
    const missions = await api('/api/gamification/missions');
    document.getElementById('missions-container').innerHTML = missions.map(m => `
      <div class="mission-row ${m.isCompleted ? 'done' : ''}">
        <div>
          <b style="font-size:13px;color:#fff;">${esc(m.title)}</b>
          <div style="font-size:11px;color:var(--text-muted);">${esc(m.type.toUpperCase())} • ${esc(m.currentCount)} / ${esc(m.targetCount)}</div>
          <div class="mini-progress"><div style="width:${m.progressPercent}%"></div></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;font-weight:700;color:var(--accent-cyan);">+${esc(m.rewardXp)} XP</span>
          ${m.isClaimed
            ? '<span class="chip verified">Diklaim</span>'
            : m.isCompleted
            ? `<button class="btn-mini green" onclick="claimMission('${esc(m.id)}')">Klaim</button>`
            : '<span class="chip info">Berjalan</span>'}
        </div>
      </div>`).join('');
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

window.claimMission = async (missionId) => {
  try {
    const r = await postJson(`/api/gamification/missions/${missionId}/claim`, {});
    showGlobalAlert(`Misi selesai! +${r.rewardXp} XP, +${r.rewardCoins} NEX Coins`, 'success');
    await loadUserProfile();
    loadMissions();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

async function loadAchievements() {
  try {
    const achievements = await api('/api/gamification/achievements');
    document.getElementById('achievements-container').innerHTML = achievements.map(a => `
      <div class="ach-row ${a.unlocked ? '' : 'locked'}">
        <div style="display:flex;gap:10px;align-items:center;">
          <div style="font-size:24px;">${esc(a.icon)}</div>
          <div>
            <b style="font-size:13px;color:#fff;">${esc(a.name)}</b>
            <div style="font-size:11px;color:var(--text-muted);">${esc(a.description)}</div>
            <div class="mini-progress"><div style="width:${a.progress}%"></div></div>
          </div>
        </div>
        <span class="chip ${a.unlocked ? 'verified' : 'info'}">${a.unlocked ? 'Terbuka' : `${esc(a.currentValue)}/${esc(a.threshold)}`}</span>
      </div>`).join('');
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

// =============================================================
// STORE & TOP-UP
// =============================================================
async function loadStoreItems(category = 'all') {
  try {
    const data = await api('/api/store/items');
    const items = category === 'all' ? data.items : data.items.filter(i => i.category === category);

    document.getElementById('store-items-grid').innerHTML = items.length ? items.map(item => {
      const owned = data.inventory.some(inv => inv.item_id === item.id);
      const equipped = data.inventory.some(inv => inv.item_id === item.id && inv.is_equipped === 1);
      return `
        <div class="store-card">
          <div class="store-card-icon">${esc(item.icon)}</div>
          <div class="store-card-title">${esc(item.name)}</div>
          <div class="store-card-desc">${esc(item.description)}</div>
          <div class="store-card-footer">
            <span class="price-tag" style="color:${item.currency_type === 'coins' ? 'var(--accent-gold)' : 'var(--accent-cyan)'};">
              ${item.currency_type === 'coins' ? '🪙' : '💎'} ${esc(item.price)}
            </span>
            ${equipped
              ? '<span class="chip verified">Terpasang</span>'
              : owned
              ? `<button class="btn-mini" onclick="equipStoreItem('${esc(item.id)}')">Pasang</button>`
              : `<button class="btn-mini green" onclick="buyStoreItem('${esc(item.id)}')">Beli</button>`}
          </div>
        </div>`;
    }).join('') : '<div style="font-size:12px;color:var(--text-muted);">Kategori ini belum memiliki item.</div>';
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

window.buyStoreItem = async (itemId) => {
  try {
    const r = await postJson('/api/store/buy', { itemId });
    showGlobalAlert(`Berhasil membeli "${r.purchasedItem.name}"`, 'success');
    await loadUserProfile();
    loadStoreItems(document.querySelector('[data-store-cat].active')?.dataset.storeCat || 'all');
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

window.equipStoreItem = async (itemId) => {
  try {
    const r = await postJson('/api/store/equip', { itemId });
    showGlobalAlert(`"${r.equippedItem.name}" dipasang!`, 'success');
    await loadUserProfile();
    loadStoreItems(document.querySelector('[data-store-cat].active')?.dataset.storeCat || 'all');
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

async function openTopupModal() {
  try {
    const data = await api('/api/store/items');
    const container = document.getElementById('topup-packages-list');
    container.innerHTML = data.packages.map(pkg => `
      <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);padding:12px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <b style="font-size:14px;color:#fff;">${esc(pkg.name)}</b>
          <div style="font-size:12px;color:var(--accent-cyan);font-weight:700;">💎 ${esc(pkg.gems)} Gems <span style="font-size:10px;color:var(--accent-green);">${esc(pkg.bonus)}</span></div>
        </div>
        <button class="btn-mini green" onclick="initiateTopup('${esc(pkg.id)}')">Rp${pkg.priceIdr.toLocaleString('id-ID')}</button>
      </div>`).join('');
    openModal('topup-modal');
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

window.initiateTopup = async (packageId) => {
  try {
    const data = await postJson('/api/store/topup/initiate', { packageId, paymentMethod: 'qris' });
    document.getElementById('topup-body').innerHTML = `
      <div style="text-align:center;line-height:1.5;">
        <h4 style="color:var(--accent-cyan);margin-bottom:8px;">Pembayaran QRIS</h4>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Order ID: <b>${esc(data.orderId)}</b></div>
        <div style="background:#fff;padding:16px;border-radius:12px;display:inline-block;margin-bottom:12px;">
          <div style="width:160px;height:160px;background:repeating-linear-gradient(45deg,#000,#000 10px,#fff 10px,#fff 20px);border-radius:6px;"></div>
        </div>
        <div style="font-size:18px;font-weight:900;color:#fff;margin-bottom:16px;">Rp${data.amountIdr.toLocaleString('id-ID')}</div>
        <button class="action-btn-primary" style="justify-content:center;width:100%;" onclick="simulatePaymentSuccess('${esc(data.orderId)}')">
          ✓ Simulasikan Pembayaran Sukses
        </button>
      </div>`;
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

window.simulatePaymentSuccess = async (orderId) => {
  try {
    const data = await postJson('/api/store/topup/simulate-payment', { orderId });
    if (data.success) {
      showGlobalAlert(`Top-Up berhasil! +${data.gemsAwarded} NEX Gems`, 'success');
      closeAllModals();
      await loadUserProfile();
    }
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

// =============================================================
// SAFETY
// =============================================================
async function loadActiveSos() {
  try {
    const sessions = await api('/api/safety/sos/active');
    const container = document.getElementById('active-sos-list');
    container.innerHTML = sessions.map(s => `
      <div class="news-item sev-emergency">
        <div class="news-headline">🚨 Sesi Darurat Aktif</div>
        <div class="news-body">Lokasi terakhir: ${esc(s.lat)}, ${esc(s.lon)} • ${esc(timeAgo(s.created_at))}</div>
        <div class="news-meta"><span>${esc(s.live_tracking_url)}</span></div>
        <button class="btn-mini red" style="margin-top:8px;" onclick="resolveSos('${esc(s.id)}')">Akhiri Sesi</button>
      </div>`).join('');
  } catch (err) {
    console.error(err);
  }
}

window.resolveSos = async (sessionId) => {
  try {
    await postJson('/api/safety/sos/resolve', { sessionId });
    showGlobalAlert('Sesi darurat diakhiri.', 'success');
    loadActiveSos();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

window.triggerSos = async () => {
  try {
    const session = await postJson('/api/safety/sos/trigger', { lat: DEMO_LAT, lon: DEMO_LON });
    showGlobalAlert('🚨 SOS DIAKTIFKAN!', 'danger');
    document.getElementById('safety-modal').classList.add('open');
    loadActiveSos();
    setTimeout(() => {
      alert(
        `STATUS DARURAT DIAKTIFKAN\n\n` +
        `Kontak darurat: ${session.dispatchedContacts.length}\n` +
        `Tautan pemantau: ${session.liveTrackingUrl}\n\n` +
        `Fallback SMS:\n${session.offlineSmsText}`
      );
    }, 200);
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

// =============================================================
// PROFILE / SOCIAL
// =============================================================
async function searchUsers() {
  try {
    const q = document.getElementById('profile-search-input').value.trim();
    const users = await api(`/api/social/users?q=${encodeURIComponent(q)}`);
    document.getElementById('profile-search-results').innerHTML = users.map(u => `
      <div class="social-row">
        <div>
          <b style="font-size:13px;color:#fff;">${esc(u.username)}</b>
          <div style="font-size:10px;color:var(--accent-cyan);">LV.${esc(u.level)} • ${esc(u.active_title || 'Novice')}</div>
        </div>
        <button class="btn-mini" onclick="loadProfileDetail('${esc(u.id)}')">Lihat Profil</button>
      </div>`).join('') || '<div style="font-size:12px;color:var(--text-muted);">Tidak ada pengguna ditemukan.</div>';
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

window.loadProfileDetail = async (userId) => {
  try {
    activeProfileId = userId;
    const p = await api(`/api/social/profile/${userId}`);
    const isSelf = p.id === 'usr-demo-001';
    document.getElementById('profile-detail').innerHTML = `
      <div class="profile-hero">
        <div class="avatar-ring" style="width:58px;height:58px;font-size:26px;">${esc(p.active_vehicle_icon || '🚗')}</div>
        <div style="flex:1;">
          <div style="font-size:18px;font-weight:900;">${esc(p.username)}</div>
          <div style="font-size:11px;color:var(--accent-cyan);">${esc(p.tier.badge)} • ${esc(p.active_title || 'Novice')}</div>
          <div style="font-size:10.5px;color:var(--text-muted);margin-top:3px;">${esc(p.followers)} pengikut • ${esc(p.following)} mengikuti</div>
        </div>
        ${isSelf ? '<span class="chip info">Anda</span>' : `
          <button class="btn-mini ${p.isFollowing ? 'red' : 'green'}" onclick="toggleFollow('${esc(p.id)}', ${p.isFollowing})">
            ${p.isFollowing ? 'Berhenti Mengikuti' : '+ Ikuti'}
          </button>`}
      </div>
      <div class="stat-grid">
        <div class="stat-box"><b>LV.${esc(p.level)}</b><span>Level</span></div>
        <div class="stat-box"><b>${p.total_km != null ? esc(p.total_km) : '🔒'}</b><span>Total km</span></div>
        <div class="stat-box"><b>${esc(p.total_reports)}</b><span>Laporan</span></div>
      </div>
      <h4 class="section-title" style="color:var(--accent-gold);">🏅 Achievement Terbuka</h4>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${p.achievements.length
          ? p.achievements.map(a => `<span class="chip verified" title="${esc(a.description)}">${esc(a.icon)} ${esc(a.name)}</span>`).join('')
          : '<span style="font-size:11px;color:var(--text-muted);">Belum ada achievement.</span>'}
      </div>`;
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

window.toggleFollow = async (userId, isFollowing) => {
  try {
    if (isFollowing) {
      await postJson(`/api/social/unfollow/${userId}`, {});
      showGlobalAlert('Berhenti mengikuti pengguna.', 'info');
    } else {
      await postJson(`/api/social/follow/${userId}`, {});
      showGlobalAlert('Mulai mengikuti pengguna!', 'success');
    }
    loadProfileDetail(userId);
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

// =============================================================
// HELP CENTER
// =============================================================
async function loadHelpCenter() {
  try {
    const params = new URLSearchParams();
    if (helpState.category && helpState.category !== 'all') params.set('category', helpState.category);
    if (helpState.q) params.set('q', helpState.q);

    const data = await api(`/api/help/faqs?${params.toString()}`);

    document.getElementById('help-categories').innerHTML = `
      <button class="btn-preset ${helpState.category === 'all' ? 'active' : ''}" data-help-cat="all">Semua</button>
      ${data.categories.map(c => `
        <button class="btn-preset ${helpState.category === c.category ? 'active' : ''}" data-help-cat="${esc(c.category)}">
          ${esc(c.category)} (${esc(c.count)})
        </button>`).join('')}`;

    document.querySelectorAll('[data-help-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        helpState.category = btn.dataset.helpCat;
        loadHelpCenter();
      });
    });

    document.getElementById('faq-list').innerHTML = data.faqs.length
      ? data.faqs.map(f => `
        <div class="faq-item">
          <div class="faq-q" onclick="this.parentElement.classList.toggle('open')">
            <span>${esc(f.question)}</span><span>＋</span>
          </div>
          <div class="faq-a">${esc(f.answer)}</div>
        </div>`).join('')
      : '<div style="font-size:12px;color:var(--text-muted);">Tidak ada FAQ yang cocok.</div>';
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

async function loadMyTickets() {
  try {
    const tickets = await api('/api/help/tickets');
    document.getElementById('my-tickets').innerHTML = tickets.length
      ? tickets.map(t => `
        <div class="social-row" style="align-items:flex-start;">
          <div>
            <b style="font-size:12px;color:#fff;">${esc(t.subject)}</b>
            <div style="font-size:11px;color:var(--text-muted);">${esc(t.message)}</div>
            ${t.admin_reply ? `<div style="font-size:11px;color:var(--accent-green);margin-top:4px;">↳ ${esc(t.admin_reply)}</div>` : ''}
          </div>
          <span class="chip ${t.status === 'answered' ? 'verified' : 'info'}">${esc(t.status)}</span>
        </div>`).join('')
      : '';
  } catch (err) {
    console.error(err);
  }
}

// =============================================================
// ADMIN
// =============================================================
async function loadAdminOverview() {
  try {
    const data = await api('/api/admin/overview');
    document.getElementById('adm-stat-users').textContent = data.stats.totalUsers;
    document.getElementById('adm-stat-reports').textContent = data.stats.totalReports;
    document.getElementById('adm-stat-pending').textContent = data.stats.pendingVerification;
    document.getElementById('adm-stat-tickets').textContent = data.stats.openTickets;

    document.getElementById('adm-pending-reports-list').innerHTML = data.pendingReports.length
      ? data.pendingReports.map(r => `
        <div class="social-row">
          <div>
            <b style="font-size:12px;color:#fff;">${esc(r.title)}</b>
            <div style="font-size:10px;color:var(--text-muted);">${esc(r.road_name)} • ${esc(r.author_name)} • ${esc(r.category)}</div>
          </div>
          <div class="mini-actions">
            <button class="btn-mini green" onclick="moderateReport('${esc(r.id)}','verified')">Setujui</button>
            <button class="btn-mini red" onclick="moderateReport('${esc(r.id)}','rejected')">Tolak</button>
          </div>
        </div>`).join('')
      : '<div style="font-size:12px;color:var(--text-muted);">Tidak ada laporan pending.</div>';

    document.getElementById('adm-tickets-list').innerHTML = data.tickets.length
      ? data.tickets.map(t => `
        <div class="social-row">
          <div>
            <b style="font-size:12px;color:#fff;">${esc(t.subject)}</b>
            <div style="font-size:10px;color:var(--text-muted);">${esc(t.message)}</div>
          </div>
          <button class="btn-mini" onclick="replyTicket('${esc(t.id)}')">Balas</button>
        </div>`).join('')
      : '<div style="font-size:12px;color:var(--text-muted);">Tidak ada tiket terbuka.</div>';

    const logs = await api('/api/admin/audit-logs?limit=12');
    document.getElementById('adm-audit-logs').innerHTML = logs.map(l =>
      `<div>• <b style="color:#cbd5e1;">${esc(l.action)}</b> — ${esc(l.target || '-')} <span style="color:#475569;">(${esc(timeAgo(l.created_at))})</span></div>`
    ).join('') || '<div>Belum ada audit log.</div>';
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

window.moderateReport = async (reportId, status) => {
  try {
    await postJson(`/api/admin/reports/${reportId}/moderate`, { status });
    showGlobalAlert(`Laporan ${status}.`, 'success');
    loadAdminOverview();
    loadReportsFeed();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

window.replyTicket = async (ticketId) => {
  const reply = prompt('Balasan admin untuk tiket ini:');
  if (!reply) return;
  try {
    await postJson(`/api/admin/tickets/${ticketId}/reply`, { reply });
    showGlobalAlert('Balasan terkirim.', 'success');
    loadAdminOverview();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

// =============================================================
// NOTIFICATIONS
// =============================================================
function updateNotifBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const n = Number(count) || 0;
  badge.textContent = n > 99 ? '99+' : String(n);
  badge.style.display = n > 0 ? 'inline-flex' : 'none';
}

function renderNotificationRow(n) {
  return `
    <div class="notif-row ${n.is_read ? '' : 'unread'}" data-notif-id="${esc(n.id)}" data-notif-link="${esc(n.link || '')}">
      <div class="notif-icon">${notifIcon(n.type)}</div>
      <div class="notif-body">
        <div class="notif-title">${esc(n.title)}</div>
        ${n.body ? `<div class="notif-text">${esc(n.body)}</div>` : ''}
        <div class="notif-meta">${esc(timeAgo(n.created_at))}</div>
      </div>
      ${n.is_read ? '' : '<span class="notif-dot"></span>'}
    </div>`;
}

function notifIcon(type) {
  const map = {
    level_up: '🏆',
    achievement: '🎖️',
    mission: '🎯',
    follow: '👥',
    comment: '💬',
    ticket: '🎫',
    payment: '💳',
    moderation: '🛡️',
    report_verified: '✅',
    report_rejected: '⛔',
    report_resolved: '🏁'
  };
  return map[type] || '🔔';
}

async function loadNotifications() {
  try {
    const data = await api('/api/notifications?limit=100');
    updateNotifBadge(data.unreadCount);
    const list = document.getElementById('notifications-list');
    if (!list) return;
    document.getElementById('notif-summary').textContent =
      data.notifications.length
        ? `${data.notifications.length} notifikasi • ${data.unreadCount} belum dibaca`
        : 'Belum ada notifikasi';
    list.innerHTML = data.notifications.length
      ? data.notifications.map(renderNotificationRow).join('')
      : '<div class="empty-state">Notifikasi akan muncul di sini saat ada aktivitas baru.</div>';

    list.querySelectorAll('[data-notif-id]').forEach(row => {
      row.addEventListener('click', () =>
        handleNotificationClick(row.dataset.notifId, row.dataset.notifLink));
    });
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

async function refreshNotifBadge() {
  try {
    const data = await api('/api/notifications?unread=1&limit=1');
    updateNotifBadge(data.unreadCount);
  } catch (_) {
    /* badge refresh must never break the UI */
  }
}

async function markNotificationRead(id) {
  try {
    const res = await postJson(`/api/notifications/${id}/read`, {});
    updateNotifBadge(res.unreadCount);
    await loadNotifications();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

async function handleNotificationClick(id, link) {
  try {
    const res = await postJson(`/api/notifications/${id}/read`, {});
    updateNotifBadge(res.unreadCount);
  } catch (_) {
    /* clicking must still navigate even if read-state fails */
  }
  if (link && link.startsWith('report:')) {
    closeAllModals();
    window.openVoteModal(link.slice('report:'.length));
  } else if (['profile', 'gamification', 'store', 'help'].includes(link)) {
    openModal(`${link}-modal`);
  } else {
    await loadNotifications();
  }
}

async function markAllNotificationsRead() {
  try {
    const res = await postJson('/api/notifications/read-all', {});
    updateNotifBadge(res.unreadCount);
    await loadNotifications();
    showGlobalAlert('Semua notifikasi ditandai dibaca.', 'success');
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

async function clearNotifications() {
  if (!confirm('Hapus semua notifikasi? Tindakan ini tidak dapat dibatalkan.')) return;
  try {
    const res = await api('/api/notifications', { method: 'DELETE' });
    updateNotifBadge(res.unreadCount);
    await loadNotifications();
    showGlobalAlert('Notifikasi dihapus.', 'success');
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

function handleIncomingNotification(n) {
  if (!n) return;
  if (currentUser) currentUser.unreadNotifications = (currentUser.unreadNotifications || 0) + 1;
  refreshNotifBadge();
  const list = document.getElementById('notifications-list');
  if (list && document.getElementById('notifications-modal').classList.contains('open')) {
    loadNotifications();
  } else {
    showGlobalAlert(`🔔 ${n.title}`, 'info');
  }
}

// =============================================================
// TRIPS
// =============================================================
const VEHICLE_LABELS = {
  motorcycle: '🏍️ Motor',
  car: '🚗 Mobil',
  bus: '🚌 Bus',
  truck: '🚚 Truk',
  bicycle: '🚲 Sepeda'
};

async function loadTrips() {
  try {
    const [stats, history] = await Promise.all([api('/api/trips/stats'), api('/api/trips?limit=40')]);
    renderTripStats(stats);
    renderTripWeek(stats.last_7_days || []);
    renderTripHistory(history);
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

function renderTripStats(s) {
  const container = document.getElementById('trip-stats-grid');
  if (!container) return;
  container.innerHTML = `
    <div class="stat-box"><b>${esc(s.total_trips)}</b><span>Total Perjalanan</span></div>
    <div class="stat-box"><b style="color:var(--accent-cyan);">${esc(s.total_km)}</b><span>Kilometer</span></div>
    <div class="stat-box"><b style="color:var(--accent-gold);">${esc(s.total_hours)}</b><span>Jam Berkendara</span></div>
    <div class="stat-box"><b style="color:var(--accent-green);">${esc(s.avg_speed_kmh)}</b><span>Rata-rata km/j</span></div>
    <div class="stat-box"><b>${esc(s.valid_trips)}</b><span>Valid</span></div>
    <div class="stat-box"><b style="color:var(--accent-red);">${esc(s.rejected_trips)}</b><span>Ditolak</span></div>
    <div class="stat-box"><b>${esc(s.top_speed_kmh)}</b><span>Kecepatan Maks</span></div>
    <div class="stat-box"><b style="color:var(--accent-purple);">${esc(s.total_xp)}</b><span>XP Diperoleh</span></div>`;
}

function renderTripWeek(days) {
  const container = document.getElementById('trip-week-bars');
  if (!container) return;
  if (!days.length) {
    container.innerHTML = '<div class="empty-state">Belum ada data perjalanan mingguan.</div>';
    return;
  }
  const max = Math.max(1, ...days.map(d => d.km));
  container.innerHTML = days.map(d => {
    const pct = Math.max(4, Math.round((d.km / max) * 100));
    return `
      <div class="trip-bar-col" title="${esc(d.km)} km • ${esc(d.trips)} perjalanan">
        <div class="trip-bar-value">${d.km > 0 ? esc(d.km) : ''}</div>
        <div class="trip-bar-track"><div class="trip-bar-fill" style="height:${pct}%"></div></div>
        <div class="trip-bar-label">${esc(d.date.slice(5))}</div>
      </div>`;
  }).join('');
}

function renderTripHistory(trips) {
  const container = document.getElementById('trip-history-list');
  if (!container) return;
  if (!trips.length) {
    container.innerHTML = '<div class="empty-state">Belum ada perjalanan tercatat. Selesaikan perjalanan pertama Anda!</div>';
    return;
  }
  container.innerHTML = trips.map(t => `
    <div class="trip-row ${t.is_valid ? '' : 'invalid'}">
      <div class="trip-row-main">
        <b>${esc(VEHICLE_LABELS[t.vehicle_type] || t.vehicle_type)}</b>
        <span>${esc(t.distance_km)} km • ${esc(t.duration_mins)} mnt • ${esc(t.avg_speed_kmh)} km/j</span>
      </div>
      <div class="trip-row-side">
        <span class="trip-xp">+${esc(t.earned_xp)} XP</span>
        <span class="trip-time">${esc(timeAgo(t.created_at))}</span>
        ${t.is_valid ? '<span class="chip verified">valid</span>' : '<span class="chip danger">ditolak</span>'}
      </div>
    </div>`).join('');
}

// =============================================================
// SAVED PLACES
// =============================================================
async function loadSavedPlaces() {
  try {
    const places = await api('/api/places');
    const container = document.getElementById('saved-places-list');
    if (!container) return;
    container.innerHTML = places.length
      ? places.map(p => `
        <div class="saved-place-chip">
          <button class="saved-place-open" title="Jadikan tujuan"
                  onclick="useSavedPlace(${Number(p.lat)}, ${Number(p.lon)}, '${esc(p.label)}')">
            <span>${esc(p.icon || '📍')}</span> ${esc(p.label)}
          </button>
          <button class="saved-place-del" title="Hapus" onclick="deleteSavedPlace('${esc(p.id)}')">×</button>
        </div>`).join('')
      : '<div style="font-size:10.5px;color:var(--text-muted);">Belum ada tempat tersimpan.</div>';
  } catch (err) {
    console.error('loadSavedPlaces', err);
  }
}

window.useSavedPlace = (lat, lon, label) => {
  currentNavigationCoords.toLat = lat;
  currentNavigationCoords.toLon = lon;
  document.getElementById('nav-destination').value = label;
  loadNavigationRoute();
  showGlobalAlert(`Tujuan diatur ke ${label}.`, 'success');
};

async function saveCurrentDestination() {
  const label = prompt('Nama tempat (mis. Rumah, Kantor):', document.getElementById('nav-destination').value.trim());
  if (!label) return;
  try {
    await postJson('/api/places', {
      label,
      address: document.getElementById('nav-destination').value.trim(),
      lat: currentNavigationCoords.toLat,
      lon: currentNavigationCoords.toLon,
      icon: '⭐'
    });
    showGlobalAlert('Tempat berhasil disimpan.', 'success');
    loadSavedPlaces();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

window.deleteSavedPlace = async (placeId) => {
  if (!confirm('Hapus tempat tersimpan ini?')) return;
  try {
    await api(`/api/places/${placeId}`, { method: 'DELETE' });
    loadSavedPlaces();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

// =============================================================
// EMERGENCY CONTACTS
// =============================================================
async function loadEmergencyContacts() {
  try {
    const contacts = await api('/api/safety/contacts');
    const container = document.getElementById('emergency-contacts-list');
    if (!container) return;
    container.innerHTML = contacts.length
      ? contacts.map(c => `
        <div class="contact-row">
          <div>
            <b>${esc(c.name)}</b>
            <span>${esc(c.phone)} • ${esc(c.relationship || 'Kontak')}</span>
          </div>
          <button class="btn-mini red" onclick="deleteEmergencyContact('${esc(c.id)}')">Hapus</button>
        </div>`).join('')
      : '<div style="font-size:10.5px;color:var(--text-muted);">Belum ada kontak darurat.</div>';
  } catch (err) {
    console.error('loadEmergencyContacts', err);
  }
}

async function addEmergencyContact() {
  const name = document.getElementById('contact-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const relationship = document.getElementById('contact-relation').value.trim();
  if (!name || !phone) {
    showGlobalAlert('Nama dan nomor telepon wajib diisi.', 'danger');
    return;
  }
  try {
    await postJson('/api/safety/contacts', { name, phone, relationship });
    document.getElementById('contact-name').value = '';
    document.getElementById('contact-phone').value = '';
    document.getElementById('contact-relation').value = '';
    showGlobalAlert('Kontak darurat ditambahkan.', 'success');
    loadEmergencyContacts();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
}

window.deleteEmergencyContact = async (id) => {
  if (!confirm('Hapus kontak darurat ini?')) return;
  try {
    await api(`/api/safety/contacts/${id}`, { method: 'DELETE' });
    loadEmergencyContacts();
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

// =============================================================
// REPORT COMMENTS
// =============================================================
async function loadReportComments(reportId) {
  const container = document.getElementById(`report-comments-${reportId}`);
  if (!container) return;
  try {
    const comments = await api(`/api/reports/${reportId}/comments`);
    container.innerHTML = `
      <h4 class="comment-heading">💬 Diskusi (${comments.length})</h4>
      <div class="comment-list">
        ${comments.length
          ? comments.map(c => `
            <div class="comment-row">
              <div class="comment-author">${esc(c.author_name)} <span>${esc(timeAgo(c.created_at))}</span></div>
              <div class="comment-text">${esc(c.body)}</div>
            </div>`).join('')
          : '<div class="empty-state">Belum ada komentar. Berikan info tambahan.</div>'}
      </div>
      <div class="comment-compose">
        <input type="text" id="comment-input-${esc(reportId)}" maxlength="500" placeholder="Tulis komentar (min. 3 karakter)..." />
        <button class="btn-mini" onclick="submitReportComment('${esc(reportId)}')">Kirim</button>
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

window.submitReportComment = async (reportId) => {
  const input = document.getElementById(`comment-input-${reportId}`);
  const body = input ? input.value.trim() : '';
  if (body.length < 3) {
    showGlobalAlert('Komentar minimal 3 karakter.', 'danger');
    return;
  }
  try {
    await postJson(`/api/reports/${reportId}/comments`, { body });
    if (input) input.value = '';
    loadReportComments(reportId);
  } catch (err) {
    showGlobalAlert(err.message, 'danger');
  }
};

function handleIncomingComment(comment) {
  if (!comment) return;
  const container = document.getElementById(`report-comments-${comment.report_id}`);
  if (container) loadReportComments(comment.report_id);
}

// =============================================================
// ADMIN ANALYTICS
// =============================================================
async function loadAdminAnalytics() {
  const container = document.getElementById('adm-analytics');
  if (!container) return;
  try {
    const data = await api('/api/admin/analytics');
    const maxDay = Math.max(1, ...data.reportsLast7Days.map(d => d.reports));
    const statusChips = data.reportsByStatus.map(s =>
      `<span class="chip info">${esc(s.status)}: ${esc(s.count)}</span>`).join('');
    const categoryRows = data.reportsByCategory.map(c => `
      <div class="analytics-row">
        <span>${esc(CATEGORY_ICONS[c.category] || '⚠️')} ${esc(c.category)}</span>
        <div class="analytics-track"><div class="analytics-fill" style="width:${Math.round((c.count / Math.max(1, data.reportsByCategory[0].count)) * 100)}%"></div></div>
        <b>${esc(c.count)}</b>
      </div>`).join('');

    container.innerHTML = `
      <div class="analytics-summary">
        <div class="stat-box"><b>${esc(data.trips.total)}</b><span>Perjalanan</span></div>
        <div class="stat-box"><b style="color:var(--accent-cyan);">${esc(data.trips.km)}</b><span>Total km</span></div>
        <div class="stat-box"><b style="color:var(--accent-green);">Rp ${Number(data.revenueIdr).toLocaleString('id-ID')}</b><span>Pendapatan</span></div>
        <div class="stat-box"><b>${esc(data.paidTransactions)}</b><span>Transaksi Lunas</span></div>
      </div>
      <div class="analytics-chips">${statusChips}</div>
      <div class="analytics-categories">${categoryRows || '<div class="empty-state">Belum ada laporan.</div>'}</div>
      <div class="analytics-week">
        ${data.reportsLast7Days.map(d => `
          <div class="analytics-day" title="${esc(d.date)}: ${esc(d.reports)} laporan">
            <div class="analytics-day-bar" style="height:${Math.max(4, Math.round((d.reports / maxDay) * 100))}%"></div>
            <span>${esc(d.date.slice(5))}</span>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}


function setupUIEventListeners() {
  // Nav tabs
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      openModal(btn.dataset.modal);
    });
  });
  document.querySelectorAll('[data-view="map"]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
      document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setTimeout(() => map.invalidateSize(), 50);
    });
  });

  // Modal close
  document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('modal-backdrop') || e.target.classList.contains('modal-close-btn')) {
        closeAllModals();
      }
    });
  });

  // Preset destinations
  document.querySelectorAll('.btn-preset[data-lat]').forEach(btn => {
    btn.addEventListener('click', e => {
      currentNavigationCoords.toLat = parseFloat(e.currentTarget.dataset.lat);
      currentNavigationCoords.toLon = parseFloat(e.currentTarget.dataset.lon);
      document.getElementById('nav-destination').value = e.currentTarget.textContent.trim();
      loadNavigationRoute();
    });
  });

  // Layer toggles
  document.querySelectorAll('.layer-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const layer = btn.dataset.layer;
      const on = btn.classList.contains('active');
      layerState[layer] = on;

      if (layer === 'vehicles') vehicleMarkers.forEach(m => m.setOpacity(on ? 1 : 0));
      if (layer === 'reports') reportMarkers.forEach(m => m.setOpacity(on ? 1 : 0));
      if (layer === 'traffic') trafficLayers.forEach(m => m.setStyle({ opacity: on ? 0.85 : 0 }));
      if (layer === 'news') newsMarkers.forEach(m => m.setStyle({ opacity: on ? 1 : 0, fillOpacity: on ? 0.35 : 0 }));
    });
  });

  // Report modal + evidence upload
  document.getElementById('btn-open-report-modal').addEventListener('click', () => {
    document.getElementById('report-current-coords').textContent = `${DEMO_LAT.toFixed(4)}, ${DEMO_LON.toFixed(4)}`;
    openModal('report-modal');
  });

  document.getElementById('report-file').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    const preview = document.getElementById('report-preview');
    pendingEvidenceDataUrl = null;

    if (!file) {
      preview.style.display = 'none';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showGlobalAlert('Ukuran foto maksimal 3MB', 'danger');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingEvidenceDataUrl = String(reader.result);
      preview.src = pendingEvidenceDataUrl;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('form-create-report').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
      let imageUrl = '';
      if (pendingEvidenceDataUrl) {
        const uploaded = await postJson('/api/upload', { dataUrl: pendingEvidenceDataUrl });
        imageUrl = uploaded.url;
      }

      await postJson('/api/reports', {
        category: document.getElementById('report-category').value,
        title: document.getElementById('report-title').value,
        roadName: document.getElementById('report-road').value,
        description: document.getElementById('report-desc').value,
        imageUrl,
        lat: DEMO_LAT + (Math.random() - 0.5) * 0.01,
        lon: DEMO_LON + (Math.random() - 0.5) * 0.01
      });

      showGlobalAlert('🎉 Laporan terkirim! +20 XP', 'success');
      e.target.reset();
      pendingEvidenceDataUrl = null;
      document.getElementById('report-preview').style.display = 'none';
      closeAllModals();
      await loadUserProfile();
      loadReportsFeed();
    } catch (err) {
      showGlobalAlert(err.message, 'danger');
    } finally {
      btn.disabled = false;
    }
  });

  // Simulate commute
  document.getElementById('btn-simulate-commute').addEventListener('click', async () => {
    try {
      const data = await postJson('/api/trips/finish', {
        distanceKm: 6.8,
        durationMins: 18,
        maxSpeedKmh: 48,
        mockFlag: false,
        accelMps2: 2.2
      });
      if (data.isValid) {
        showGlobalAlert(`🌟 Perjalanan tertib selesai! +${data.earnedXp} XP`, 'success');
        await loadUserProfile();
      } else {
        showGlobalAlert(`⚠️ Perjalanan dianulir anti-cheat: ${data.flags.join(', ')}`, 'danger');
      }
    } catch (err) {
      showGlobalAlert(err.message, 'danger');
    }
  });

  // SOS
  document.getElementById('btn-open-sos-modal').addEventListener('click', () => {
    document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
    openModal('safety-modal');
  });
  document.getElementById('btn-trigger-sos').addEventListener('click', window.triggerSos);

  // Top-up
  document.getElementById('btn-open-topup').addEventListener('click', openTopupModal);
  document.getElementById('btn-open-topup-from-store').addEventListener('click', openTopupModal);

  // Gamification sub-tabs + filters
  document.querySelectorAll('[data-gm-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-gm-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ['leaderboard', 'missions', 'achievements'].forEach(tab => {
        document.getElementById(`gm-panel-${tab}`).style.display = tab === btn.dataset.gmTab ? 'block' : 'none';
      });
      if (btn.dataset.gmTab === 'leaderboard') loadLeaderboard();
      if (btn.dataset.gmTab === 'missions') loadMissions();
      if (btn.dataset.gmTab === 'achievements') loadAchievements();
    });
  });

  ['lb-category', 'lb-period', 'lb-scope'].forEach(id => {
    document.getElementById(id).addEventListener('change', loadLeaderboard);
  });

  // Store categories
  document.querySelectorAll('[data-store-cat]').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('[data-store-cat]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      loadStoreItems(e.currentTarget.dataset.storeCat);
    });
  });

  // News filters
  document.querySelectorAll('[data-news-filter]').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('[data-news-filter]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentNewsFilter = e.currentTarget.dataset.newsFilter;
      renderNewsFeed();
    });
  });

  // Privacy
  document.getElementById('btn-save-privacy').addEventListener('click', async () => {
    try {
      await postJson('/api/user/privacy', {
        privacyMode: document.getElementById('privacy-mode-select').value,
        fuzzyRadiusMeters: Number(document.getElementById('privacy-radius').value) || 300,
        homeLat: Number(document.getElementById('privacy-home-lat').value) || null,
        homeLon: Number(document.getElementById('privacy-home-lon').value) || null
      });
      showGlobalAlert('Pengaturan privasi tersimpan.', 'success');
      await loadUserProfile();
    } catch (err) {
      showGlobalAlert(err.message, 'danger');
    }
  });

  document.getElementById('btn-preview-privacy').addEventListener('click', async () => {
    try {
      const homeLat = Number(document.getElementById('privacy-home-lat').value) || -6.21;
      const homeLon = Number(document.getElementById('privacy-home-lon').value) || 106.82;
      const r = await postJson('/api/user/privacy/preview', { lat: homeLat + 0.0002, lon: homeLon + 0.0002 });
      document.getElementById('privacy-preview-result').textContent = r.isHidden
        ? 'Ghost Mode aktif: lokasi Anda tidak ditampilkan.'
        : r.isMasked
        ? `Masking aktif (radius ${r.fuzzyRadius} m): koordinat disamarkan menjadi ${r.lat}, ${r.lon}`
        : 'Titik ini berada di luar Fuzzy Privacy Zone.';
    } catch (err) {
      showGlobalAlert(err.message, 'danger');
    }
  });

  document.getElementById('btn-export-data').addEventListener('click', () => {
    window.location.href = '/api/user/export';
  });

  document.getElementById('btn-delete-history').addEventListener('click', async () => {
    if (!confirm('Hapus seluruh riwayat perjalanan dan voting Anda secara permanen?')) return;
    try {
      await fetch('/api/user/history', { method: 'DELETE' });
      showGlobalAlert('Riwayat perjalanan dihapus permanen.', 'success');
    } catch (err) {
      showGlobalAlert(err.message, 'danger');
    }
  });

  // Profile search
  document.getElementById('btn-profile-search').addEventListener('click', searchUsers);
  document.getElementById('profile-search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchUsers();
  });

  // Help search + ticket
  document.getElementById('btn-help-search').addEventListener('click', () => {
    helpState.q = document.getElementById('help-search').value.trim();
    loadHelpCenter();
  });
  document.getElementById('help-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      helpState.q = e.target.value.trim();
      loadHelpCenter();
    }
  });

  document.getElementById('form-support-ticket').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await postJson('/api/help/tickets', {
        category: document.getElementById('ticket-category').value,
        subject: document.getElementById('ticket-subject').value,
        message: document.getElementById('ticket-message').value
      });
      showGlobalAlert('Tiket dukungan terkirim.', 'success');
      e.target.reset();
      loadMyTickets();
    } catch (err) {
      showGlobalAlert(err.message, 'danger');
    }
  });

  // Civic broadcast
  document.getElementById('form-civic-broadcast').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await postJson('/api/civic/announcements', {
        sourceAgency: document.getElementById('adm-agency').value,
        category: 'traffic_regulation',
        severity: document.getElementById('adm-severity').value,
        headline: document.getElementById('adm-headline').value,
        details: document.getElementById('adm-details').value,
        affectedArea: 'Wilayah Metropolitan DKI Jakarta',
        lat: DEMO_LAT,
        lon: DEMO_LON
      });
      showGlobalAlert('Siaran resmi berhasil dipublikasikan.', 'success');
      e.target.reset();
      loadQuickNews();
    } catch (err) {
      showGlobalAlert(err.message, 'danger');
    }
  });

  // Notifications
  document.getElementById('btn-open-notifications').addEventListener('click', () => {
    openModal('notifications-modal');
  });
  document.getElementById('btn-notif-read-all').addEventListener('click', markAllNotificationsRead);
  document.getElementById('btn-notif-clear').addEventListener('click', clearNotifications);

  // Saved places
  document.getElementById('btn-save-destination').addEventListener('click', saveCurrentDestination);

  // Emergency contacts
  document.getElementById('btn-add-contact').addEventListener('click', addEmergencyContact);
  document.getElementById('contact-phone').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addEmergencyContact(); }
  });

  // Admin CSV export
  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `/api/admin/export/${btn.dataset.export}`;
    });
  });
}

// =============================================================
// BOOTSTRAP
// =============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadMapConfig();
  initMap();
  initWebSocket();
  setupUIEventListeners();

  await loadUserProfile();
  await loadReportsFeed();
  await loadNavigationRoute();
  await loadQuickNews();
  await loadSavedPlaces();
  refreshNotifBadge();

  // PWA service worker (offline shell + cached assets)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed', err);
    });
  }

  try {
    const [segments, summary] = await Promise.all([
      api('/api/traffic/segments'),
      api('/api/traffic/summary')
    ]);
    renderTrafficSegments(segments);
    updateAci(summary);
  } catch (err) {
    console.error('traffic init', err);
  }

  // Refresh ACI gauge periodically (WS also pushes updates)
  setInterval(async () => {
    try { updateAci(await api('/api/traffic/summary')); } catch (_) {}
  }, 15000);

  // Refresh quick news periodically
  setInterval(loadQuickNews, 60000);
});
