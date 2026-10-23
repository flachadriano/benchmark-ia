const { Router } = require('express');
const { createHealthController } = require('../controllers/healthController');

// Factory: o pool é injetado (DI) para permitir testes sem banco real.
function createHealthRouter(pool) {
  const router = Router();
  const controller = createHealthController(pool);
  router.get('/health', controller.health);
  return router;
}

module.exports = { createHealthRouter };

