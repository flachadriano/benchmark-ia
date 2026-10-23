const pool = require('./client');

async function seed() {
  const client = await pool.connect();
  try {
    // Verifica se o schema de negócio já existe (definido pelas features 003-007).
    const { rows } = await client.query(
      `SELECT to_regclass('public.usuarios') AS usuarios`
    );
    if (rows[0].usuarios) {
      // A seed de domínio (usuários, apontamentos) é definida pela feature 003.
      console.log('[seed] Tabela de domínio "usuarios" presente — seed de negócio delegada à feature 003.');
    } else {
      console.log('[seed] Nenhum schema de negócio definido nesta feature (002) — nada a semear.');
      console.log('[seed] As seeds de domínio serão adicionadas pelas features 003-007.');
    }
    console.log('[seed] Operação idempotente concluída com sucesso.');
  } finally {
    client.release();
  }
}

seed()
  .then(() => {
    console.log('[seed] Concluído com sucesso.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[seed] Erro:', err.message);
    process.exit(1);
  });
