// Testes de autenticação (feature 003) — cenários 1-15 da spec.
// Usa supertest contra createApp com pool falso (sem banco) e jwt.verify direto.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import { createApp } from '../src/app.js';
import { hashPassword, comparePassword } from '../src/services/passwordService.js';
import { signToken } from '../src/services/tokenService.js';
import { requirePerfil } from '../src/middleware/auth.js';
import env from '../src/config/env.js';

// Usuário-seed com hash real (mesma rotina da seed).
function makeUser(overrides = {}) {
  return {
    uid: 'u-usuario',
    email: 'usuario@email.com.br',
    senha: hashPassword('usuario123'),
    perfil: 'usuario',
    ...overrides,
  };
}

// Pool falso: devolve a linha informada (ou vazio) conforme o e-mail consultado.
function makePoolReturning(row) {
  return {
    query: vi.fn(async () => ({ rows: row ? [row] : [] })),
  };
}

describe('POST /api/auth/login', () => {
  it('1. login do usuário retorna 200 com token decodificável e user correto', async () => {
    const pool = makePoolReturning(makeUser());
    const app = createApp({ pool });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usuario@email.com.br', senha: 'usuario123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    const decoded = jwt.verify(res.body.token, env.JWT_SECRET);
    expect(decoded.sub).toBe('u-usuario');
    expect(decoded.email).toBe('usuario@email.com.br');
    expect(decoded.perfil).toBe('usuario');
    expect(res.body.user).toEqual({
      uid: 'u-usuario',
      email: 'usuario@email.com.br',
      perfil: 'usuario',
    });
  });

  it('2. login do gestor retorna 200 com perfil=gestor no payload', async () => {
    const pool = makePoolReturning(
      makeUser({
        uid: 'u-gestor',
        email: 'gestor@gmail.com.br',
        senha: hashPassword('gestor123'),
        perfil: 'gestor',
      })
    );
    const app = createApp({ pool });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'gestor@gmail.com.br', senha: 'gestor123' });

    expect(res.status).toBe(200);
    const decoded = jwt.verify(res.body.token, env.JWT_SECRET);
    expect(decoded.perfil).toBe('gestor');
  });

  it('3. senha incorreta retorna 401 com mensagem genérica', async () => {
    const pool = makePoolReturning(makeUser());
    const app = createApp({ pool });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usuario@email.com.br', senha: 'senha-errada' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('credenciais inválidas');
  });

  it('4. e-mail inexistente retorna 401 com a MESMA mensagem (sem enumeração)', async () => {
    const pool = makePoolReturning(null);
    const app = createApp({ pool });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@email.com.br', senha: 'usuario123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('credenciais inválidas');
  });

  it('5. e-mail ausente retorna 400 (sem consultar o banco)', async () => {
    const pool = { query: vi.fn() };
    const app = createApp({ pool });
    const res = await request(app).post('/api/auth/login').send({ senha: 'usuario123' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('6. senha ausente retorna 400 (sem consultar o banco)', async () => {
    const pool = { query: vi.fn() };
    const app = createApp({ pool });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usuario@email.com.br' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('7. e-mail em formato inválido retorna 400', async () => {
    const pool = { query: vi.fn() };
    const app = createApp({ pool });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nao-e-email', senha: 'usuario123' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('8. senha com menos de 8 caracteres retorna 400', async () => {
    const pool = { query: vi.fn() };
    const app = createApp({ pool });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usuario@email.com.br', senha: 'short' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
describe('GET /api/auth/me', () => {
  let app;
  beforeEach(() => {
    app = createApp({ pool: { query: vi.fn() } });
  });

  it('9. com token válido retorna 200 { uid, email, perfil }', async () => {
    const token = signToken({
      uid: 'u-usuario',
      email: 'usuario@email.com.br',
      perfil: 'usuario',
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      uid: 'u-usuario',
      email: 'usuario@email.com.br',
      perfil: 'usuario',
    });
  });

  it('10. sem token retorna 401 { error: "token ausente" }', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('token ausente');
  });

  it('11. com token inválido retorna 401 { error: "token inválido" }', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('token inválido');
  });
});

describe('Exposição de senha', () => {
  it('12. nenhuma resposta de login/me contém a chave "senha"', async () => {
    const pool = makePoolReturning(makeUser());
    const app = createApp({ pool });

    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usuario@email.com.br', senha: 'usuario123' });
    expect(resLogin.body.user).not.toHaveProperty('senha');
    expect(JSON.stringify(resLogin.body)).not.toContain('senha');

    const token = signToken({
      uid: 'u-usuario',
      email: 'usuario@email.com.br',
      perfil: 'usuario',
    });
    const resMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(resMe.body).not.toHaveProperty('senha');
    expect(JSON.stringify(resMe.body)).not.toContain('senha');
  });
});

// Helper local p/ montar um app mínimo com requirePerfil (cenários 13-14).
function makePerfilApp(user) {
  const app = express();
  app.get(
    '/rota',
    (req, _res, next) => {
      if (user) req.user = user;
      next();
    },
    requirePerfil('gestor'),
    (_req, res) => res.status(200).json({ ok: true })
  );
  app.use((err, _req, res, _next) =>
    res.status(err.status || 500).json({ error: err.message })
  );
  return app;
}

describe('middleware requirePerfil', () => {
  it('13. requirePerfil("gestor") com perfil=usuario retorna 403', async () => {
    const res = await request(makePerfilApp({ perfil: 'usuario' })).get('/rota');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('perfil insuficiente');
  });

  it('14. requirePerfil("gestor") com perfil=gestor chama next() (200)', async () => {
    const res = await request(makePerfilApp({ perfil: 'gestor' })).get('/rota');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('passwordService (bcrypt)', () => {
  it('15. comparePassword("usuario123", hashPassword("usuario123")) === true', () => {
    expect(comparePassword('usuario123', hashPassword('usuario123'))).toBe(true);
  });

  it('senha incorreta não verifica', () => {
    expect(comparePassword('errada', hashPassword('usuario123'))).toBe(false);
  });
});
