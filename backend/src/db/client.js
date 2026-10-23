const { Pool } = require('pg');
const env = require('../config/env');

// Prefere DATABASE_URL; caso contrário usa as variáveis PG* (padrão do node-postgres).
const pool = new Pool({
  ...env.databaseConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] erro inesperado no pool de conexões:', err.message);
});

module.exports = pool;
