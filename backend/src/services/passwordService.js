// Serviço de senhas: hash e comparação com bcrypt.
// bcryptjs (pure JS) dispensa compilação nativa no contêiner Alpine.
// BCRYPT_SALT é interpretado como fator de custo (rounds) do bcrypt.
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const SALT_ROUNDS = Number(env.BCRYPT_SALT) || 10;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

// Comparação em tempo constante (evita timing attack).
function comparePassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

module.exports = { hashPassword, comparePassword };
