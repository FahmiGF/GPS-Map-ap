const db = require('../database/db');
console.log('tables:', db.all("SELECT name FROM sqlite_master WHERE type='table'").map(r => r.name).join(', '));
console.log('store cols:', db.all('PRAGMA table_info(store_items)').map(c => c.name).join(', '));
console.log('users cols:', db.all('PRAGMA table_info(users)').map(c => c.name).join(', '));
