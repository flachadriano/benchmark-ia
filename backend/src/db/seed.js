// Seed de domínio (feature 003): garante os 2 usuários de demonstração.
// Idempotente via ON CONFLICT (lower(email)) DO NOTHING — reexecução segura.
// `pool` é injetável p/ testes (mesmo padrão do healthService/authService).
const { hashPassword } = require('../services/passwordService');

const USERS = [
  { email: 'usuario@email.com.br', plain: 'usuario123', perfil: 'usuario' },
  { email: 'gestor@gmail.com.br', plain: 'gestor123', perfil: 'gestor' },
];

async function seed(pool) {
  const client = await (pool || require('./client')).connect();
  try {
    await client.query('BEGIN');
    for (const u of USERS) {
      await client.query(
        `INSERT INTO "usuários" (email, senha, perfil)
         VALUES ($1, $2, $3)
         ON CONFLICT (lower(email)) DO NOTHING`,
        [u.email.toLowerCase(), hashPassword(u.plain), u.perfil]
      );
    }
    await client.query('COMMIT');
    console.log('[seed] 2 usuários garantidos (idempotente).');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { seed, USERS };

if (require.main === module) {
  seed()
    .then(() => {
      console.log('[seed] Concluído com sucesso.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed] Erro:', err.message);
      process.exit(1);
    });
}

