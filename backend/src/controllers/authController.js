// Controlador de autenticação: POST /api/auth/login e GET /api/auth/me.
// Validação de entrada (e-mail + senha >= 8) feita ANTES de qualquer consulta.
const { createAuthService } = require('../services/authService');
const { signToken } = require('../services/tokenService');

// Validação simples de formato de e-mail (suficiente p/ 400 antes da consulta).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createAuthController(db) {
  const authService = createAuthService(db);

  async function login(req, res, next) {
    try {
      const { email, senha } = req.body || {};

      if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
        const err = new Error('e-mail inválido ou ausente');
        err.status = 400;
        return next(err);
      }
      if (!senha || typeof senha !== 'string' || senha.length < 8) {
        const err = new Error('senha deve ter ao menos 8 caracteres');
        err.status = 400;
        return next(err);
      }

      const user = await authService.login({ email, senha });
      const token = signToken(user);
      return res.status(200).json({ token, user });
    } catch (err) {
      return next(err);
    }
  }

  function me(req, res) {
    const { uid, email, perfil } = req.user;
    return res.status(200).json({ uid, email, perfil });
  }

  return { login, me };
}

module.exports = { createAuthController };
