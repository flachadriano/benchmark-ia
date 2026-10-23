const { checkDatabase } = require('../services/healthService');

// Factory: o pool é injetado para permitir testes determinísticos (DI).
// Em produção, app.js passa o pool real (src/db/client).
function createHealthController(pool) {
  async function health(_req, res) {
    try {
      await checkDatabase(pool);
      return res.status(200).json({ status: 'ok', db: 'up' });
    } catch (err) {
      console.error('[health] banco indisponível:', err.message);
      return res.status(503).json({ status: 'degraded', db: 'down' });
    }
  }
  return { health };
}

module.exports = { createHealthController };

