const path = require('node:path');

module.exports = {
  dir: path.join(__dirname, 'migrations'),
  direction: 'up',
  migrationsTable: 'pgmigrations',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bhc',
};
