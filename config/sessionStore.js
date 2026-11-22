// Kho session dùng chung cho Postgres và SQLite
const crypto = require('crypto');
const { Op } = require('sequelize');
const session = require('express-session');
const { Session } = require('../models');

const TTL_MS = 7 * 864e5;
const hash = (sid) => crypto.createHash('sha256').update(sid).digest('hex');
const expiryOf = (s) => (s?.cookie?.expires ? new Date(s.cookie.expires) : new Date(Date.now() + TTL_MS));

class DbStore extends session.Store {
  constructor() {
    super();
    this.touched = new Map();   // không ghi CSDL ở mỗi request chỉ để gia hạn
  }

  get(sid, cb) {
    Session.findByPk(hash(sid))
      .then(row => (row && row.ExpiresAt > new Date() ? JSON.parse(row.Data) : null))
      .then(data => cb(null, data), cb);
  }

  set(sid, data, cb = () => {}) {
    Session.upsert({ SidHash: hash(sid), Data: JSON.stringify(data), ExpiresAt: expiryOf(data) })
      .then(() => cb(null), cb);
  }

  destroy(sid, cb = () => {}) {
    Session.destroy({ where: { SidHash: hash(sid) } }).then(() => cb(null), cb);
  }

  touch(sid, data, cb = () => {}) {
    const key = hash(sid), now = Date.now();
    if (now - (this.touched.get(key) || 0) < 10 * 60e3) return cb(null);
    this.touched.set(key, now);
    Session.update({ ExpiresAt: expiryOf(data) }, { where: { SidHash: key } }).then(() => cb(null), cb);
  }

  async purge() {
    this.touched.clear();
    return Session.destroy({ where: { ExpiresAt: { [Op.lt]: new Date() } } });
  }
}

module.exports = { DbStore, TTL_MS };
