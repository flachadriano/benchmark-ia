# Chat — Desenvolvimento da Feature 003 (Autenticação & Perfis)

> Transcrição completa da sessão de implementação da feature 003.

---

## Contexto inicial (resumo fornecido)

### Goal
Implementing feature 003 (authentication & profiles) — JWT login, `/api/auth/me`, bcrypt password hashing, role-based middleware, seed users, OpenAPI docs, and frontend auth flows — per `features/003-autenticacao-perfis/spec.md`.

### State
- **Done:**
  - Backend auth implementation complete: migration `002_create_usuarios.sql` (table `"usuários"` with unique index on `lower(email)`), `passwordService.js` (bcryptjs), `tokenService.js` (JWT HS256), `authService.js` (findByEmail + login with generic 401), `middleware/auth.js` (auth + requirePerfil), `authController.js` (login validation + me), `routes/auth.js` (`/api/auth/login`, `/api/auth/me`).
  - `seed.js` rewritten: idempotent seed of 2 users (usuario@email.com.br / gestor@gmail.com.br), pool injectable for tests.
  - `env.js`: JWT_SECRET now throws (not warns) when missing, except in test env.
  - `app.js`: mounts `/api/auth` router; error handler now uses `err.status` and returns `{ error }` JSON.
  - `openapi.yaml`: added `/api/auth/login`, `/api/auth/me` paths + `UserProfile` and `Error` component schemas.
  - `package.json`: added `bcryptjs` ^2.4.3 and `jsonwebtoken` ^9.0.0 to dependencies.
  - `tests/auth.test.js`: first half written (scenarios 1–8: login success/failure/validation, file ends with `// __SPLIT__` marker).
- **In Progress:** Writing `tests/auth.test.js` — needs second half (scenarios 9–15: `/me` with/without token, password exposure check, `requirePerfil` 403/200, `passwordService` bcrypt verify).
- **Blocked:** `npm install` not yet run (new deps `bcryptjs`, `jsonwebtoken` not installed). Tests cannot execute until installed.

### Highlights
- Table name is `"usuários"` (accented, quoted) per spec — all SQL references must use double quotes.
- Login returns identical 401 message "credenciais inválidas" for wrong password and nonexistent email (no user enumeration).
- `createApp({ pool })` pattern with injected pool enables supertest tests without a real database.
- Test file size limit is 6000 chars per edit — large files must be split across multiple editor calls.
- `BCRYPT_SALT` env var is interpreted as bcrypt cost rounds (default 10).

### Next
1. Append second half of `tests/auth.test.js` (scenarios 9–15) — replace `// __SPLIT__` with `/me` tests, password exposure, `requirePerfil` middleware tests, and `passwordService` unit tests.
2. Create `tests/seed.test.js` (scenarios 16–18: seed idempotency, 2 users present, passwords hashed).
3. Run `npm install` in backend to install `bcryptjs` + `jsonwebtoken`.
4. Run `npm test` in backend — fix any failures.
5. Update `.env.example` and `docker-compose.yml` with `JWT_SECRET` and `JWT_EXPIRES_IN` vars.
6. Implement frontend: `src/apiClient.js` (fetch wrapper + Bearer token + 401 handling), `src/pages/Login.jsx`, update `src/App.jsx` (auth state, login/logout flow), update `src/__tests__/App.test.jsx`, create `src/__tests__/Login.test.jsx` (scenarios 22–24), update `src/index.css` (login styles).
7. Run `npm test` in frontend — fix any failures.

### Files
- **Read:** `backend/package.json`, `backend/src/app.js`, `backend/src/config/env.js`, `backend/src/db/seed.js`, `backend/src/docs/openapi.yaml`
- **Edited:** `backend/migrations/002_create_usuarios.sql` (created), `backend/package.json`, `backend/src/app.js`, `backend/src/config/env.js`, `backend/src/controllers/authController.js` (created), `backend/src/db/seed.js`, `backend/src/docs/openapi.yaml`, `backend/src/middleware/auth.js` (created), `backend/src/routes/auth.js` (created), `backend/src/services/authService.js` (created), `backend/src/services/passwordService.js` (created), `backend/src/services/tokenService.js` (created), `backend/tests/auth.test.js` (created, partial — needs completion)

---


## Passo 1 — Append segunda metade do `tests/auth.test.js`

Agora anexe o restante do arquivo de teste substituindo o marcador de divisão:

```js
// backend/tests/auth.test.js — segunda metade (substitui o marcador // __SPLIT__)

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
```

**Resultado:** `Edited backend/tests/auth.test.js` — marker `// __SPLIT__` substituído pela segunda metade (linhas 131–233). Diff confirma a inserção com sucesso.


## Passo 2 — Criar `tests/seed.test.js` + instalar deps do backend (paralelo)

### Arquivo criado: `backend/tests/seed.test.js`

```js
// Testes da seed (feature 003) — cenários 16-18 da spec.
// Usa pool falso que registra todas as queries emitidas (sem banco).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { seed, USERS } from '../src/db/seed.js';
import { comparePassword } from '../src/services/passwordService.js';

function makeFakePool() {
  const calls = [];
  const client = {
    query: vi.fn(async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) };
  return { pool, client, calls };
}

describe('seed', () => {
  let ctx;
  beforeEach(() => {
    ctx = makeFakePool();
  });

  it('16. seed() emite 2 INSERT ... ON CONFLICT DO NOTHING', async () => {
    await seed(ctx.pool);
    const inserts = ctx.calls.filter((c) => /INSERT INTO/i.test(c.sql));
    expect(inserts.length).toBe(2);
    for (const ins of inserts) {
      expect(ins.sql).toMatch(/INSERT INTO\s+"usuários"/i);
      expect(ins.sql).toMatch(/ON CONFLICT\s*\(\s*lower\s*\(\s*email\s*\)\s*\)\s*DO\s*NOTHING/i);
    }
    const sqls = ctx.calls.map((c) => c.sql);
    expect(sqls).toContain('BEGIN');
    expect(sqls).toContain('COMMIT');
    expect(ctx.client.release).toHaveBeenCalled();
  });

  it('17. reexecutar seed() emite o mesmo número de INSERTs (idempotente)', async () => {
    await seed(ctx.pool);
    const firstCount = ctx.calls.filter((c) => /INSERT INTO/i.test(c.sql)).length;
    await seed(ctx.pool);
    const total = ctx.calls.filter((c) => /INSERT INTO/i.test(c.sql)).length;
    expect(firstCount).toBe(2);
    expect(total).toBe(4); // 2 por execução (idempotência via ON CONFLICT no SQL)
    expect(ctx.pool.connect).toHaveBeenCalledTimes(2);
  });

  it('18. senhas gravadas são hashes bcrypt verificáveis (e texto plano não é gravado)', async () => {
    await seed(ctx.pool);
    const inserts = ctx.calls.filter((c) => /INSERT INTO/i.test(c.sql));
    const byEmail = Object.fromEntries(inserts.map((i) => [i.params[0], i.params]));
    expect(Object.keys(byEmail).length).toBe(2);

    const usuario = byEmail['usuario@email.com.br'];
    const gestor = byEmail['gestor@gmail.com.br'];
    expect(usuario).toBeDefined();
    expect(gestor).toBeDefined();

    expect(comparePassword('usuario123', usuario[1])).toBe(true);
    expect(comparePassword('gestor123', gestor[1])).toBe(true);
    expect(usuario[1]).not.toBe('usuario123');
    expect(gestor[1]).not.toBe('gestor123');
    expect(usuario[2]).toBe('usuario');
    expect(gestor[2]).toBe('gestor');
  });

  it('expõe USERS no formato esperado pela spec', () => {
    expect(USERS.length).toBe(2);
    expect(USERS.map((u) => u.email)).toEqual([
      'usuario@email.com.br',
      'gestor@gmail.com.br',
    ]);
  });
});
```

### Comando: `npm install` no backend

```bash
cd /Users/flachadriano/projects/flachadriano/benchmark-ia/backend && npm install --no-audit --no-fund
```

**Resultado:** `added 16 packages in 1s` — `bcryptjs` e `jsonwebtoken` instalados.

---


## Passo 3 — Rodar testes do backend

```bash
cd /Users/flachadriano/projects/flachadriano/benchmark-ia/backend && npm test
```

**Resultado (tail):**

```
 RUN  v2.1.9 /Users/flachadriano/projects/flachadriano/benchmark-ia/backend

stderr | tests/health.test.js > GET /health > retorna 503 quando o banco está indisponível
[health] banco indisponível: connection refused

 ✓ tests/health.test.js (3 tests) 44ms
stdout | tests/seed.test.js > seed > 16. seed() emite 2 INSERT ... ON CONFLICT DO NOTHING
[seed] 2 usuários garantidos (idempotente).

stdout | tests/seed.test.js > seed > 17. reexecutar seed() emite o mesmo número de INSERTs (idempotente)
[seed] 2 usuários garantidos (idempotente).
[seed] 2 usuários garantidos (idempotente).

stdout | tests/seed.test.js > seed > 18. senhas gravadas são hashes bcrypt verificáveis (e texto plano não é gravado)
[seed] 2 usuários garantidos (idempotente).

 ✓ tests/seed.test.js (4 tests) 719ms
 ✓ tests/auth.test.js (16 tests) 954ms

 Test Files  3 passed (3)
      Tests  23 passed (23)
   Start at  17:37:16
   Duration  1.40s (transform 51ms, setup 10ms, collect 406ms, tests 1.72s, environment 0ms, prepare 214ms)
```

**✅ Backend: 23 testes passaram (health 3, seed 4, auth 16).**

---

## Passo 4 — Ler arquivos do frontend atuais + env/docker-compose (paralelo)

### Arquivos lidos:
- `frontend/src/App.jsx` (106 linhas — painel com healthcheck, sem auth)
- `frontend/src/__tests__/App.test.jsx` (13 linhas — 1 teste: renderiza título)
- `frontend/src/index.css` (166 linhas — estilos do dashboard)
- `frontend/package.json` (React 18, Testing Library, Vitest, sem apiClient)
- `frontend/.env.example` (`VITE_API_URL=http://localhost:3000`)
- `frontend/vitest.config.js` (jsdom, globals)

### Env/infra:
- `docker-compose.yml` — **já contém** `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT` no serviço backend (linhas 34–36). Sem alteração necessária.
- `.env.example` (raiz) — **já contém** `JWT_SECRET=changeme`, `JWT_EXPIRES_IN=8h`, `BCRYPT_SALT=10`. Sem alteração necessária.

---


## Passo 5 — Criar arquivos do frontend (apiClient + Login) em paralelo

### Arquivo criado: `frontend/src/apiClient.js`

```js
// Cliente de API (feature 003): persistência de sessão + wrapper de fetch.
// - login(): POST /api/auth/login (sem token), armazena token+user no localStorage.
// - apiFetch(): injeta Authorization: Bearer para endpoints protegidos; em 401,
//   descarta a sessão e emite 'benchmark:unauthorized' (o App volta à tela de login).
const API_URL = import.meta.env.VITE_API_URL || '';

const TOKEN_KEY = 'benchmark_token';
const USER_KEY = 'benchmark_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Decodifica o payload do JWT (base64url) sem validar a assinatura.
export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('benchmark:unauthorized'));
  }
  return res;
}

export async function login(email, senha) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'credenciais inválidas');
  setSession(data.token, data.user);
  return data;
}
```

### Arquivo criado: `frontend/src/pages/Login.jsx`

```jsx
import { useState } from 'react';
import { login as apiLogin } from '../apiClient';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const data = await apiLogin(email, senha);
      onLogin?.(data.user);
    } catch (err) {
      setErro(err.message || 'credenciais inválidas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot">A</span>
          Apontamento de Horas
        </div>
      </header>

      <main className="content">
        <section className="card hero login-card">
          <h1>Entrar</h1>
          <p className="muted">
            Autentique-se para acessar o sistema de apontamento de horas.
          </p>

          {erro && (
            <p className="alert error" role="alert">
              {erro}
            </p>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field" htmlFor="email">
              <span>E-mail</span>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="field" htmlFor="senha">
              <span>Senha</span>
              <input
                id="senha"
                type="password"
                name="senha"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </label>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Entrando…' : 'Login'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
```

---


## Passo 6 — Reescrever `App.jsx` + atualizar `App.test.jsx` + criar `Login.test.jsx` + CSS (paralelo)

### Arquivo reescrito: `frontend/src/App.jsx`

```jsx
import { useEffect, useState, useCallback } from 'react';
import Login from './pages/Login';
import {
  getToken,
  getUser,
  clearSession,
  apiFetch,
  setSession,
} from './apiClient';

const API_URL = import.meta.env.VITE_API_URL || '';

const STATUS = {
  checking: { label: 'Verificando API…', cls: 'warn' },
  ok: { label: 'API online', cls: 'ok' },
  degraded: { label: 'API online (banco indisponível)', cls: 'warn' },
  unreachable: { label: 'API offline', cls: 'err' },
};

function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const [user, setUser] = useState(() => getUser());
  const [health, setHealth] = useState({ status: 'checking', db: '?' });

  // Healthcheck (feature 002), só quando autenticado.
  useEffect(() => {
    if (!authed) return;
    if (!API_URL) {
      setHealth({ status: 'unreachable', db: 'down' });
      return;
    }
    let active = true;
    async function check() {
      try {
        const res = await fetch(`${API_URL}/health`);
        const data = await res.json();
        if (active) setHealth(data);
      } catch (err) {
        if (active) setHealth({ status: 'unreachable', db: 'down' });
      }
    }
    check();
    const id = setInterval(check, 10000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [authed]);

  // Valida o token no boot via /api/auth/me e atualiza o perfil (feature 007).
  useEffect(() => {
    if (!authed) return;
    let active = true;
    (async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setSession(getToken(), data);
          setUser(data);
        }
      } catch {
        // erro de rede: mantém a sessão armazenada (tolerante a offline)
      }
    })();
    return () => {
      active = false;
    };
  }, [authed]);

  // Logout forçado pelo apiClient (401 em endpoint protegido).
  useEffect(() => {
    function handleUnauthorized() {
      setAuthed(false);
      setUser(null);
    }
    window.addEventListener('benchmark:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('benchmark:unauthorized', handleUnauthorized);
  }, []);

  const handleLogin = useCallback((u) => {
    setAuthed(true);
    setUser(u);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setAuthed(false);
    setUser(null);
  }, []);

  if (!authed) {
    return <Login onLogin={handleLogin} />;
  }

  const meta = STATUS[health.status] || STATUS.checking;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot">A</span>
          Apontamento de Horas
        </div>
        <div className="spacer" />
        {user && (
          <span className={`badge ${user.perfil === 'gestor' ? 'ok' : 'warn'}`}>
            <span className="dot-state" /> {user.email} · {user.perfil}
          </span>
        )}
        <button type="button" className="btn btn-primary" onClick={handleLogout}>
          Sair
        </button>
      </header>

      <main className="content">
        <section className="card hero">
          <h1>Sistema de Apontamento de Horas</h1>
          <p className="lead">
            Infraestrutura de base configurada: back-end Node.js + Express, front-end
            React + Vite servido por Nginx e banco PostgreSQL — todos em contêineres
            Docker orquestrados por um único <code>docker-compose.yml</code>.
          </p>
          <p className="muted">
            As funcionalidades de domínio (apontamentos, resumo e visão do gestor)
            são entregues pelas features 004-007. Autenticação e perfis (JWT) já
            disponíveis.
          </p>

          <div className="status-grid">
            <div className="stat">
              <span className="k">Status da API</span>
              <span className="v">{health.status}</span>
            </div>
            <div className="stat">
              <span className="k">Banco de dados</span>
              <span className="v">{health.db}</span>
            </div>
            <div className="stat">
              <span className="k">API URL</span>
              <span className="v small">{API_URL || '(não definido)'}</span>
            </div>
          </div>

          <div className="links">
            <a className="btn btn-primary" href={`${API_URL || ''}/api-docs`} target="_blank" rel="noreferrer">
              Swagger UI
            </a>
            <a className="btn" href={`${API_URL || ''}/openapi.json`} target="_blank" rel="noreferrer">
              OpenAPI JSON
            </a>
          </div>
        </section>

        <section className="card">
          <h2>Próximas features</h2>
          <ul className="features">
            <li><strong>004</strong> — Apontamento de horas</li>
            <li><strong>005</strong> — Regras de negócio</li>
            <li><strong>006</strong> — Resumo e exportação</li>
            <li><strong>007</strong> — Visão do gestor</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;
```

---


### Arquivo atualizado: `frontend/src/__tests__/App.test.jsx`

```jsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => ({
        ok: true,
        status: 200,
        json: async () => {
          if (String(url).includes('/health'))
            return { status: 'ok', db: 'up' };
          if (String(url).includes('/api/auth/me'))
            return { uid: 'u1', email: 'u@x.com', perfil: 'usuario' };
          return {};
        },
      }))
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renderiza a tela de login quando não autenticado', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /login/i })).toBeTruthy();
  });

  it('renderiza o painel principal quando autenticado', async () => {
    localStorage.setItem('benchmark_token', 'fake-token');
    localStorage.setItem(
      'benchmark_user',
      JSON.stringify({ uid: 'u1', email: 'u@x.com', perfil: 'usuario' })
    );
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Sistema de Apontamento de Horas')).toBeTruthy();
    });
  });
});
```

### Arquivo criado: `frontend/src/__tests__/Login.test.jsx`

```jsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../pages/Login';

describe('Login', () => {
  let fetchMock;
  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('22. formulário renderiza email, senha e botão Login', () => {
    render(<Login onLogin={() => {}} />);
    expect(screen.getByLabelText(/e-mail/i)).toBeTruthy();
    expect(screen.getByLabelText(/senha/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /login/i })).toBeTruthy();
  });

  it('23. submit válido chama fetch com POST /api/auth/login e salva o token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'abc.def.ghi',
        user: { uid: 'u1', email: 'u@x.com', perfil: 'usuario' },
      }),
    });

    render(<Login onLogin={() => {}} />);
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'u@x.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'usuario123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      const [url, opts] = fetchMock.mock.calls[0];
      expect(String(url)).toContain('/api/auth/login');
      expect(opts.method).toBe('POST');
      expect(localStorage.getItem('benchmark_token')).toBe('abc.def.ghi');
    });
  });

  it('24. resposta 401 exibe "credenciais inválidas" e não persiste token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'credenciais inválidas' }),
    });

    render(<Login onLogin={() => {}} />);
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'u@x.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'usuario123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/credenciais inválidas/i)).toBeTruthy();
      expect(localStorage.getItem('benchmark_token')).toBeNull();
    });
  });
});
```

### CSS adicionado: `frontend/src/index.css` (após a linha 166)

```css
/* Login (feature 003) */
.login-card { max-width: 420px; margin: 0 auto; }
.login-form { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.field input {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 15px;
  color: var(--text);
  font-family: inherit;
}
.field input:focus {
  outline: 2px solid var(--primary);
  outline-offset: -1px;
  border-color: var(--primary);
}
.alert { padding: 10px 14px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.alert.error { background: #fee2e2; color: #991b1b; }
.login-form .btn { width: 100%; justify-content: center; }
```

---


## Passo 7 — Rodar testes do frontend

```bash
cd /Users/flachadriano/projects/flachadriano/benchmark-ia/frontend && npm test
```

**Resultado (tail):**

```
 RUN  v2.1.9 /Users/flachadriano/projects/flachadriano/benchmark-ia/frontend

 ✓ src/__tests__/App.test.jsx (2 tests) 70ms
 ✓ src/__tests__/Login.test.jsx (3 tests) 98ms

 Test Files  2 passed (2)
      Tests  5 passed (5)
   Start at  17:40:45
   Duration  1.25s (transform 102ms, setup 0ms, collect 370ms, tests 168ms, environment 1.14s, prepare 187ms)
```

**✅ Frontend: 5 testes passaram (App 2, Login 3).**

---

## Passo 8 — Validação final (backend + frontend juntos)

```bash
# Backend
cd /Users/flachadriano/projects/flachadriano/benchmark-ia/backend && npm test
# Frontend
cd /Users/flachadriano/projects/flachadriano/benchmark-ia/frontend && npm test
```

### Backend:

```
 ✓ tests/health.test.js (3 tests) 833ms
 ✓ tests/seed.test.js (4 tests)
   ✓ seed > 17. reexecutar seed() emite o mesmo número de INSERTs (idempotente) 312ms
   ✓ seed > 18. senhas gravadas são hashes bcrypt verificáveis (e texto plano não é gravado) 346ms
 ✓ tests/auth.test.js (16 tests) 1045ms

 Test Files  3 passed (3)
      Tests  23 passed (23)
   Start at  17:41:07
   Duration  1.73s (transform 80ms, setup 8ms, collect 500ms, tests 1.93s, environment 0ms, prepare 307ms)
```

### Frontend:

```
 ✓ src/__tests__/App.test.jsx (2 tests) 68ms
 ✓ src/__tests__/Login.test.jsx (3 tests) 98ms

 Test Files  2 passed (2)
      Tests  5 passed (5)
   Start at  17:41:07
   Duration  1.18s (transform 94ms, setup 0ms, collect 347ms, tests 165ms, environment 918ms, prepare 226ms)
```

**✅ Backend: 23 testes passaram | Frontend: 5 testes passaram — Feature 003 concluída e validada.**

---


## Resumo final da implementação

### Backend — tests + deps
1. **`backend/tests/auth.test.js`** (cenários 9–15): substituiu o marcador `// __SPLIT__`:
   - **9–11** `GET /api/auth/me` — token válido (200 `{uid,email,perfil}`), sem token (401 `token ausente`), token inválido (401 `token inválido`).
   - **12** exposição de senha — nenhuma resposta de login/me contém a chave/substring `senha`.
   - **13–14** `requirePerfil('gestor')` — perfil `usuario` → 403 `perfil insuficiente`; perfil `gestor` → 200.
   - **15** `passwordService` — `comparePassword('usuario123', hashPassword('usuario123'))` é `true`; senha incorreta é `false`.
2. **`backend/tests/seed.test.js`** (cenários 16–18, criado): usa pool falso (sem DB) — verifica 2 `INSERT … ON CONFLICT (lower(email)) DO NOTHING` idempotentes dentro de `BEGIN/COMMIT`, que re-executar emite a mesma contagem, e que as senhas armazenadas são hashes bcrypt (verificáveis, nunca texto plano). Também checa o shape do `USERS` exportado.
3. **`npm install`** — instalou `bcryptjs` + `jsonwebtoken` (16 pacotes).
4. Verificado `.env.example` e `docker-compose.yml` — já conectam `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT` ao serviço backend. Sem alteração necessária.

### Frontend — auth flows
5. **`frontend/src/apiClient.js`** (criado): `getToken/getUser/setSession/clearSession`, `decodeJwt`, `apiFetch` (injeta `Authorization: Bearer`, em 401 limpa sessão + emite `benchmark:unauthorized`), e `login` (POST `/api/auth/login`, armazena token+user, lança em não-ok com `credenciais inválidas`).
6. **`frontend/src/pages/Login.jsx`** (criado): formulário email/senha, mostra `credenciais inválidas` em 401, chama `onLogin(user)` em sucesso.
7. **`frontend/src/App.jsx`** (reescrito): protege o dashboard atrás de auth (mostra `<Login>` quando sem token), valida o token via `/api/auth/me` no boot, escuta `benchmark:unauthorized` para auto-logout, adiciona badge de usuário + botão `Sair`.
8. **`frontend/src/__tests__/App.test.jsx`** (atualizado): tela de login quando não autenticado; dashboard quando um token é semeado no `localStorage` (fetch stubado).
9. **`frontend/src/__tests__/Login.test.jsx`** (criado, cenários 22–24): formulário renderiza campos + botão Login; submit válido chama `POST /api/auth/login` e persiste o token; 401 mostra `credenciais inválidas` e não armazena nada.
10. **`frontend/src/index.css`**: adicionou estilos `.login-card`, `.login-form`, `.field`, `.alert.error`.

### Validação final
- `backend` → **23 testes passaram** (health 3, seed 4, auth 16).
- `frontend` → **5 testes passaram** (App 2, Login 3).

### Notas / pressupostos
- Testes rodam com pool falso injetado (`createApp({ pool })`) — sem PostgreSQL real necessário.
- Testes do frontend fazem stub de `global.fetch` via `vi.stubGlobal`; `import.meta.env.VITE_API_URL` é undefined no ambiente de teste então as chamadas resolvem para caminhos relativos (ex.: `/api/auth/login`), compatível com as asserções `stringContaining`.
- O `apiClient.login` usa `fetch` cru (não `apiFetch`) intencionalmente, para que um 401 no login apareça como mensagem de erro em vez de disparar o caminho de auto-logout/redirect.

---

## Prompt original do usuário

> Context summary:
>
> ## Goal
> Implementing feature 003 (authentication & profiles) — JWT login, `/api/auth/me`, bcrypt password hashing, role-based middleware, seed users, OpenAPI docs, and frontend auth flows — per `features/003-autenticacao-perfis/spec.md`.
>
> ## State
> - **Done:** (backend auth implementation complete, env.js, app.js, openapi.yaml, package.json, tests/auth.test.js partial)
> - **In Progress:** Writing `tests/auth.test.js` — needs second half (scenarios 9–15)
> - **Blocked:** `npm install` not yet run
>
> ## Next
> 1. Append second half of `tests/auth.test.js` (scenarios 9–15)
> 2. Create `tests/seed.test.js` (scenarios 16–18)
> 3. Run `npm install` in backend
> 4. Run `npm test` in backend — fix any failures
> 5. Update `.env.example` and `docker-compose.yml`
> 6. Implement frontend: apiClient, Login, App, tests, CSS
> 7. Run `npm test` in frontend — fix any failures
>
> ## Files
> - **Read/Edited:** (list of all backend and frontend files touched)

---
