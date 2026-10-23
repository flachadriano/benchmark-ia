const { createApp } = require('./app');
const env = require('./config/env');
const pool = require('./db/client');
const { runMigrations } = require('./db/migrate');

async function start() {
  try {
    // 1. Env já validado no import de src/config/env.js (falha rápida se necessário).
    console.log(`[server] ambiente=${env.NODE_ENV} porta=${env.PORT}`);

    // 2. Conecta e valida o banco (SELECT 1) antes de escutar.
    await pool.query('SELECT 1');
    console.log('[server] conexão com PostgreSQL OK');

    // 3. Executa migrations pendentes.
    await runMigrations('up');
    console.log('[server] migrations verificadas/aplicadas');

    // 4. Inicia o servidor Express.
    const app = createApp();
    app.listen(env.PORT, () => {
      console.log(`[server] API rodando em http://localhost:${env.PORT}`);
      console.log(`[server] Swagger UI em http://localhost:${env.PORT}/api-docs`);
      console.log(`[server] OpenAPI JSON em http://localhost:${env.PORT}/openapi.json`);
    });
  } catch (err) {
    console.error('[server] falha na inicialização:', err.message);
    process.exit(1);
  }
}

start();
