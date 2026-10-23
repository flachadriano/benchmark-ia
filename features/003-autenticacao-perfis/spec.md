# Especificação Técnica — Autenticação e Perfis

> Feature de autenticação. Implementa login por e-mail e senha com **JWT**, perfis de acesso
> (**Usuário** e **Gestor**), a tabela `usuários`, hash de senha com **bcrypt** e a **seed** de
> dois usuários. Constrói sobre a infraestrutura da feature 002 (`002-configuracao`) e habilita a
> autorização por perfil consumida pelas features 004–007 (apontamento, regras, resumo, visão do
> gestor). Origem: `003-autenticacao-perfis/readme.md`.

---

## 1. Visão geral

Esta feature entrega o mecanismo de identidade da aplicação de apontamento de horas:

| Aspecto              | Decisão técnica                                            |
| -------------------- | ---------------------------------------------------------- |
| Autenticação         | E-mail + senha → token JWT (HS256)                         |
| Perfis               | `usuario` e `gestor` (coluna `perfil`, com `CHECK`)        |
| Persistência         | Tabela `usuários` (PostgreSQL) criada por migration        |
| Hash de senha        | `bcrypt` (custo = `BCRYPT_SALT`, default `10`)             |
| Seed                 | 2 usuários (um por perfil), idempotente                    |
| Sessão no cliente    | Token JWT no frontend; estado **não** armazenado no servidor |
| Autorização          | Middleware `auth` + `requirePerfil`, reusável em 004–007   |

Objetivos não funcionais derivados do `readme.md`:

- **Login funcional** retornando um JWT assinado com `JWT_SECRET`.
- **Dois perfis** distintos, com o perfil embutido no token para autorização.
- **Senha nunca armazenada em texto** — apenas o hash bcrypt na coluna `senha`.
- **Seed determinística** dos dois usuários descritos, re-executável sem duplicar.
- **Testes automatizados** cobrindo fluxo de login, perfis, proteção de rotas e seed.

Fluxo de autenticação detalhado na seção 2.

---

## 2. Arquitetura e fluxo de autenticação

```
   (frontend)                         (backend Express)                    (PostgreSQL)
       |                                    |                                  |
       |  POST /api/auth/login              |                                  |
       |  { email, senha }                  |                                  |
       |----------------------------------> |                                  |
       |                                    |  SELECT uid,email,senha,perfil   |
       |                                    |  FROM "usuários" WHERE lower(email)=lower($1)
       |                                    |--------------------------------->|
       |                                    |<---------------------------------|
       |                                    |  bcrypt.compare(senha, hash)      |
       |                                    |  jwt.sign({sub,email,perfil})     |
       |  200 { token, user }               |                                  |
       |<---------------------------------- |                                  |
       |                                    |                                  |
       |  GET /api/auth/me                  |                                  |
       |  Authorization: Bearer <token>     |                                  |
       |----------------------------------> |  jwt.verify(token, JWT_SECRET)    |
       |                                    |  (sem acesso ao banco)            |
       |  200 { uid, email, perfil }        |                                  |
       |<---------------------------------- |                                  |
```

- O **login** é o único endpoint que lê a coluna `senha`; a comparação usa `bcrypt.compare`
  (tempo constante).
- Endpoints protegidos validam apenas o JWT (stateless) — não consultam o banco por requisição.
- O perfil no payload do token é a base de autorização da feature 007 (visão do gestor).

Modelo de dados e migration na seção 3.

---

## 3. Modelo de dados

### 3.1 Tabela `usuários`

O `readme.md` define o nome da tabela como **`usuários`** (com acento) e enumera os campos
`uid`, `email`, `senha`. Como o próprio `readme.md` também exige dois **perfis** (`Usuário` e
`Gestor`), a coluna `perfil` é adicionada — sem ela não é possível satisfazer o requisito de
perfis, nem as dependências das features 004 (apontamento vinculado ao usuário) e 007 (visão
exclusiva do gestor). A lista `uid, email, senha` é interpretada como o **conjunto mínimo** de
campos de identidade/autenticação.

> **Convenção de identificador acentuado:** como o nome `usuários` contém acento, **todo** SQL
> que o referencie deve usar aspas duplas (`"usuários"`). Identificadores entre aspas preservam a
> caixa e os acentos; sem aspas, o PostgreSQL lowercases apenas ASCII. Esta regra vale para
> `CREATE TABLE`, `SELECT`, `INSERT`, `ON CONFLICT` e para a `seed`.

| Coluna  | Tipo     | Restrições                                                       |
| ------- | -------- | ---------------------------------------------------------------- |
| `uid`   | `UUID`   | `PRIMARY KEY DEFAULT gen_random_uuid()` (extensão `pgcrypto`)   |
| `email` | `TEXT`   | `NOT NULL`; unicidade insensível a caixa (índice em `lower(email)`) |
| `senha` | `TEXT`   | `NOT NULL` — armazena o **hash** bcrypt, nunca o texto           |
| `perfil`| `TEXT`   | `NOT NULL`, `CHECK (perfil IN ('usuario','gestor'))`             |

- `uid` é UUID (a extensão `pgcrypto` já é habilitada pela migration `001_init.sql` da feature 002).
- `email` é normalizado para **minúsculas** na camada de serviço (login e seed). A unicidade é
  garantida por um **índice único** sobre `lower(email)`, de forma que `User@x.com` e `user@x.com`
  colidam corretamente.
- `perfil` armazena um **token estável em minúsculas** (`usuario`/`gestor`), distinto do rótulo de
  exibição ("Usuário"/"Gestor") do `readme.md`. O mapeamento rótulo↔token é cosmético.

### 3.2 Migration `002_create_usuarios.sql`

Arquivo novo em `backend/migrations/`, seguindo a convenção `NNN_descricao.sql` e os marcadores
`-- up migration` / `-- down migration` (ver `migrations/README.md`).

```sql
-- 002_create_usuarios.sql — autenticação e perfis (feature 003)
-- Cria a tabela "usuários" (nome acentuado conforme readme). Referências subsequentes
-- à tabela devem usar aspas duplas: "usuários".

-- up migration
CREATE TABLE IF NOT EXISTS "usuários" (
  uid    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email  TEXT NOT NULL,
  senha  TEXT NOT NULL,
  perfil TEXT NOT NULL,
  CONSTRAINT chk_usuarios_perfil CHECK (perfil IN ('usuario', 'gestor'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_lower
  ON "usuários" (lower(email));

-- down migration
DROP TABLE IF EXISTS "usuários";
```

- A migration é executada automaticamente no startup do backend (feature 002, §4.4).
- `IF NOT EXISTS` / `IF EXISTS` tornam a migration segura à reexecução.
- A reversão (`migrate down`) remove a tabela `usuários`; a reexecução do `npm run seed` recria os usuários.

---

## 4. Endpoints da API

Todos sob o prefixo `/api`. Respostas de erro seguem `{ "error": "<mensagem>" }` (padrão da feature 002).

### 4.1 `POST /api/auth/login`

Autentica o usuário e retorna o JWT.

- **Request body** (`application/json`):

```json
{ "email": "usuario@email.com.br", "senha": "usuario123" }
```

- **Validações (400 `Bad request`)**: `email` presente e em formato de e-mail; `senha` presente e
  com `>= 8` caracteres. As senhas-seed (`usuario123`, `gestor123`) satisfazem o mínimo.
- **Credenciais inválidas (401 `Unauthorized`)**: e-mail inexistente **ou** senha incorreta —
  mesma mensagem genérica `credenciais inválidas` (evita enumeração de usuários).
- **Sucesso (200 `OK`)**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "uid": "550e8400-...", "email": "usuario@email.com.br", "perfil": "usuario" }
}
```

### 4.2 `GET /api/auth/me`

Retorna o perfil do usuário autenticado (lê do JWT, sem acesso ao banco).

- **Sem token (401)**: `{ "error": "token ausente" }`.
- **Token inválido/expirado (401)**: `{ "error": "token inválido" }`.
- **Sucesso (200)**:

```json
{ "uid": "550e8400-...", "email": "usuario@email.com.br", "perfil": "usuario" }
```

- Útil para o frontend conhecer o perfil (necessário à feature 007, que mostra o botão "Gestão"
  apenas para `gestor`) e para validar o token no boot do app.

### 4.3 Resumo de endpoints

| Método | Rota               | Auth | Descrição                        | Sucesso / Erro |
| ------ | ------------------ | ---- | -------------------------------- | -------------- |
| POST   | `/api/auth/login`  | não  | Autentica e emite JWT             | 200 / 400, 401 |
| GET    | `/api/auth/me`     | sim  | Perfil do usuário autenticado     | 200 / 401      |

> A coluna `senha` **nunca** aparece em nenhuma resposta. JWT e bcrypt na seção 5.

---

## 5. JWT

| Item       | Valor/Regra                                                    |
| ---------- | ------------------------------------------------------------- |
| Algoritmo  | `HS256` (simétrico, `JWT_SECRET`)                             |
| Payload    | `{ sub: uid, email, perfil, iat, exp }`                        |
| Expiração  | `JWT_EXPIRES_IN` (default `8h`)                                |
| Assinatura | `JWT_SECRET` (obrigatório a partir desta feature)             |
| Transporte | Header `Authorization: Bearer <token>`                         |
| Estado     | Stateless — sem blacklist/refresh (ver §18 Fora de escopo)     |

```js
// src/services/tokenService.js
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
  return jwt.verify(token, env.JWT_SECRET); // lança se inválido/expirado
}

module.exports = { signToken, verifyToken };
```

---

## 6. bcrypt e senhas

O `readme.md` determina: *"O campo de senha deve salvar o seu conteúdo usando bcrypt usando
teste como salt."* O bcrypt não aceita uma string arbitrária (como `"teste"`) como salt: o salt é
gerado pela biblioteca a partir de um **fator de custo** (rounds). A interpretação tecnicamente
válida — e compatível com a variável `BCRYPT_SALT` (default `10`) já definida na feature 002 — é
usar `BCRYPT_SALT` como **fator de custo** do bcrypt, adequado ao cenário de teste/benchmark.
Premissa registrada em §19.

| Operação   | Função                              | Quando                          |
| ---------- | ----------------------------------- | ------------------------------- |
| Hash       | `bcrypt.hash(senha, BCRYPT_SALT)`   | Seed (e eventual criação futura)|
| Comparação | `bcrypt.compare(senha, hash)`       | Login                           |

```js
// src/services/passwordService.js
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const SALT_ROUNDS = Number(env.BCRYPT_SALT) || 10;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

function comparePassword(plain, hash) {
  return bcrypt.compareSync(plain, hash); // tempo constante
}

module.exports = { hashPassword, comparePassword };
```

- **`bcryptjs`** (pure JS) é a escolha recomendada por dispensar compilação nativa no contêiner
  Alpine, garantindo `docker compose up` sem toolchain. `bcrypt` (nativo) é alternativa mais
  rápida, exigindo `apk add --no-cache python3 make g++` no `Dockerfile`.
- Os testes validam a senha com `bcrypt.compare` — **nunca** comparando strings de hash.

A verificação do token usa o mesmo `JWT_SECRET`; tokens inválidos ou expirados resultam em `401`.

---

## 7. Perfis e autorização

Middleware reutilizável, montado sob demanda pelas features 004–007.

```js
// src/middleware/auth.js
const { verifyToken } = require('../services/tokenService');

function auth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    const err = new Error('token ausente'); err.status = 401; return next(err);
  }
  try {
    const p = verifyToken(token);
    req.user = { uid: p.sub, email: p.email, perfil: p.perfil };
    next();
  } catch (e) {
    const err = new Error('token inválido'); err.status = 401; next(err);
  }
}

function requirePerfil(...perfis) {
  return (req, _res, next) => {
    if (!req.user) { const e = new Error('não autenticado'); e.status = 401; return next(e); }
    if (!perfis.includes(req.user.perfil)) {
      const e = new Error('perfil insuficiente'); e.status = 403; return next(e);
    }
    next();
  };
}

module.exports = { auth, requirePerfil };
```

- `auth` anexa `req.user` a partir do JWT.
- `requirePerfil('gestor')` devolve `403` para `usuario` e passa para `gestor` (usado em 007).
- Os erros são tratados pelo handler centralizado do `app.js` (§8), padronizando o corpo `{ error }`.

---

## 8. Integração ao `app.js` (composition root)

`createApp({ pool })` (definido pela feature 002) é estendido para montar as rotas de autenticação
com o **pool injetado** — mantendo os testes determinísticos (mesma estratégia do `/health`).

```js
// acréscimo em src/app.js
const { createAuthRouter } = require('./routes/auth');
// ... dentro de createApp:
app.use('/api/auth', createAuthRouter(db));
```

```js
// src/routes/auth.js
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
```

- O `authController` recebe `db` (pool) e constrói o `authService(db)`; o `authService` consulta
  `"usuários"` via `pool.query` e usa `passwordService` + `tokenService`.
- `auth` é aplicado seletivamente em `/me` (e nos endpoints protegidos das features seguintes).
- O handler de erro do `app.js` lê `err.status` e responde `{ error: err.message }`, mantendo o
  formato padrão.

Seed, variáveis de ambiente e OpenAPI nas seções 9 a 11.

---

## 9. Seed

O `readme.md` exige uma seed com dois usuários:

| E-mail                 | Senha        | Perfil    |
| ---------------------- | ------------ | --------- |
| `usuario@email.com.br` | `usuario123` | `usuario` |
| `gestor@gmail.com.br`  | `gestor123`  | `gestor`  |

A seed reside no executável `backend/src/db/seed.js` (`npm run seed`), já previsto pela feature
002. Esta feature **substitui** o placeholder atual (que apenas verifica a existência da tabela)
pela inserção idempotente dos dois usuários, com **hash bcrypt** calculado em tempo de seed.

```js
// backend/src/db/seed.js (feature 003)
const pool = require('./client');
const { hashPassword } = require('../services/passwordService');

const USERS = [
  { email: 'usuario@email.com.br', plain: 'usuario123', perfil: 'usuario' },
  { email: 'gestor@gmail.com.br',  plain: 'gestor123',  perfil: 'gestor'  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of USERS) {
      await client.query(
        `INSERT INTO "usuários" (email, senha, perfil)
         VALUES ($1, $2, $3)
         ON CONFLICT (lower(email)) DO NOTHING`,
        [u.email.toLowerCase(), hashPassword(u.plain), u.perfil]
      );
    }
    await client.query('COMMIT');
    console.log('[seed] 2 usuários garantidos (idempotente).');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { seed };

if (require.main === module) {
  seed()
    .then(() => { console.log('[seed] concluído.'); process.exit(0); })
    .catch((e) => { console.error('[seed] erro:', e.message); process.exit(1); });
}
```

- **Idempotente**: `ON CONFLICT (lower(email)) DO NOTHING` permite reexecução sem duplicar.
- Senhas em **texto** apenas no código da seed; no banco fica apenas o hash.
- A seed depende da migration `002_create_usuarios.sql` (executada no startup ou via `npm run migrate`).
- Recomenda-se executá-la **após** as migrations: `docker compose exec backend npm run seed`.

---

## 10. Variáveis de ambiente

Esta feature **não adiciona** novas variáveis — todas já existem (feature 002). A única mudança é
tornar `JWT_SECRET` **obrigatória** (hoje apenas emite aviso).

| Variável         | Obrigatória | Default | Uso nesta feature                                  |
| ---------------- | ----------- | ------- | -------------------------------------------------- |
| `JWT_SECRET`     | **sim**     | —       | Assinatura/verificação do JWT.                     |
| `JWT_EXPIRES_IN` | não         | `8h`    | Validade do token.                                 |
| `BCRYPT_SALT`    | não         | `10`    | Fator de custo do bcrypt.                          |
| `CORS_ORIGIN`    | não         | `...`   | Já usado; mantém o frontend autorizado a chamar a API. |

```js
// ajuste em src/config/env.js — tornar JWT_SECRET obrigatório (exceto em teste)
if (validated.NODE_ENV !== 'test' && !validated.JWT_SECRET) {
  throw new Error('JWT_SECRET é obrigatório a partir da feature 003 (autenticação JWT).');
}
```

- `backend/tests/setup.env.js` já define `JWT_SECRET=test-secret` e `BCRYPT_SALT=10`, então os
  testes não exigem `.env` real.
- Nenhum segredo é versionado; `.env` continua ignorado e `.env.example` já documenta `JWT_SECRET`.

OpenAPI e frontend nas seções 11 e 12.

---

## 11. Documentação OpenAPI

A `src/docs/openapi.yaml` (feature 002) já declara `securitySchemes.bearerAuth` (JWT) — preparatório.
Esta feature adiciona os `paths` de autenticação:

```yaml
paths:
  /api/auth/login:
    post:
      tags: [Autenticação]
      summary: Autentica usuário e emite JWT
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, senha]
              properties:
                email: { type: string, format: email }
                senha:  { type: string, minLength: 8 }
      responses:
        '200':
          description: Token JWT e dados do usuário.
          content:
            application/json:
              schema:
                type: object
                properties:
                  token: { type: string }
                  user:
                    type: object
                    properties:
                      uid:    { type: string, format: uuid }
                      email:  { type: string, format: email }
                      perfil: { type: string, enum: [usuario, gestor] }
        '400': { description: Dados inválidos. }
        '401': { description: Credenciais inválidas. }
  /api/auth/me:
    get:
      tags: [Autenticação]
      summary: Perfil do usuário autenticado
      security: [{ bearerAuth: [] }]
      responses:
        '200':
          description: Dados do usuário.
          content:
            application/json:
              schema:
                type: object
                properties:
                  uid:    { type: string, format: uuid }
                  email:  { type: string, format: email }
                  perfil: { type: string, enum: [usuario, gestor] }
        '401': { description: Token ausente ou inválido. }
```

- Os `paths` existentes (`/health`) permanecem; esta feature apenas **incrementa** o documento.
- `bearerAuth` passa a ser referenciado efetivamente por `/api/auth/me`.

---

## 12. Frontend

A tela de login (UI definida pela feature 001) é **conectada à API** nesta feature.

Responsabilidades desta feature no frontend:

- Tela de **Login**: campos `email` e `senha`, botão **Login**; em `401` exibe "credenciais inválidas".
- **`apiClient`**: wrapper de `fetch` que injeta `Authorization: Bearer <token>` e, ao receber
  `401`, descarta o token e redireciona ao login.
- **Persistência** do token em `localStorage` (`benchmark_token`) e do perfil (`benchmark_user`).
- Após login bem-sucedido, redireciona à rota principal (apontamentos — feature 004).
- O perfil lido via `GET /api/auth/me` (ou decodificado do payload do JWT) fica disponível para a
  feature 007 exibir condicionalmente o botão "Gestão".

> O design visual segue o protótipo da feature 001; aqui trata-se apenas da **integração** com a API.

Estrutura de arquivos e dependências nas seções 13 e 14.

---

## 13. Estrutura de arquivos (acréscimos)

```
backend/
├── migrations/
│   └── 002_create_usuarios.sql      # NOVO — tabela "usuários"
├── src/
│   ├── middleware/
│   │   └── auth.js                  # NOVO — auth + requirePerfil
│   ├── routes/
│   │   └── auth.js                  # NOVO — /api/auth (login, me)
│   ├── controllers/
│   │   └── authController.js         # NOVO
│   ├── services/
│   │   ├── authService.js            # NOVO — findByEmail + login
│   │   ├── tokenService.js           # NOVO — sign/verify JWT
│   │   └── passwordService.js        # NOVO — hash/compare bcrypt
│   ├── db/
│   │   └── seed.js                   # ALTERADO — seed dos 2 usuários
│   ├── config/env.js                 # ALTERADO — JWT_SECRET obrigatório
│   └── app.js                        # ALTERADO — monta /api/auth
└── tests/
    ├── auth.test.js                  # NOVO — suíte de autenticação
    └── seed.test.js                  # NOVO — idempotência + hash da seed
frontend/
└── src/
    ├── apiClient.js                  # NOVO — fetch com Bearer + 401
    ├── pages/Login.jsx               # NOVO — tela de login (wiring)
    └── __tests__/Login.test.jsx      # NOVO — testes do login
```

---

## 14. Dependências (acréscimos no `backend/package.json`)

| Pacote         | Versão   | Motivo                                            |
| -------------- | -------- | ------------------------------------------------- |
| `jsonwebtoken` | `^9.0.0` | Assinatura/verificação de JWT (HS256), puro JS.   |
| `bcryptjs`      | `^2.4.3` | Hash/comparação bcrypt sem compilação nativa.    |

- `bcryptjs` dispensa `apk add python3 make g++` no `Dockerfile`. Caso se prefira `bcrypt`
  (nativo, mais rápido), adicionar ao `Dockerfile` (estágio de build):
  `RUN apk add --no-cache python3 make g++`.
- Sem novas `devDependencies` — `vitest` e `supertest` já estão presentes (feature 002).

Estratégia de testes, segurança e critérios de aceite nas seções 15 a 17.

---

## 15. Estratégia de testes

O `readme.md` exige "testes automatizados que validem a implementação". Segue o padrão da feature
002: **vitest + supertest** no backend, com `pool` **injetado** (sem banco real nos testes
unitários) e **bcrypt/JWT reais** (com `JWT_SECRET=test-secret`).

### 15.1 Backend — unitários (`tests/auth.test.js`, pool falso)

| #  | Cenário                                                       | Esperado |
| -- | ------------------------------------------------------------- | -------- |
| 1  | `POST /api/auth/login` `usuario@email.com.br`/`usuario123`    | 200; `token` decodificável com `sub`/`email`/`perfil=usuario`; `user` correto |
| 2  | login do gestor                                               | 200; `perfil=gestor` no payload |
| 3  | senha incorreta                                               | 401 `{ error: 'credenciais inválidas' }` |
| 4  | e-mail inexistente                                            | 401, **mesma** mensagem do #3 (sem enumeração) |
| 5  | `email` ausente                                               | 400 |
| 6  | `senha` ausente                                               | 400 |
| 7  | `email` em formato inválido                                    | 400 |
| 8  | `senha` < 8 caracteres                                         | 400 |
| 9  | `GET /api/auth/me` com token válido                            | 200 `{ uid, email, perfil }` |
| 10 | `GET /api/auth/me` sem token                                   | 401 |
| 11 | `GET /api/auth/me` com token inválido                          | 401 |
| 12 | respostas de login e `/me` **não contêm** `senha`              | asserção de ausência da chave |
| 13 | `requirePerfil('gestor')` com `perfil=usuario`                 | 403 |
| 14 | `requirePerfil('gestor')` com `perfil=gestor`                 | `next()` chamado |
| 15 | `comparePassword('usuario123', hashPassword('usuario123'))`   | `true` |

- Os testes 1–4 usam um `pool` falso (`{ query: vi.fn() }`) que devolve a linha do usuário
  (`{ uid, email, senha, perfil }`) com `senha` já haseada por `hashPassword`.
- Os testes 13–14 montam um router temporário com o middleware e usam `supertest`.

### 15.2 Backend — seed (`tests/seed.test.js`, pool falso)

| #  | Cenário                                | Esperado |
| -- | -------------------------------------- | -------- |
| 16 | `seed()` em pool vazio                 | emite 2 `INSERT ... ON CONFLICT DO NOTHING` |
| 17 | reexecutar `seed()`                    | mesmo número de INSERTs (idempotente) |
| 18 | senhas gravadas são hashes bcrypt       | `comparePassword('usuario123', hash)` === true |

Testes de integração e frontend a seguir na seção 15.

### 15.3 Backend — integração (opcional, DB real via `DATABASE_URL`)

| #  | Cenário                                                                 | Esperado |
| -- | ----------------------------------------------------------------------- | -------- |
| 19 | migration `002` cria `usuários` + índice `uq_usuarios_email_lower`       | tabelas/índices presentes |
| 20 | `npm run seed` insere exatamente 2 usuários; reexecutar mantém 2         | count = 2 |
| 21 | login end-to-end contra o banco com os usuários seed                    | 200 + token válido |

> Os testes de integração exigem PostgreSQL disponível; podem ser marcados (ex.: `describe.skipIf`)
> e executados em CI/`docker compose exec backend npm test`.

### 15.4 Frontend (`src/__tests__/Login.test.jsx`)

| #  | Cenário                                                | Esperado |
| -- | ------------------------------------------------------ | -------- |
| 22 | formulário renderiza `email`, `senha` e botão Login    | elementos no DOM |
| 23 | submit válido chama `fetch` com `POST /api/auth/login` | token salvo em `localStorage` |
| 24 | resposta `401` exibe "credenciais inválidas"            | mensagem visível |

Segurança e critérios de aceite nas seções 16 e 17.

---

## 16. Segurança

- **Senha em texto nunca persistida** — apenas o hash bcrypt.
- **Comparação em tempo constante** via `bcrypt.compare` (evita timing attack).
- **Mensagens de erro genéricas** no login (sem distinguir e-mail inexistente de senha errada).
- **`senha` nunca serializada** em respostas (login, `/me`).
- **`JWT_SECRET` obrigatório** e mantido em `.env` (não versionado).
- **Validação de entrada** (e-mail + `senha >= 8`) no controlador antes de qualquer consulta.
- **Stateless**: logout é client-side (descartar o token); sem lista de revogação (fora de escopo).
- Recomendação (opcional, fora do escopo mínimo): rate-limit no `/api/auth/login`.

---

## 17. Critérios de aceite

A feature é considerada concluída quando **todos** os itens abaixo são verdadeiros:

1. **Migration aplicada**: a tabela `usuários` (com `uid`, `email`, `senha`, `perfil`) e o índice
   único `lower(email)` existem após `docker compose up -d`.
2. **Seed executável e idempotente**: `npm run seed` cria exatamente os 2 usuários
   (`usuario@...`/`gestor@...`) e pode ser reexecutado sem duplicar.
3. **Hash bcrypt**: a coluna `senha` dos usuários-seed verifica `bcrypt.compare` contra
   `usuario123`/`gestor123`; o texto não aparece no banco.
4. **Login válido**: `POST /api/auth/login` com as credenciais-seed retorna `200` com um JWT
   decodificável contendo `sub`, `email` e `perfil`.
5. **Login inválido**: senha errada ou e-mail inexistente retorna `401` com mensagem genérica.
6. **Validação**: requisições sem `email`/`senha` ou com formato inválido retornam `400`.
7. **`/api/auth/me`**: com token válido retorna `200`; sem token ou token inválido, `401`.
8. **`senha` ausente das respostas**: nenhuma resposta de login/`me` contém a chave `senha`.
9. **Autorização por perfil**: `requirePerfil('gestor')` devolve `403` para `usuario` e passa `gestor`.
10. **`JWT_SECRET` obrigatório**: o backend falha a inicialização (em não-teste) sem `JWT_SECRET`.
11. **OpenAPI atualizada**: `/openapi.json` contém `/api/auth/login` e `/api/auth/me` com
    `bearerAuth` em `/me`.
12. **Frontend**: a tela de login autentica, armazena o token e trata `401`.
13. **Testes automatizados**: `npm test` (backend) e `npm test` (frontend) passam, cobrindo os
    cenários da §15.

Fora de escopo e premissas nas seções 18 e 19.

---

## 18. Fora de escopo

- **Registro/cadastro** de novos usuários (auto-serviço) — não exigido pelo `readme.md`.
- **Recuperação/alteração de senha** e confirmação por e-mail.
- **Refresh tokens** e revogação/blacklist (logout server-side) — JWT stateless.
- **Rate limiting** e bloqueio após tentativas (mencionado apenas como recomendação).
- **Login social (OAuth)**, 2FA e SSO.
- **Telas de domínio** (apontamentos, resumo, gestão) → features 004–007.
- **Multi-tenant** e perfis adicionais além de `usuario`/`gestor`.

---

## 19. Decisões e premissas

1. **Coluna `perfil`**: o `readme.md` lista `uid, email, senha` mas exige dois perfis; adicionou-se
   `perfil` (`CHECK`) como campo necessário. A lista do readme é interpretada como **mínima**.
2. **Nome da tabela `usuários` (acentuado)**: respeitado literalmente; todo SQL usa aspas duplas
   (`"usuários"`). A `seed.js` anterior (feature 002) verificava `public.usuarios` (sem acento)
   apenas como placeholder; esta feature a substitui pela seed real.
3. **`BCRYPT_SALT` como fator de custo**: a frase "usando teste como salt" é interpretada como
   "usar bcrypt com o fator de custo `BCRYPT_SALT` (default `10`)", pois uma string literal não
   é um salt bcrypt válido. Senhas validadas via `bcrypt.compare`, nunca por hash fixo.
4. **`bcryptjs` (pure JS)** para dispensar compilação nativa no contêiner Alpine; `bcrypt` é
   alternativa documentada (requer toolchain no `Dockerfile`).
5. **Perfis como tokens minúsculos** (`usuario`/`gestor`) no banco e no JWT, distintos dos rótulos
   "Usuário"/"Gestor" de exibição.
6. **E-mail insensível a caixa**: normalizado para minúsculas e único por índice `lower(email)`.
7. **`uid` UUID** via `gen_random_uuid()` (extensão `pgcrypto` já habilitada em `001_init.sql`).
8. **JWT stateless** (HS256, sem refresh/revogação) — alinhado ao `readme.md` ("padrão JWT").