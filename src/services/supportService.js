const db = require('../../database/db');

/**
 * Help Center: FAQ directory and support ticket flow.
 */
const SupportService = {
  getFaqs({ category = null, q = null } = {}) {
    let sql = 'SELECT * FROM faqs';
    const params = [];
    const where = [];

    if (category && category !== 'all') {
      where.push('category = ?');
      params.push(category);
    }
    if (q) {
      where.push('(question LIKE ? OR answer LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY category, sort_order';

    return db.all(sql, params);
  },

  getFaqCategories() {
    return db.all(
      'SELECT category, COUNT(*) AS count FROM faqs GROUP BY category ORDER BY category'
    );
  },

  createTicket({ userId, subject, message, category = 'general' }) {
    if (!subject || !message) throw new Error('Subjek dan pesan tiket wajib diisi');
    const id = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    db.run(
      `INSERT INTO support_tickets (id, user_id, subject, message, category, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
      [id, userId, subject, message, category, now, now]
    );
    return { id, userId, subject, category, status: 'open', createdAt: now };
  },

  getUserTickets(userId) {
    return db.all(
      'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  },

  replyTicket(ticketId, reply, status = 'answered') {
    const ticket = db.get('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);
    if (!ticket) throw new Error('Tiket tidak ditemukan');
    db.run(
      'UPDATE support_tickets SET admin_reply = ?, status = ?, updated_at = ? WHERE id = ?',
      [reply, status, Date.now(), ticketId]
    );

    require('./notificationService').notify({
      userId: ticket.user_id,
      type: 'ticket',
      title: 'Balasan tiket dukungan',
      body: `Tiket "${ticket.subject}" telah dijawab: ${String(reply).slice(0, 140)}`,
      link: 'help'
    });

    return db.get('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);
  }
};

module.exports = SupportService;
