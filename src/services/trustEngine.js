const db = require('../../database/db');

/**
 * Weights per incident category
 */
const CATEGORY_WEIGHTS = {
  accident: 1.5,
  flood: 1.4,
  road_closure: 1.3,
  fallen_tree: 1.2,
  road_damage: 1.0,
  traffic_jam: 1.0,
  broken_traffic_light: 1.0,
  vehicle_breakdown: 0.9,
  weather_hazard: 1.2,
  other: 0.8
};

const VALID_VOTE_TYPES = ['still_happening', 'resolved', 'fake'];

/**
 * Trust Engine handles Bayesian Consensus Scoring & Verification Lifecycle
 */
const TrustEngine = {
  CATEGORY_WEIGHTS,
  VALID_VOTE_TYPES,

  /**
   * Recalculates confidence score and transitions state of a report
   */
  evaluateReport(reportId) {
    const report = db.get('SELECT * FROM live_reports WHERE id = ?', [reportId]);
    if (!report) return null;

    const reporter = db.get('SELECT reputation_score FROM users WHERE id = ?', [report.user_id]) || {
      reputation_score: 0.5
    };

    const categoryWeight = CATEGORY_WEIGHTS[report.category] || 1.0;
    const baseScore = reporter.reputation_score * categoryWeight;

    const votes = db.all(
      `SELECT rv.*, u.reputation_score
       FROM report_votes rv
       LEFT JOIN users u ON rv.user_id = u.id
       WHERE rv.report_id = ?`,
      [reportId]
    );

    let confirmations = 0;
    let denials = 0;
    let resolvedVotes = 0;
    let voteImpact = 0;

    for (const v of votes) {
      const rep = v.reputation_score || 0.5;
      if (v.vote_type === 'still_happening') {
        confirmations++;
        voteImpact += 0.8 * rep;
      } else if (v.vote_type === 'fake') {
        denials++;
        voteImpact -= 1.2 * rep;
      } else if (v.vote_type === 'resolved') {
        resolvedVotes++;
        voteImpact -= 0.6 * rep;
      }
    }

    const totalScore = Math.max(0, Number((baseScore + voteImpact).toFixed(2)));

    let newStatus = report.status;
    const now = Date.now();

    if (report.expires_at < now) {
      newStatus = 'expired';
    } else if (denials >= 3 && denials > confirmations) {
      newStatus = 'rejected';
    } else if (resolvedVotes >= 2 && resolvedVotes >= confirmations) {
      newStatus = 'resolved';
    } else if (totalScore >= 2.0 || confirmations >= 3) {
      newStatus = 'verified';
    } else if (totalScore >= 1.0) {
      newStatus = 'active';
    } else {
      newStatus = 'pending';
    }

    db.run(
      `UPDATE live_reports
       SET confidence_score = ?, confirmations = ?, denials = ?, status = ?
       WHERE id = ?`,
      [totalScore, confirmations, denials, newStatus, reportId]
    );

    return {
      reportId,
      confidenceScore: totalScore,
      confirmations,
      denials,
      resolvedVotes,
      status: newStatus
    };
  },

  /**
   * Mark all past-expiry reports as expired. Called periodically by the server.
   */
  sweepExpired() {
    const now = Date.now();
    const rows = db.all(
      "SELECT id FROM live_reports WHERE status IN ('pending', 'active', 'verified') AND expires_at < ?",
      [now]
    );
    for (const r of rows) {
      this.evaluateReport(r.id);
    }
    return rows.length;
  },

  /**
   * Cast a community vote on a report with distance validation
   */
  castVote({ reportId, userId, voteType, voterLat, voterLon }) {
    if (!VALID_VOTE_TYPES.includes(voteType)) {
      throw new Error('Tipe suara verifikasi tidak valid');
    }

    const report = db.get('SELECT * FROM live_reports WHERE id = ?', [reportId]);
    if (!report) {
      throw new Error('Laporan tidak ditemukan');
    }

    if (report.expires_at < Date.now()) {
      throw new Error('Laporan sudah kedaluwarsa dan tidak dapat diverifikasi');
    }

    // Geofence: voter must be within 2 km of the incident
    if (voterLat != null && voterLon != null) {
      const distance = db.haversineDistanceMeters(voterLat, voterLon, report.lat, report.lon);
      if (distance > 2000) {
        throw new Error(`Anda terlalu jauh (${(distance / 1000).toFixed(1)} km) untuk memverifikasi laporan ini`);
      }
    }

    const existing = db.get(
      'SELECT id FROM report_votes WHERE report_id = ? AND user_id = ?',
      [reportId, userId]
    );

    if (existing) {
      db.run('UPDATE report_votes SET vote_type = ?, voter_lat = ?, voter_lon = ?, created_at = ? WHERE id = ?', [
        voteType,
        voterLat || null,
        voterLon || null,
        Date.now(),
        existing.id
      ]);
    } else {
      db.run(
        `INSERT INTO report_votes (id, report_id, user_id, vote_type, voter_lat, voter_lon, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `vote-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          reportId,
          userId,
          voteType,
          voterLat || null,
          voterLon || null,
          Date.now()
        ]
      );

      // Reward valid new verifications once (avoid farming by flipping votes)
      const GamificationService = require('./gamificationService');
      GamificationService.addXp(userId, 5, 'vote_report');
      require('./missionService').progress(userId, 'verify', 1);
    }

    return this.evaluateReport(reportId);
  }
};

module.exports = TrustEngine;
