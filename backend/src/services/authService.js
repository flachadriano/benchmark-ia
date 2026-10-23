// Serviço de domínio: autenticação.
// findByEmail normaliza com lower(email) (mesmo índice único da migration).
// login emite sempre a MESMA mensagem para e-mail inexistente e senha errada
// (evita enumeração de usuários). Usa bcrypt.compare em tempo constante.
const { comparePassword } = require('./passwordService');
const { signToken } = require('./tokenService');

// Mensagem genérica para não distinguir e-mail inexistente de senha incorreta.
const INVALID_CREDENTIALS = 'credenciais inválidas';

function createAuthService(db) {
  async function findByEmail(email) {
    const { rows } = await db.query(
      `SELECT uid, email, senha, perfil FROM "usuários" WHERE lower(email) = lower($1)`,
      [email]
    );
    return rows[0] || null;
  }

  async function login({ email, senha }) {
    const user = await findByEmail(email);
    if (!user) {
      const err = new Error(INVALID_CREDENTIALS);
      err.status = 401;
      throw err;
    }
    const ok = comparePassword(senha, user.senha);
    if (!ok) {
      const err = new Error(INVALID_CREDENTIALS);
      err.status = 401;
      throw err;
    }
    // Nunca expor a senha: retorna apenas o necessário ao token/perfil.
    return { uid: user.uid, email: user.email, perfil: user.perfil };
  }

  return { findByEmail, login };
}

module.exports = { createAuthService };
