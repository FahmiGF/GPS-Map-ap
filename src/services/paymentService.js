const crypto = require('node:crypto');
const db = require('../../database/db');

const TOPUP_PACKAGES = [
  { id: 'pkg-1', name: 'Starter', priceIdr: 10000, gems: 100, bonus: '0%' },
  { id: 'pkg-2', name: 'Basic', priceIdr: 25000, gems: 260, bonus: '+4%' },
  { id: 'pkg-3', name: 'Standard', priceIdr: 50000, gems: 550, bonus: '+10%' },
  { id: 'pkg-4', name: 'Premium', priceIdr: 100000, gems: 1200, bonus: '+20%' },
  { id: 'pkg-5', name: 'Ultimate', priceIdr: 250000, gems: 3200, bonus: '+28%' }
];

// In production this comes from an environment/secret manager, never source control.
const WEBHOOK_SECRET = process.env.NEXMAP_WEBHOOK_SECRET || 'NEXMAP_DEV_WEBHOOK_SECRET_9921';

const VEHICLE_TYPE_BY_ITEM = {
  'veh-hoverbike': 'motorcycle',
  'veh-sportscar': 'car'
};

const PaymentService = {
  TOPUP_PACKAGES,
  WEBHOOK_SECRET,

  /**
   * HMAC SHA-256 signature over `${orderId}:${status}`.
   */
  signWebhook(orderId, status = 'paid', secret = WEBHOOK_SECRET) {
    return crypto.createHmac('sha256', secret).update(`${orderId}:${status}`).digest('hex');
  },

  /**
   * Initiate a Top-Up order (QRIS or Virtual Account). Idempotent by key.
   */
  initiateTopup({ userId, packageId, paymentMethod = 'qris', idempotencyKey }) {
    const pkg = TOPUP_PACKAGES.find(p => p.id === packageId);
    if (!pkg) throw new Error('Paket top-up tidak valid');

    const method = paymentMethod === 'va' ? 'va' : 'qris';
    const key = idempotencyKey || `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const existing = db.get('SELECT * FROM topup_transactions WHERE idempotency_key = ?', [key]);
    if (existing) {
      return {
        orderId: existing.order_id,
        amountIdr: existing.amount_idr,
        gemsAwarded: existing.gems_awarded,
        paymentMethod: existing.payment_method,
        qrisPayload: existing.qris_payload,
        idempotencyKey: existing.idempotency_key,
        status: existing.payment_status
      };
    }

    const orderId = `NEX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let qrisPayload = '';
    let vaNumber = '';
    if (method === 'qris') {
      qrisPayload = `00020101021226600016ID.CO.NEXMAP.WWW011893600998${orderId}520458125303360540${pkg.priceIdr}5802ID5906NEXMAP6007JAKARTA6304ABCD`;
    } else {
      vaNumber = `88099${Math.floor(10000000 + Math.random() * 90000000)}`;
    }

    db.run(
      `INSERT INTO topup_transactions (
        order_id, user_id, amount_idr, gems_awarded, payment_method,
        payment_status, qris_payload, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [orderId, userId, pkg.priceIdr, pkg.gems, method, qrisPayload || vaNumber, key, Date.now()]
    );

    return {
      orderId,
      amountIdr: pkg.priceIdr,
      gemsAwarded: pkg.gems,
      paymentMethod: method,
      qrisPayload,
      vaNumber,
      idempotencyKey: key,
      status: 'pending'
    };
  },

  /**
   * Process a payment webhook with signature verification (optional strict mode)
   * and idempotent wallet crediting.
   */
  processWebhook({ orderId, status = 'paid', signature = null, strict = false }) {
    const tx = db.get('SELECT * FROM topup_transactions WHERE order_id = ?', [orderId]);
    if (!tx) throw new Error('Transaksi order_id tidak ditemukan');

    if (strict) {
      if (!signature) throw new Error('Signature webhook wajib disertakan');
      const expected = this.signWebhook(orderId, status);
      const a = Buffer.from(String(signature));
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error('Signature webhook tidak valid');
      }
    } else if (signature) {
      const expected = this.signWebhook(orderId, status);
      if (signature !== expected) throw new Error('Signature webhook tidak valid');
    }

    if (tx.payment_status === 'paid') {
      return { success: true, message: 'Transaksi sudah dibayar sebelumnya (idempotent)', alreadyProcessed: true };
    }

    if (status === 'paid') {
      db.run(
        "UPDATE topup_transactions SET payment_status = 'paid', paid_at = ? WHERE order_id = ?",
        [Date.now(), orderId]
      );
      db.run('UPDATE users SET nex_gems = nex_gems + ? WHERE id = ?', [tx.gems_awarded, tx.user_id]);

      return { success: true, orderId, gemsAwarded: tx.gems_awarded, status: 'paid' };
    }

    db.run("UPDATE topup_transactions SET payment_status = 'failed' WHERE order_id = ?", [orderId]);
    return { success: false, status: 'failed' };
  },

  /**
   * Purchase a cosmetic item from NEX Store.
   */
  purchaseItem(userId, itemId) {
    const item = db.get('SELECT * FROM store_items WHERE id = ? AND is_active = 1', [itemId]);
    if (!item) throw new Error('Item toko tidak ditemukan atau tidak aktif');

    const user = db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User tidak ditemukan');

    const owned = db.get('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?', [userId, itemId]);
    if (owned) throw new Error('Anda sudah memiliki item ini');

    if (item.currency_type === 'coins') {
      if (user.nex_coins < item.price) {
        throw new Error(`NEX Coins tidak cukup. Dibutuhkan: ${item.price}, Saldo: ${user.nex_coins}`);
      }
      db.run('UPDATE users SET nex_coins = nex_coins - ? WHERE id = ?', [item.price, userId]);
    } else {
      if (user.nex_gems < item.price) {
        throw new Error(`NEX Gems tidak cukup. Dibutuhkan: ${item.price}, Saldo: ${user.nex_gems}`);
      }
      db.run('UPDATE users SET nex_gems = nex_gems - ? WHERE id = ?', [item.price, userId]);
    }

    db.run(
      `INSERT INTO user_inventory (id, user_id, item_id, is_equipped, purchased_at)
       VALUES (?, ?, ?, 0, ?)`,
      [`inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, userId, itemId, Date.now()]
    );

    return {
      success: true,
      purchasedItem: item,
      remainingCoins: item.currency_type === 'coins' ? user.nex_coins - item.price : user.nex_coins,
      remainingGems: item.currency_type === 'gems' ? user.nex_gems - item.price : user.nex_gems
    };
  },

  /**
   * Equip an owned cosmetic item.
   */
  equipItem(userId, itemId) {
    const item = db.get('SELECT * FROM store_items WHERE id = ?', [itemId]);
    if (!item) throw new Error('Item tidak ditemukan');

    const inv = db.get('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?', [userId, itemId]);
    if (!inv) throw new Error('Item belum Anda beli');

    const sameCategory = db.all(
      `SELECT ui.item_id FROM user_inventory ui
       JOIN store_items si ON si.id = ui.item_id
       WHERE ui.user_id = ? AND si.category = ?`,
      [userId, item.category]
    );
    for (const row of sameCategory) {
      db.run('UPDATE user_inventory SET is_equipped = 0 WHERE user_id = ? AND item_id = ?', [userId, row.item_id]);
    }
    db.run('UPDATE user_inventory SET is_equipped = 1 WHERE user_id = ? AND item_id = ?', [userId, itemId]);

    if (item.category === 'map_skin') {
      db.run('UPDATE users SET active_skin = ? WHERE id = ?', [item.id.replace('skin-', ''), userId]);
    } else if (item.category === 'vehicle_icon') {
      const vehicleType = VEHICLE_TYPE_BY_ITEM[item.id] || 'car';
      db.run('UPDATE users SET active_vehicle = ?, active_vehicle_icon = ? WHERE id = ?', [
        vehicleType,
        item.icon,
        userId
      ]);
    } else if (item.category === 'title') {
      db.run('UPDATE users SET active_title = ? WHERE id = ?', [item.name, userId]);
    }

    return { success: true, equippedItem: item };
  },

  getPackages() {
    return TOPUP_PACKAGES;
  }
};

module.exports = PaymentService;
