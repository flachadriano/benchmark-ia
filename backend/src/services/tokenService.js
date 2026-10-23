// Serviço de JWT (HS256, stateless).
// signToken embute sub (uid), email e perfil no payload — base de autorização.
// verifyToken lança se inválido/expirado (tratado pelo middleware auth -> 401).
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signToken(user) {
  return jwt.sign(
    { sub: user.uid, email: user.email, perfil: user.perfil },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
