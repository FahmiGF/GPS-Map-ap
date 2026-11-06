/* Comprehensive smoke test for NEXMAP API v1.2
 * Self-contained by default: seeds a temporary database and boots its own
 * server on a random port, so the suite is repeatable and never mutates dev data.
 * Set NEXMAP_SMOKE_BASE to test an already-running instance instead.
 */
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
let BASE = process.env.NEXMAP_SMOKE_BASE || null;
let child = null;
let tempDbPath = null;

async function bootServer() {
  if (BASE) return;

  const port = 3100 + Math.floor(Math.random() * 800);
  tempDbPath = path.join(os.tmpdir(), `nexmap-smoke-${Date.now()}-${port}.db`);
  const env = { ...process.env, PORT: String(port), NEXMAP_DB_PATH: tempDbPath };

  execFileSync(process.execPath, ['database/seed.js'], { cwd: ROOT, env, stdio: 'ignore' });

  child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  child.stderr.on('data', d => { stderr += d.toString(); });
  child.stdout.on('data', () => {});

  BASE = `http://localhost:${port}`;

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch (_) {
      /* not ready yet */
    }
    await new Promise(r => setTimeout(r, 250));
    if (child.exitCode != null) {
      throw new Error(`Server exited early (code ${child.exitCode}): ${stderr}`);
    }
  }
  throw new Error(`Server did not become healthy in time: ${stderr}`);
}

async function shutdown() {
  if (child && child.exitCode == null) {
    child.kill();
    await new Promise(r => setTimeout(r, 400));
    if (child.exitCode == null) child.kill('SIGKILL');
  }
  if (tempDbPath) {
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.rmSync(tempDbPath + suffix, { force: true }); } catch (_) {}
    }
  }
}

let pass = 0;
let fail = 0;
const failures = [];

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function check(name, condition, extra = '') {
  if (condition) {
    pass++;
    console.log(`✔ ${name}`);
  } else {
    fail++;
    failures.push(name + (extra ? ` — ${extra}` : ''));
    console.log(`✘ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function run() {
  await bootServer();

  const health = await req('GET', '/api/health');
  check('GET /api/health', health.status === 200 && health.data.status === 'ok');

  const meta = await req('GET', '/api/meta');
  check('GET /api/meta has categories', meta.status === 200 && meta.data.categories.length === 11);

  const mapConfig = await req('GET', '/api/config');
  check('GET /api/config tile URL is key-free', mapConfig.status === 200 && /^https:\/\//.test(mapConfig.data.tileUrl) && !mapConfig.data.tileUrl.includes('cartocdn.com'));
  check('map config exposes fallback providers', Array.isArray(mapConfig.data.fallbackTileUrls) && mapConfig.data.fallbackTileUrls.length >= 1);

  const profile = await req('GET', '/api/user/profile');
  check('GET /api/user/profile', profile.status === 200 && profile.data.username === 'NEX_Rider');
  check('profile has achievements', Array.isArray(profile.data.achievements) && profile.data.achievements.length === 10);

  const vehicles = await req('GET', '/api/vehicles/live');
  check('GET /api/vehicles/live', vehicles.status === 200 && vehicles.data.length >= 6);

  const segments = await req('GET', '/api/traffic/segments');
  check('GET /api/traffic/segments', segments.status === 200 && segments.data.length >= 7);
  check('traffic segment has ACI color', segments.data.every(s => s.color && typeof s.aci === 'number'));

  const summary = await req('GET', '/api/traffic/summary');
  check('GET /api/traffic/summary', summary.status === 200 && typeof summary.data.avgSpeed === 'number');

  const route = await req('GET', '/api/navigation/route');
  check('GET /api/navigation/route', route.status === 200 && route.data.etaMins > 0 && route.data.segments.length === 6);

  const active = await req('GET', '/api/reports/active');
  check('GET /api/reports/active', active.status === 200 && active.data.length >= 4);

  const detail = await req('GET', `/api/reports/${active.data[0].id}`);
  check('GET /api/reports/:id', detail.status === 200 && Array.isArray(detail.data.votes));

  // Trip completes distance mission
  const trip = await req('POST', '/api/trips/finish', {
    distanceKm: 6.8, durationMins: 18, maxSpeedKmh: 48, mockFlag: false, accelMps2: 2.2
  });
  check('POST /api/trips/finish valid', trip.status === 200 && trip.data.isValid === true && trip.data.earnedXp > 0);

  const cheat = await req('POST', '/api/trips/finish', {
    distanceKm: 20, durationMins: 10, maxSpeedKmh: 260, mockFlag: true
  });
  check('POST trip anti-cheat rejects spoof', cheat.status === 200 && cheat.data.isValid === false && cheat.data.flags.includes('MOCK_LOCATION_ACTIVE'));

  const missions = await req('GET', '/api/gamification/missions');
  const distanceMission = missions.data.find(m => m.goalType === 'distance' && m.type === 'daily');
  check('GET missions lists user progress', missions.status === 200 && missions.data.length >= 4);
  check('distance mission completed after trip', distanceMission && distanceMission.isCompleted);

  const claim = await req('POST', `/api/gamification/missions/${distanceMission.id}/claim`, {});
  check('POST mission claim succeeds', claim.status === 200 && claim.data.rewardXp > 0);

  const reclaim = await req('POST', `/api/gamification/missions/${distanceMission.id}/claim`, {});
  check('mission claim is idempotent', reclaim.status === 400);

  const achievements = await req('GET', '/api/gamification/achievements');
  check('GET achievements', achievements.status === 200 && achievements.data.length === 10);
  check('First Journey unlocked after trip', achievements.data.find(a => a.id === 'ach-first-journey')?.unlocked === true);

  // Create report (validates + progresses report mission)
  const created = await req('POST', '/api/reports', {
    category: 'flood',
    title: 'Genangan uji coba di lajur kiri',
    roadName: 'Jl. Uji Coba',
    description: 'Air setinggi 20cm',
    lat: -6.2090,
    lon: 106.8230
  });
  check('POST /api/reports', created.status === 201 && created.data.report.status === 'pending');
  const reportId = created.data.report.id;

  const badCat = await req('POST', '/api/reports', { category: 'alien', title: 'Tes', lat: 0, lon: 0 });
  check('POST report rejects invalid category', badCat.status === 429 || badCat.status === 400);

  // Vote on two distinct reports
  const vote1 = await req('POST', `/api/reports/${reportId}/vote`, {
    voteType: 'still_happening', voterLat: -6.2090, voterLon: 106.8230
  });
  check('POST vote still_happening', vote1.status === 200 && vote1.data.report.confirmations >= 1);

  const vote2 = await req('POST', `/api/reports/${active.data[1].id}/vote`, {
    voteType: 'still_happening', voterLat: -6.2090, voterLon: 106.8230
  });
  check('POST vote on second report', vote2.status === 200);

  const badVote = await req('POST', `/api/reports/${reportId}/vote`, { voteType: 'hack' });
  check('POST vote rejects invalid type', badVote.status === 400);

  const farVote = await req('POST', `/api/reports/${reportId}/vote`, {
    voteType: 'still_happening', voterLat: -7.5, voterLon: 110.0
  });
  check('POST vote enforces 2km geofence', farVote.status === 400);

  const missions2 = await req('GET', '/api/gamification/missions');
  const reportMission = missions2.data.find(m => m.goalType === 'report' && m.type === 'daily');
  const verifyMission = missions2.data.find(m => m.goalType === 'verify' && m.type === 'daily');
  check('report mission progressed', reportMission && reportMission.currentCount >= 1);
  check('verify mission progressed', verifyMission && verifyMission.currentCount >= 3);

  const claimReport = await req('POST', `/api/gamification/missions/${reportMission.id}/claim`, {});
  check('claim report mission', claimReport.status === 200);

  // Leaderboards
  for (const category of ['explorer', 'reporter', 'contributor', 'navigator', 'safety', 'city_explorer']) {
    const lb = await req('GET', `/api/gamification/leaderboard?category=${category}&period=weekly&scope=global`);
    check(`leaderboard ${category}`, lb.status === 200 && Array.isArray(lb.data) && lb.data.length > 0);
  }
  const friendsLb = await req('GET', '/api/gamification/leaderboard?period=weekly&scope=friends');
  check('leaderboard friends scope', friendsLb.status === 200 && friendsLb.data.length >= 2);

  // Social
  const users = await req('GET', '/api/social/users?q=Road');
  check('GET social user search', users.status === 200 && users.data.length >= 1);
  const targetId = users.data[0].id;
  const targetProfile = await req('GET', `/api/social/profile/${targetId}`);
  check('GET social profile', targetProfile.status === 200 && targetProfile.data.username);
  const unfollow = await req('POST', `/api/social/unfollow/${targetId}`, {});
  check('POST unfollow', unfollow.status === 200);
  const follow = await req('POST', `/api/social/follow/${targetId}`, {});
  check('POST follow', follow.status === 200);
  const selfFollow = await req('POST', '/api/social/follow/usr-demo-001', {});
  check('follow self rejected', selfFollow.status === 400);

  // News
  const news = await req('GET', '/api/news?lat=-6.2088&lon=106.8229');
  check('GET personalized news', news.status === 200 && news.data.length >= 3);
  check('news has relevance + distance', news.data.every(n => 'relevant' in n && 'distanceKm' in n));

  const publishNews = await req('POST', '/api/news', {
    headline: 'Uji Coba Rekayasa Lalu Lintas',
    body: 'Penutupan sementara lajur kanan selama 2 jam.',
    category: 'traffic',
    severity: 'warning',
    source: 'NEXMAP Newsroom',
    lat: -6.21,
    lon: 106.82
  });
  check('POST /api/news', publishNews.status === 201);

  // Help center
  const faqs = await req('GET', '/api/help/faqs');
  check('GET help faqs', faqs.status === 200 && faqs.data.faqs.length >= 10 && faqs.data.categories.length >= 5);
  const searchFaq = await req('GET', '/api/help/faqs?q=XP');
  check('faq search works', searchFaq.status === 200 && searchFaq.data.faqs.length >= 1);
  const ticket = await req('POST', '/api/help/tickets', {
    category: 'payment', subject: 'Uji tiket', message: 'Tes alur tiket'
  });
  check('POST support ticket', ticket.status === 201);
  const tickets = await req('GET', '/api/help/tickets');
  check('GET my tickets', tickets.status === 200 && tickets.data.length >= 1);
  const reply = await req('POST', `/api/admin/tickets/${ticket.data.id}/reply`, { reply: 'Sudah kami tangani.' });
  check('POST admin ticket reply', reply.status === 200 && reply.data.status === 'answered');

  // Notifications
  const notifications = await req('GET', '/api/notifications');
  check('GET notifications', notifications.status === 200 && notifications.data.notifications.length >= 3);
  check('notification unread count', notifications.data.unreadCount >= 2);
  check('mission claim created notification', notifications.data.notifications.some(n => n.type === 'mission'));
  const unreadOnly = await req('GET', '/api/notifications?unread=1');
  check('GET unread notifications filter', unreadOnly.status === 200 && unreadOnly.data.notifications.every(n => n.is_read === 0));
  const markOne = await req('POST', `/api/notifications/${notifications.data.notifications[0].id}/read`, {});
  check('POST mark notification read', markOne.status === 200 && markOne.data.success);
  const markAll = await req('POST', '/api/notifications/read-all', {});
  check('POST mark all notifications read', markAll.status === 200 && markAll.data.unreadCount === 0);

  // Trips history & stats
  const trips = await req('GET', '/api/trips');
  check('GET trip history', trips.status === 200 && trips.data.length >= 4);
  check('trip history parses anti-cheat flags', Array.isArray(trips.data[0].anti_cheat_flags));
  const tripStats = await req('GET', '/api/trips/stats');
  check('GET trip stats', tripStats.status === 200 && tripStats.data.total_trips >= 4 && tripStats.data.total_km > 0);
  check('trip stats has 7-day series', tripStats.data.last_7_days.length === 7);

  // Saved places
  const places = await req('GET', '/api/places');
  check('GET saved places', places.status === 200 && places.data.length >= 3);
  const newPlace = await req('POST', '/api/places', {
    label: 'Kampus', address: 'Universitas Indonesia', lat: -6.3600, lon: 106.8270, icon: '🎓'
  });
  check('POST saved place', newPlace.status === 201 && newPlace.data.label === 'Kampus');
  const dupPlace = await req('POST', '/api/places', {
    label: 'Kampus', lat: -6.36, lon: 106.827
  });
  check('saved place duplicate rejected', dupPlace.status === 400);
  const patchedPlace = await req('PATCH', `/api/places/${newPlace.data.id}`, { label: 'Kampus UI' });
  check('PATCH saved place', patchedPlace.status === 200 && patchedPlace.data.label === 'Kampus UI');
  const badPlace = await req('POST', '/api/places', { label: 'X', lat: 999, lon: 0 });
  check('saved place validates input', badPlace.status === 400);
  const delPlace = await req('DELETE', `/api/places/${newPlace.data.id}`);
  check('DELETE saved place', delPlace.status === 200 && delPlace.data.success);

  // Report comments
  const seedComments = await req('GET', '/api/reports/rep-001/comments');
  check('GET report comments', seedComments.status === 200 && seedComments.data.length >= 2);
  const newComment = await req('POST', `/api/reports/${reportId}/comments`, { body: 'Konfirmasi dari warga sekitar.' });
  check('POST report comment', newComment.status === 201 && newComment.data.author_name === 'NEX_Rider');
  const spamComment = await req('POST', `/api/reports/${reportId}/comments`, { body: 'Konfirmasi dari warga sekitar.' });
  check('duplicate comment rejected', spamComment.status === 400);
  const shortComment = await req('POST', `/api/reports/${reportId}/comments`, { body: 'x' });
  check('short comment rejected', shortComment.status === 400);
  const delOtherComment = await req('DELETE', '/api/reports/comments/cmt-seed-1');
  check('cannot delete another user comment', delOtherComment.status === 400);
  const delOwnComment = await req('DELETE', `/api/reports/comments/${newComment.data.id}`);
  check('DELETE own comment', delOwnComment.status === 200 && delOwnComment.data.success);
  const reportDetail = await req('GET', `/api/reports/${reportId}`);
  check('report detail exposes comment count', typeof reportDetail.data.commentCount === 'number');

  // Emergency contacts
  const contacts = await req('GET', '/api/safety/contacts');
  check('GET emergency contacts', contacts.status === 200 && contacts.data.length >= 1);
  const badContact = await req('POST', '/api/safety/contacts', { name: 'Tes', phone: 'abc' });
  check('emergency contact validates phone', badContact.status === 400);
  const newContact = await req('POST', '/api/safety/contacts', {
    name: 'Rekan Kerja', phone: '+6281211112222', relationship: 'Rekan'
  });
  check('POST emergency contact', newContact.status === 201);
  const delContact = await req('DELETE', `/api/safety/contacts/${newContact.data.id}`);
  check('DELETE emergency contact', delContact.status === 200);

  // Admin analytics & CSV export
  const analytics = await req('GET', '/api/admin/analytics');
  check('GET admin analytics', analytics.status === 200 && Array.isArray(analytics.data.reportsByCategory) && analytics.data.reportsLast7Days.length === 7);
  check('analytics has revenue + trips', typeof analytics.data.revenueIdr === 'number' && analytics.data.trips.total >= 3);

  const csvRes = await fetch(BASE + '/api/admin/export/reports');
  const csvText = await csvRes.text();
  check('GET CSV export reports', csvRes.status === 200 && (csvRes.headers.get('content-type') || '').includes('text/csv') && csvText.includes('category'));
  const badCsv = await req('GET', '/api/admin/export/nonsense');
  check('CSV export rejects unknown dataset', badCsv.status === 404);

  // Store
  const store = await req('GET', '/api/store/items');
  check('GET /api/store/items (is_active fix)', store.status === 200 && store.data.items.length >= 10);
  const buy = await req('POST', '/api/store/buy', { itemId: 'title-pantura' });
  check('POST buy cosmetic', buy.status === 200 && buy.data.success);
  const equip = await req('POST', '/api/store/equip', { itemId: 'title-pantura' });
  check('POST equip cosmetic', equip.status === 200 && equip.data.success);
  const profileAfterEquip = await req('GET', '/api/user/profile');
  check('equipped title reflected on profile', profileAfterEquip.data.active_title === 'Penguasa Pantura');
  const doubleBuy = await req('POST', '/api/store/buy', { itemId: 'title-pantura' });
  check('double purchase rejected', doubleBuy.status === 400);

  // Top-up + webhook signature + idempotency
  const topup = await req('POST', '/api/store/topup/initiate', { packageId: 'pkg-1', idempotencyKey: `smoke-${Date.now()}` });
  check('POST topup initiate', topup.status === 200 && topup.data.status === 'pending');
  const paid = await req('POST', '/api/store/topup/simulate-payment', { orderId: topup.data.orderId });
  check('POST simulate payment (HMAC)', paid.status === 200 && paid.data.status === 'paid' && !!paid.data.signature);
  const paidAgain = await req('POST', '/api/store/topup/simulate-payment', { orderId: topup.data.orderId });
  check('duplicate webhook idempotent', paidAgain.status === 200 && paidAgain.data.alreadyProcessed === true);
  const badSig = await req('POST', '/api/store/topup/webhook', {
    orderId: topup.data.orderId, status: 'paid', signature: 'deadbeef'
  });
  check('webhook rejects invalid signature', badSig.status === 400);

  // Safety / SOS
  const sos = await req('POST', '/api/safety/sos/trigger', { lat: -6.2088, lon: 106.8229 });
  check('POST SOS trigger', sos.status === 200 && sos.data.status === 'ACTIVE_EMERGENCY' && sos.data.emergencyNumbers.length >= 4);
  const sosActive = await req('GET', '/api/safety/sos/active');
  check('GET active SOS sessions', sosActive.status === 200 && sosActive.data.length >= 1);
  const sosResolve = await req('POST', '/api/safety/sos/resolve', { sessionId: sos.data.sessionId });
  check('POST SOS resolve', sosResolve.status === 200 && sosResolve.data.success);

  // Privacy
  const privacy = await req('POST', '/api/user/privacy', {
    privacyMode: 'public', fuzzyRadiusMeters: 300, homeLat: -6.21, homeLon: 106.82
  });
  check('POST privacy update', privacy.status === 200 && privacy.data.fuzzy_radius_meters === 300);
  const preview = await req('POST', '/api/user/privacy/preview', { lat: -6.2102, lon: 106.8202 });
  check('privacy preview masks inside zone', preview.status === 200 && preview.data.isMasked === true);
  const ghost = await req('POST', '/api/user/privacy', { privacyMode: 'ghost' });
  const ghostPreview = await req('POST', '/api/user/privacy/preview', { lat: -6.21, lon: 106.82 });
  check('ghost mode hides location', ghostPreview.data.isHidden === true);
  await req('POST', '/api/user/privacy', { privacyMode: 'public' });

  // Civic
  const civic = await req('GET', '/api/civic/announcements');
  check('GET civic announcements', civic.status === 200 && civic.data.length >= 3);
  const civicPost = await req('POST', '/api/civic/announcements', {
    sourceAgency: 'Dishub DKI Jakarta',
    category: 'traffic_regulation',
    headline: 'Uji Siaran Resmi',
    details: 'Pengujian kanal B2G.',
    affectedArea: 'Jakarta',
    lat: -6.2,
    lon: 106.82,
    severity: 'info'
  });
  check('POST civic announcement', civicPost.status === 201);

  // Admin
  const admin = await req('GET', '/api/admin/overview');
  check('GET admin overview', admin.status === 200 && admin.data.stats.totalUsers >= 4 && Array.isArray(admin.data.tickets));

  const reportToModerate = admin.data.pendingReports[0] || created.data.report;
  const moderate = await req('POST', `/api/admin/reports/${reportToModerate.id}/moderate`, { status: 'verified' });
  check('POST admin moderate report', moderate.status === 200 && moderate.data.report.status === 'verified');
  const badModerate = await req('POST', `/api/admin/reports/${reportToModerate.id}/moderate`, { status: 'nonsense' });
  check('admin rejects invalid moderation status', badModerate.status === 400);

  const audit = await req('GET', '/api/admin/audit-logs');
  check('GET audit logs', audit.status === 200 && audit.data.length >= 3);

  // Upload
  const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const upload = await req('POST', '/api/upload', { dataUrl: png1x1 });
  check('POST evidence upload', upload.status === 201 && upload.data.url.startsWith('/uploads/'));
  const badUpload = await req('POST', '/api/upload', { dataUrl: 'data:text/plain;base64,aGVsbG8=' });
  check('upload rejects unsupported mime', badUpload.status === 400);
  const spoofUpload = await req('POST', '/api/upload', { dataUrl: 'data:image/png;base64,aGVsbG8=' });
  check('upload rejects spoofed image bytes', spoofUpload.status === 400);

  // UU PDP
  const exported = await req('GET', '/api/user/export');
  check('GET user data export', exported.status === 200 && exported.data.profile);

  // PWA assets
  const manifestRes = await fetch(BASE + '/manifest.json');
  const manifest = await manifestRes.json();
  check('GET PWA manifest', manifestRes.status === 200 && manifest.short_name === 'NEXMAP' && Array.isArray(manifest.icons));
  const swRes = await fetch(BASE + '/sw.js');
  check('GET service worker', swRes.status === 200 && (await swRes.text()).includes('CACHE_NAME'));
  const offlineRes = await fetch(BASE + '/offline.html');
  check('GET offline page', offlineRes.status === 200 && (await offlineRes.text()).includes('offline'));
  const iconRes = await fetch(BASE + '/icons/icon.svg');
  check('GET PWA icon', iconRes.status === 200 && (iconRes.headers.get('content-type') || '').includes('svg'));

  // 404 handler
  const notFound = await req('GET', '/api/does-not-exist');
  check('API 404 handler', notFound.status === 404 && !!notFound.data.error);

  console.log('\n======================================');
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach(f => console.log(' - ' + f));
    process.exitCode = 1;
  }
  console.log('======================================');
}

run()
  .then(shutdown)
  .catch(async err => {
    console.error('SMOKE TEST CRASHED:', err);
    await shutdown();
    process.exit(1);
  });
