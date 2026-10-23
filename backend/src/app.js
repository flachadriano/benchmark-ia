const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const { createHealthRouter } = require('./routes/health');
const { createAuthRouter } = require('./routes/auth');

const openapiPath = path.join(__dirname, 'docs', 'openapi.yaml');
const openapiDocument = yaml.load(fs.readFileSync(openapiPath, 'utf8'));

// Composition root: monta a aplicação Express e injeta as dependências.
// `pool` é opcional — quando omitido, usa o pool real (src/db/client).
// Em testes, passa-se um pool falso para evitar conexão com o banco.
function createApp({ pool: injectedPool } = {}) {
  const app = express();
  const db = injectedPool || require('./db/client');

  // CORS (frontend -> backend)
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  // Documentação OpenAPI / Swagger UI
  app.get('/openapi.json', (_req, res) => res.json(openapiDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

  // Rotas de infraestrutura (pool injetado)
  app.use(createHealthRouter(db));

  // Rotas de autenticação (feature 003): /api/auth/login, /api/auth/me
  app.use('/api/auth', createAuthRouter(db));

  // Base da API (domínio). As rotas de domínio (features 004-007) serão
  // montadas sob o prefixo /api a partir das próximas features.
  app.get('/api', (_req, res) =>
    res.json({ name: 'benchmark-api', version: '1.0.0', docs: '/api-docs' })
  );

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // Erros: usa err.status (definido pelos middlewares/controllers) ou 500,
  // e responde sempre { "error": "<mensagem>" } (não vaza stack em produção).
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('[app] erro:', err.message);
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { createApp, openapiDocument };

