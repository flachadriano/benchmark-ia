const path = require('path');
const env = require('../config/env');

// node-pg-migrate 7.x é distribuído em CommonJS (type: commonjs), então
// require() funciona diretamente. Mantemos um fallback para import() dinâmico
// caso uma versão futura se torne ESM-only (ERR_REQUIRE_ESM).
async function loadRunner() {
  try {
    const mod = require('node-pg-migrate');
    return mod.default || mod.runner || mod;
  } catch (err) {
    if (err && err.code === 'ERR_REQUIRE_ESM') {
      const mod = await import('node-pg-migrate');
      return mod.default || mod.runner || mod;
    }
    throw err;
  }
}

function connectionOptions() {
  // node-pg-migrate aceita `databaseUrl` como string de conexão OU como
  // objeto de config do pg (ClientConfig). Quando DATABASE_URL está definido
  // (caso do docker-compose), usamos a string; caso contrário, montamos o
  // objeto a partir das variáveis PG*.
  if (env.DATABASE_URL) {
    return { databaseUrl: env.DATABASE_URL };
  }
  return {
    databaseUrl: {
      host: env.PGHOST,
      port: env.PGPORT,
      user: env.PGUSER,
      password: env.PGPASSWORD,
      database: env.PGDATABASE,
    },
  };
}

async function runMigrations(direction = 'up') {
  const migrate = await loadRunner();
  const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
  return migrate({
    ...connectionOptions(),
    direction,
    migrationsTable: 'pgmigrations',
    dir: migrationsDir,
    // Carrega APENAS arquivos .sql como migrations. O node-pg-migrate faz
    // require() de qualquer arquivo cuja extensão não seja .sql (ex.: README.md,
    // .DS_Store), o que causaria SyntaxError. Esta âncora negativa ignora tudo
    // que não termina em .sql, mantendo o diretório de migrations documentável.
    ignorePattern: '(?!.*\\.sql$).+',
    // Logger customizado. O projeto adota a convenção `NNN_nome.sql` (spec §6.2),
    // mas o parser do node-pg-migrate 7.x espera prefixo de timestamp (13/17
    // dígitos) e emite "Can't determine timestamp for NNN" para prefixos
    // sequenciais curtos. Isso é inofensivo — a ordenação usa Number(prefix),
    // que é correta para NNN (001→1, 002→2...) —, então suprimimos apenas essa
    // mensagem específica (prefixo numérico). Erros reais continuam logados.
    logger: {
      debug: () => {},
      info: (msg) => console.log(`[migrate] ${msg}`),
      warn: (msg) => console.warn(`[migrate] WARN ${msg}`),
      error: (msg) => {
        if (typeof msg === 'string' && /Can't determine timestamp for \d+$/.test(msg)) return;
        console.error(`[migrate] ERROR ${msg}`);
      },
    },
  });
}

module.exports = { runMigrations };

// Permite executar via CLI: `node src/db/migrate.js up` (ou `down`).
// Reaproveita o mesmo runner configurado (ignorePattern, logger, databaseUrl),
// mantendo consistência com o migrate automático do server.js.
if (require.main === module) {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  runMigrations(direction)
    .then((r) => {
      console.log(`[migrate-cli] direção=${direction} concluída.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migrate-cli] falha:', err.message);
      process.exit(1);
    });
}

