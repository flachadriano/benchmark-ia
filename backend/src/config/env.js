const dotenv = require('dotenv');
dotenv.config();

const { cleanEnv, str, num, port } = require('envalid');

const validated = cleanEnv(process.env, {
  NODE_ENV: str({ default: 'development', choices: ['development', 'production', 'test'] }),
  PORT: port({ default: 3000 }),
  DATABASE_URL: str({ default: '' }),
  PGHOST: str({ default: '' }),
  PGPORT: port({ default: 5432 }),
  PGUSER: str({ default: '' }),
  PGPASSWORD: str({ default: '' }),
  PGDATABASE: str({ default: '' }),
  JWT_SECRET: str({ default: '' }), // obrigatório a partir da feature 003
  JWT_EXPIRES_IN: str({ default: '8h' }),
  BCRYPT_SALT: num({ default: 10 }),
  LOG_LEVEL: str({ default: 'info' }),
  CORS_ORIGIN: str({ default: 'http://localhost:8080' }),
});

// Falha rápida se não houver meio de conexão com o banco.
const hasDbUrl = Boolean(validated.DATABASE_URL);
const hasPgVars = Boolean(validated.PGHOST && validated.PGUSER && validated.PGDATABASE);
if (!hasDbUrl && !hasPgVars) {
  throw new Error(
    'Configuração de banco ausente: defina DATABASE_URL ou o conjunto PGHOST/PGUSER/PGPASSWORD/PGDATABASE.'
  );
}

// Aviso preparatório: JWT_SECRET obrigatório a partir da feature 003.
if (validated.NODE_ENV !== 'test' && !validated.JWT_SECRET) {
  console.warn('[env] JWT_SECRET ausente — obrigatório a partir da feature 003 (autenticação JWT).');
}

const databaseConfig = hasDbUrl
  ? { connectionString: validated.DATABASE_URL }
  : {
      host: validated.PGHOST,
      port: validated.PGPORT,
      user: validated.PGUSER,
      password: validated.PGPASSWORD,
      database: validated.PGDATABASE,
    };

const env = {
  NODE_ENV: validated.NODE_ENV,
  PORT: validated.PORT,
  DATABASE_URL: validated.DATABASE_URL,
  PGHOST: validated.PGHOST,
  PGPORT: validated.PGPORT,
  PGUSER: validated.PGUSER,
  PGPASSWORD: validated.PGPASSWORD,
  PGDATABASE: validated.PGDATABASE,
  JWT_SECRET: validated.JWT_SECRET,
  JWT_EXPIRES_IN: validated.JWT_EXPIRES_IN,
  BCRYPT_SALT: validated.BCRYPT_SALT,
  LOG_LEVEL: validated.LOG_LEVEL,
  CORS_ORIGIN: validated.CORS_ORIGIN,
  databaseConfig,
  isProduction: validated.NODE_ENV === 'production',
  isTest: validated.NODE_ENV === 'test',
};

module.exports = Object.freeze(env);
