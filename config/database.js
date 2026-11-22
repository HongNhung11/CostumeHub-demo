require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const dialect = process.env.DB_DIALECT || 'postgres';

let sequelize;

if (dialect === 'sqlite') {
  // Chạy nhanh bằng SQLite (không cần cài server CSDL)
  const storage = process.env.SQLITE_STORAGE || './data/costumehub.sqlite';
  const dir = path.dirname(path.resolve(storage));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: false,
  });
} else {
  // PostgreSQL (dùng khi chạy thật / Docker)
  sequelize = new Sequelize(
    process.env.DB_NAME || 'costumehub',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'postgres',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      timezone: '+07:00',
      pool: { max: 20, min: 0, acquire: 30000, idle: 10000 },
      logging: false,
    }
  );
}

module.exports = sequelize;
