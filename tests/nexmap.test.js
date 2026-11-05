const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const db = require('../database/db');
const seedDatabase = require('../database/seed');
const GamificationService = require('../src/services/gamificationService');
const TrustEngine = require('../src/services/trustEngine');
const PaymentService = require('../src/services/paymentService');
const SafetyService = require('../src/services/safetyService');
const CivicService = require('../src/services/civicService');

test.before(() => {
  seedDatabase();
});

test('1. Gamification Engine: Level and XP Curve Calculation', () => {
  // Test Level 1
  assert.equal(GamificationService.getLevelFromXp(0), 1);
  assert.equal(GamificationService.getLevelFromXp(50), 1);

  // Test Level 2 requirement: 100 * (2 ^ 1.65) = ~313 XP
  const xpLevel2 = GamificationService.getXpForLevel(2);
  assert.ok(xpLevel2 >= 300 && xpLevel2 <= 325, `Expected ~313 XP, got ${xpLevel2}`);

  // Test rank tiers
  assert.equal(GamificationService.getRankTier(1).rank, 'Beginner');
  assert.equal(GamificationService.getRankTier(8).rank, 'Explorer');
  assert.equal(GamificationService.getRankTier(15).rank, 'Traveler');
  assert.equal(GamificationService.getRankTier(25).rank, 'Adventurer');
  assert.equal(GamificationService.getRankTier(35).rank, 'Pathfinder');
  assert.equal(GamificationService.getRankTier(80).rank, 'Legendary');
});

test('2. Anti-Cheat Engine: Trip Plausibility Checks', () => {
  // Valid normal commute
  const normalTrip = GamificationService.validateTrip({
    distanceKm: 8.5,
    durationMins: 20,
    maxSpeedKmh: 65,
    mockFlag: false,
    accelMps2: 2.1
  });
  assert.equal(normalTrip.isValid, true);
  assert.equal(normalTrip.flags.length, 0);

  // Spoofed trip with mock location
  const mockTrip = GamificationService.validateTrip({
    distanceKm: 15.0,
    durationMins: 15,
    maxSpeedKmh: 70,
    mockFlag: true,
    accelMps2: 1.5
  });
  assert.equal(mockTrip.isValid, false);
  assert.ok(mockTrip.flags.includes('MOCK_LOCATION_ACTIVE'));

  // Speed anomaly (> 180 km/h)
  const speedAnomalyTrip = GamificationService.validateTrip({
    distanceKm: 25.0,
    durationMins: 10,
    maxSpeedKmh: 240,
    mockFlag: false,
    accelMps2: 3.0
  });
  assert.equal(speedAnomalyTrip.isValid, false);
  assert.ok(speedAnomalyTrip.flags.includes('EXCESSIVE_SPEED_LIMIT_EXCEEDED'));

  // Teleportation acceleration anomaly (> 20 m/s^2)
  const teleportTrip = GamificationService.validateTrip({
    distanceKm: 50.0,
    durationMins: 5,
    maxSpeedKmh: 120,
    mockFlag: false,
    accelMps2: 25.0
  });
  assert.equal(teleportTrip.isValid, false);
  assert.ok(teleportTrip.flags.includes('UNNATURAL_ACCELERATION_TELEPORT'));
});

test('3. Trust Engine: Bayesian Scoring & Report Lifecycle', () => {
  const reportId = 'rep-test-01';
  db.run(
    `INSERT OR REPLACE INTO live_reports (
      id, user_id, author_name, category, title, description,
      lat, lon, road_name, status, confidence_score, confirmations,
      denials, image_url, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0.5, 0, 0, '', ?, ?)`,
    [
      reportId,
      'usr-demo-001',
      'Tester',
      'accident',
      'Kecelakaan Tes',
      'Deskripsi tes',
      -6.2088,
      106.8229,
      'Jl. Sudirman',
      Date.now() + 3600000,
      Date.now()
    ]
  );

  // Cast positive consensus vote within 500m
  const voteResult = TrustEngine.castVote({
    reportId,
    userId: 'usr-top-001',
    voteType: 'still_happening',
    voterLat: -6.2090,
    voterLon: 106.8230
  });

  assert.ok(voteResult.confidenceScore > 0.5);
  assert.equal(voteResult.confirmations, 1);

  // Distance check failure: voter is 50km away in Bogor
  assert.throws(() => {
    TrustEngine.castVote({
      reportId,
      userId: 'usr-top-002',
      voteType: 'still_happening',
      voterLat: -6.5950,
      voterLon: 106.8166
    });
  }, /terlalu jauh/);
});

test('4. Payment Engine: Idempotent Top-Up & Webhook Reconciliation', () => {
  const idemKey = `idem-test-${Date.now()}`;
  const init = PaymentService.initiateTopup({
    userId: 'usr-demo-001',
    packageId: 'pkg-1',
    paymentMethod: 'qris',
    idempotencyKey: idemKey
  });

  assert.equal(init.status, 'pending');
  assert.equal(init.gemsAwarded, 100);

  // Calling again with same idempotency key should return same record
  const secondCall = PaymentService.initiateTopup({
    userId: 'usr-demo-001',
    packageId: 'pkg-1',
    paymentMethod: 'qris',
    idempotencyKey: idemKey
  });
  assert.equal(secondCall.orderId, init.orderId);

  // Process Webhook (success)
  const webhookResult = PaymentService.processWebhook({
    orderId: init.orderId,
    status: 'paid'
  });
  assert.equal(webhookResult.status, 'paid');

  // Second duplicate webhook call should be idempotent (no double crediting)
  const duplicateWebhook = PaymentService.processWebhook({
    orderId: init.orderId,
    status: 'paid'
  });
  assert.equal(duplicateWebhook.alreadyProcessed, true);
});

test('5. Safety Center: Emergency SOS & UU PDP Privacy Masking', () => {
  // SOS trigger
  const sos = SafetyService.triggerSos({
    userId: 'usr-demo-001',
    lat: -6.2088,
    lon: 106.8229,
    userNote: 'Butuh bantuan segera!'
  });

  assert.ok(sos.sessionId.startsWith('sos-'));
  assert.equal(sos.status, 'ACTIVE_EMERGENCY');
  assert.ok(sos.offlineSmsText.includes('NEXMAP SOS'));
  assert.ok(sos.emergencyNumbers.some(e => e.number === '110'));

  // Privacy Zone Masking (UU PDP)
  const homeLat = -6.2100;
  const homeLon = 106.8200;
  // User is only 50 meters from home -> inside 300m privacy zone
  const maskedResult = SafetyService.maskCoordinatesIfInPrivateZone(
    'usr-demo-001',
    -6.2102,
    106.8202,
    homeLat,
    homeLon
  );
  assert.equal(maskedResult.isMasked, true);
  assert.notEqual(maskedResult.lat, -6.2102); // Obfuscated
});

test('6. Civic Intelligence: Congestion Index (ACI)', () => {
  // Fast road: 55 km/h on 60 km/h road (ACI = 0.92 -> Lancar)
  const freeFlow = CivicService.calculateAci(55, 60);
  assert.equal(freeFlow.label, 'Lancar');

  // Moderate congestion: 25 km/h on 60 km/h road (ACI = 0.42 -> Padat)
  const moderate = CivicService.calculateAci(25, 60);
  assert.equal(moderate.label, 'Padat');

  // Heavy Gridlock: 8 km/h on 60 km/h road (ACI = 0.13 -> Macet Total)
  const gridlock = CivicService.calculateAci(8, 60);
  assert.equal(gridlock.label, 'Macet Total (Gridlock)');
});
