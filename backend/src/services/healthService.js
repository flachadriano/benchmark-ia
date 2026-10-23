// Serviço de healthcheck. O pool é injetado pelo composition root (app.js),
// o que torna o serviço determinístico em testes (sem conexão real com o banco).
async function checkDatabase(pool) {
  await pool.query('SELECT 1');
  return true;
}

module.exports = { checkDatabase };

