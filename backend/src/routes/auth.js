// Rotas de autenticação (feature 003): /api/auth/login e /api/auth/me.
// Pool injetado (mesmo padrão do healthRouter).
const { Router } = require('express');
const { createAuthController } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

function createAuthRouter(db) {
  const router = Router();
  const controller = createAuthController(db);

  router.post('/login', controller.login);
  router.get('/me', auth, controller.me);

  return router;
}

module.exports = { createAuthRouter };
