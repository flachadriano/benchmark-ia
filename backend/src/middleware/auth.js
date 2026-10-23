// Middlewares de autenticação (JWT Bearer) e autorização por perfil.
// `auth` lê Authorization: Bearer <token>, decodifica o payload e define req.user
// com { uid, email, perfil } para os controladores e para `requirePerfil`.
const { verifyToken } = require('../services/tokenService');

function auth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    const err = new Error('token ausente');
    err.status = 401;
    return next(err);
  }
  try {
    const payload = verifyToken(token);
    req.user = { uid: payload.sub, email: payload.email, perfil: payload.perfil };
    next();
  } catch (e) {
    const err = new Error('token inválido');
    err.status = 401;
    next(err);
  }
}

// `requirePerfil('gestor', ...)` — 401 se não autenticado, 403 se perfil insuficiente.
function requirePerfil(...perfis) {
  return (req, _res, next) => {
    if (!req.user) {
      const err = new Error('não autenticado');
      err.status = 401;
      return next(err);
    }
    if (!perfis.includes(req.user.perfil)) {
      const err = new Error('perfil insuficiente');
      err.status = 403;
      return next(err);
    }
    next();
  };
}

module.exports = { auth, requirePerfil };
