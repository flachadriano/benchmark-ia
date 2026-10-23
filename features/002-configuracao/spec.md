# Especificação Técnica — Configuração

> Feature de base. Define a infraestrutura, os contêineres e a orquestração que sustentam
> todas as demais features (autenticação, apontamento, regras de negócio, resumo, visão do gestor).
> Origem: `002-configuracao/readme.md`.

---

## 1. Visão geral

Esta feature entrega o ambiente de execução completo da aplicação de apontamento de horas,
composto por **três serviços** executando em contêineres Docker e orquestrados por um único
`docker-compose.yml`:

| Serviço    | Tecnologia                            | Responsabilidade                                     |
| ---------- | ------------------------------------- | ---------------------------------------------------- |
| `backend`  | Node.js + Express (API REST)          | Regras de negócio, persistência, autenticação (JWT)  |
| `frontend`| React + Vite (servido por Nginx)       | Interface web, consumo da API REST                   |
| `db`       | PostgreSQL 16                         | Armazenamento relacional com migrations e seed       |

Objetivos não funcionais derivados do `readme.md`:

- **Tudo em contêiner**: cada serviço possui `Dockerfile` próprio.
- **API documentada**: a API REST deve expor documentação OpenAPI/Swagger navegável.
- **Migrations versionadas** e **script de seed** para o PostgreSQL.
- **Configuração por variáveis de ambiente**, sem segredos no repositório.
- **Um único comando** (`docker compose up -d`) deve levantar todos os serviços em estado utilizável.

---

## 2. Arquitetura

```
                    +-------------------+
        :8080 ->    | frontend (Nginx)  |  (arquivos estáticos buildados)
                    +---------+---------+
                              |
                              |  HTTP/JSON (VITE_API_URL)
                              v
                    +---------+---------+
        :3000 ->    | backend (Express) |  /health, /api, /api-docs, /openapi.json
                    +---------+---------+
                              |
                              |  TCP 5432 (pg)
                              v
                    +---------+---------+
                    | db (PostgreSQL 16) |  volume persistente (pgdata)
                    +-------------------+
```

- O **frontend** consome a API via variável `VITE_API_URL` (apontando para `http://localhost:3000`
  em desenvolvimento e para o nome do serviço `backend` na rede interna em produção).
- O **backend** conecta ao PostgreSQL via `DATABASE_URL` (ou variáveis separadas
  `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`).
- Os três serviços compartilham a rede `appnet` (driver `bridge`).
- O banco persiste dados em um volume nomeado `pgdata`.

---

## 3. Estrutura de diretórios

```
benchmark-ia/
├── backend/
│   ├── src/
│   │   ├── app.js                 # configuração do Express (CORS, JSON, rotas, Swagger)
│   │   ├── server.js              # bootstrap (listen + runMigrations na inicialização)
│   │   ├── config/
│   │   │   └── env.js             # leitura/validação de variáveis de ambiente
│   │   ├── db/
│   │   │   ├── client.js          # pool do node-postgres
│   │   │   ├── migrate.js         # runner de migrations
│   │   │   │   └── seed.js          # script de seed
│   │   ├── routes/                # definição das rotas REST (por feature)
│   │   ├── controllers/           # handlers HTTP (por feature)
│   │   ├── services/              # regras de negócio (por feature)
│   │   └── docs/
│   │       └── openapi.yaml       # especificação OpenAPI 3.x
│   ├── migrations/                # arquivos SQL versionados (NNN_nome.sql)
│   ├── seeds/                     # arquivos SQL/JS de seed
│   ├── tests/                     # testes automatizados (por feature)
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   ├── public/
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
├── docker-compose.yml
├── .env.example
└── .gitignore
```

> Os diretórios `routes/`, `controllers/`, `services/` e `migrations/` são estendidos pelas
> features subsequentes (003–007). A estrutura aqui define apenas o esqueleto.


---

## 4. Serviço de back-end (`backend`)

### 4.1 Stack recomendada

| Item                | Versão / Pacote                        | Observação                                |
| ------------------- | -------------------------------------- | ----------------------------------------- |
| Runtime             | Node.js 20 LTS (`node:20-alpine`)      | Versão LTS estável.                       |
| Framework HTTP      | Express 4.x                            | Mínimo e amplamente adotado.              |
| Cliente PostgreSQL  | `pg` (node-postgres) 8.x               | Pool de conexões.                         |
| Migrations          | `node-pg-migrate` 7.x                  | Versionadas em SQL. Knex é alternativa.   |
| Validação de env    | `dotenv` + `envalid` (ou `zod`)        | Falha rápida se variável obrigatória faltar. |
| Testes              | `vitest` + `supertest`                 | Suíte exigida pelas features 003–007.     |
| Documentação API    | OpenAPI 3.1 + `swagger-ui-express`     | Spec em `src/docs/openapi.yaml` ou via `swagger-jsdoc`. |

### 4.2 Endpoints mínimos desta feature

| Método | Rota            | Descrição                                                        | Resposta (sucesso)                          |
| ------ | --------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| GET    | `/health`       | Healthcheck de readiness (depende do banco).                     | `200 { "status": "ok", "db": "up" }`        |
| GET    | `/openapi.json` | Especificação OpenAPI bruta (JSON).                              | `200` (document OpenAPI 3.x)                |
| GET    | `/api-docs`     | Interface Swagger UI navegável.                                  | `200` HTML                                  |

- Todas as rotas de domínio devem ser prefixadas com `/api` (ex.: `/api/apontamentos`).
- O `/health` deve executar um `SELECT 1` no PostgreSQL; retorna `503` se o banco estiver indisponível.

### 4.3 Dockerfile (`backend/Dockerfile`)

Requisitos:

- Imagem base `node:20-alpine`.
- `npm ci --omit=dev` em produção para imagem enxuta.
- `WORKDIR /app`, cópia de `package*.json`, `npm ci`, cópia do código.
- `CMD ["node", "src/server.js"]`.
- `EXPOSE 3000`.
- Não embutir segredos: ler variáveis em runtime.

### 4.4 Inicialização

O `src/server.js` deve, **antes de expor o `listen`**:

1. Carregar e validar variáveis de ambiente (`config/env.js`).
2. Conectar o pool ao PostgreSQL e executar `SELECT 1`.
3. Executar as **migrations** pendentes (`db/migrate.js` → `node-pg-migrate up`).
4. Iniciar o servidor Express na porta `PORT` (default `3000`).

> Executar migrations no startup garante que `docker compose up` sozinho deixe o banco pronto.
> O seed, por sua vez, deve ser **idempotente** e executável sob demanda (ver §6.3 e §9).

---

## 5. Serviço de front-end (`frontend`)

### 5.1 Stack recomendada

| Item             | Versão / Pacote                          | Observação                              |
| ---------------- | ---------------------------------------- | --------------------------------------- |
| Runtime (build)  | Node.js 20 LTS (`node:20-alpine`)        | Usado apenas no estágio de build.       |
| Framework        | React 18.x                               | Compatível com os protótipos de `001-prototipo-ui`. |
| Build tool       | Vite 5.x                                 | Dev server rápido + build estático.     |
| Servidor estático| Nginx (`nginx:1.27-alpine`)              | Servir o `dist/` em produção.           |
| Testes           | `vitest` + `@testing-library/react`      | Suíte exigida pelas features 003–007.   |

### 5.2 Variável de ambiente

| Variável        | Escopo            | Exemplo (dev)          | Descrição                                |
| --------------- | ----------------- | ---------------------- | ---------------------------------------- |
| `VITE_API_URL`  | build (frontend)  | `http://localhost:3000`| URL base da API REST consumida pelo app. |

- Como o Vite invariabiliza em **tempo de build**, o valor é fixado na imagem. Para flexibilidade,
  pode-se injetar `VITE_API_URL` em runtime via Nginx (`envsubst` em `nginx.conf`) — recomendado
  se a mesma imagem for usada em múltiplos ambientes.

### 5.3 Dockerfile (`frontend/Dockerfile`) — multi-stage

```dockerfile
# estágio 1: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# estágio 2: serve
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- O `nginx.conf` deve configurar `try_files $uri $uri/ /index.html` (SPA) e, opcionalmente,
  um proxy `/api -> http://backend:3000/api` para evitar CORS em produção.

### 5.4 Porta

- Interno: `80` (Nginx).
- Publicado no host: `8080:80` (configurado no `docker-compose.yml`).

---

## 6. Banco de dados (`db`)

### 6.1 Imagem

- `postgres:16-alpine`.
- Encoding default `UTF-8`.
- Timezone configurável via `TZ` (default `UTC`).

### 6.2 Migrations versionadas

- Diretório `backend/migrations/` com arquivos nomeados como `NNN_descricao.sql`
  (ex.: `001_create_usuarios.sql`).
- Cada migration deve conter blocos **reversíveis** quando aplicável (padrão up/down do
  `node-pg-migrate` ou comentários `-- @migration up` / `-- @migration down`).
- Executadas automaticamente no startup do backend (ver §4.4).
- A tabela de controle (`pgmigrations`) é criada automaticamente pela ferramenta.
- **Não há schema de negócio definido nesta feature** — as tabelas (`usuários`, `apontamentos`,
  etc.) são criadas pelas migrations das features 003–007. Esta feature apenas provê o mecanismo.

### 6.3 Seed

- Script em `backend/seeds/` (ex.: `seed.js` ou `001_seed.sql`), executável via
  `npm run seed` (backend) ou `docker compose exec backend npm run seed`.
- Deve ser **idempotente** (`INSERT ... ON CONFLICT DO NOTHING` ou verificação prévia).
- O seed de negócio (usuários `usuario@email.com.br` e `gestor@gmail.com.br`) é definido pela
  feature `003-autenticacao-perfis`; aqui provê-se apenas o comando/meio de execução.

### 6.4 Persistência

- Volume nomeado `pgdata` montado em `/var/lib/postgresql/data`.
- O banco **não** deve perder dados entre `docker compose down` e `docker compose up`
  (apenas `docker compose down -v` remove o volume).


---

## 7. Variáveis de ambiente

### 7.1 Princípios

- **Nenhum segredo no repositório**: senhas, tokens e chaves vivem apenas em `.env` (git-ignored).
- Um **`.env.example`** versionado documenta todas as variáveis com valores fictícios.
- `.env` (real) está em `.gitignore`.
- Variáveis obrigatórias faltantes devem **falhar a inicialização** do serviço com mensagem clara.

### 7.2 Tabela de variáveis

#### Globais (`/.env` e `docker-compose.yml`)

| Variável            | Serviço           | Obrigatória | Default       | Descrição                                  |
| ------------------- | ----------------- | ----------- | ------------- | ------------------------------------------ |
| `POSTGRES_USER`     | db, backend       | sim         | `app`         | Usuário do PostgreSQL.                     |
| `POSTGRES_PASSWORD` | db, backend       | sim         | —             | Senha do PostgreSQL (segredo).             |
| `POSTGRES_DB`       | db, backend       | sim         | `benchmark`   | Nome do banco.                             |
| `DATABASE_URL`      | backend           | sim*        | —             | `postgres://${USER}:${PASS}@db:5432/${DB}`. Alternativa às variáveis separadas. |
| `PORT_BACKEND`      | backend, compose  | não         | `3000`        | Porta interna do backend.                  |
| `PORT_FRONTEND`     | compose           | não         | `8080`        | Porta publicada do frontend no host.       |

#### Backend (`backend/.env`)

| Variável            | Obrigatória       | Default       | Descrição                                  |
| ------------------- | ----------------- | ------------- | ------------------------------------------ |
| `NODE_ENV`          | não               | `development` | `development` \| `production`.            |
| `PORT`              | não               | `3000`        | Porta de escuta do Express.                |
| `DATABASE_URL`      | sim*              | —             | String de conexão PostgreSQL.              |
| `JWT_SECRET`        | sim (feature 003) | —             | Segredo de assinatura JWT (segredo).       |
| `JWT_EXPIRES_IN`    | não               | `8h`          | Validade do token.                         |
| `BCRYPT_SALT`       | não               | `10`          | Cost do bcrypt (feature 003).              |
| `LOG_LEVEL`         | não               | `info`        | Nível de log.                              |

\* `DATABASE_URL` **ou** o conjunto `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`
   (este último é o default do `pg` e do `node-pg-migrate`).

#### Frontend (`frontend/.env`)

| Variável        | Obrigatória | Default | Descrição                                |
| --------------- | ----------- | ------- | ---------------------------------------- |
| `VITE_API_URL`  | sim         | —       | URL base da API REST.                    |

### 7.3 `.env.example` (raiz) — modelo

```env
# Banco de dados
POSTGRES_USER=app
POSTGRES_PASSWORD=changeme
POSTGRES_DB=benchmark
DATABASE_URL=postgres://app:changeme@db:5432/benchmark

# Backend
PORT_BACKEND=3000
JWT_SECRET=changeme
JWT_EXPIRES_IN=8h
BCRYPT_SALT=10

# Frontend
PORT_FRONTEND=8080
VITE_API_URL=http://localhost:3000
```


---

## 8. `docker-compose.yml`

Requisitos obrigatórios:

- **Versão**: usar formato moderno (sem `version:` deprecado; Compose v2).
- **Serviços**: `db`, `backend`, `frontend`.
- **Rede**: `appnet` (bridge) compartilhada pelos três.
- **Volumes**: `pgdata` vinculado ao `db`.
- **Dependências**: `backend` depende de `db` (`condition: service_healthy`);
  `frontend` depende de `backend`.
- **Healthchecks**:
  - `db`: `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}`.
  - `backend`: `wget --spider -q http://localhost:3000/health` (ou `curl`).
- **Variáveis**: lidas do `.env` via `env_file` ou interpolação `${VAR}`.

Estrutura de referência:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      TZ: UTC
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks: [appnet]

  backend:
    build: ./backend
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}
      BCRYPT_SALT: ${BCRYPT_SALT}
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget --spider -q http://localhost:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [appnet]

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: ${VITE_API_URL}
    ports:
      - "${PORT_FRONTEND:-8080}:80"
    depends_on:
      backend:
        condition: service_healthy
    networks: [appnet]

volumes:
  pgdata:

networks:
  appnet:
    driver: bridge
```


---

## 9. Comandos

| Comando                                          | Ação                                                |
| ------------------------------------------------ | --------------------------------------------------- |
| `cp .env.example .env`                           | Criar configuração local (uma vez).                 |
| `docker compose up -d`                           | Levanta os três serviços (migrations rodam no boot). |
| `docker compose down`                            | Para e remove contêineres (mantém o volume).         |
| `docker compose down -v`                         | Remove **também** o volume do banco (reset total).  |
| `docker compose logs -f backend`                 | Acompanha logs do backend.                          |
| `docker compose exec backend npm run migrate`    | Roda migrations manualmente.                        |
| `docker compose exec backend npm run seed`      | Executa o seed (idempotente).                        |
| `docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB` | Acesso ao psql.        |

Scripts `package.json` esperados no `backend`:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "migrate": "node-pg-migrate up",
    "migrate:undo": "node-pg-migrate down",
    "seed": "node src/db/seed.js",
    "test": "vitest run"
  }
}
```

---

## 10. Documentação da API (OpenAPI/Swagger)

- A especificação deve seguir **OpenAPI 3.1** (compatível com 3.0).
- Disponível em `/openapi.json` (JSON bruto) e `/api-docs` (Swagger UI).
- Deve conter, no mínimo:
  - `info` (title, version, description).
  - `servers` apontando para `http://localhost:3000`.
  - `components.securitySchemes` com `bearerAuth` (JWT) — preparatório para a feature 003.
  - `paths` com os endpoints mínimos desta feature (`/health`) e placeholder para os das demais.
- Cada feature subsequente **incrementa** esta especificação com seus próprios `paths`.

---

## 11. `.gitignore` (relevantes para esta feature)

```gitignore
# Dependências
node_modules/

# Variáveis e segredos
.env
.env.*
!.env.example

# Builds
frontend/dist/

# Logs
*.log
npm-debug.log*
```


---

## 12. Critérios de aceite

A feature é considerada concluída quando **todos** os itens abaixo são verdadeiros:

1. **Levantamento com um comando**: `docker compose up -d` (a partir de `.env` configurado)
   sobe `db`, `backend` e `frontend` sem erros, e todos atingem estado `healthy`.
2. **Migrations automáticas**: o banco inicia com as migrations aplicadas (tabela de controle
   presente; sem pendências). Reexecutar `up` não reaplica migrations já rodadas.
3. **Seed executável e idempotente**: `npm run seed` executa sem erro e pode ser repetido
   sem duplicar dados.
4. **Healthcheck funcional**: `GET http://localhost:3000/health` retorna `200` com
   `{ "status": "ok", "db": "up" }`; retorna `503` se o banco cair.
5. **API documentada**: `GET /api-docs` renderiza a Swagger UI e `GET /openapi.json` retorna
   um documento OpenAPI 3.x válido.
6. **Frontend acessível**: `http://localhost:8080` carrega a SPA sem erro de rede (página
   inicial renderiza, mesmo que ainda sem funcionalidades de domínio).
7. **Sem segredos no repositório**: `git grep` não encontra senhas reais; apenas `.env.example`
   versionado; `.env` ignorado.
8. **Configuração externa**: alterar valores no `.env` (ex.: `PORT_FRONTEND`, `POSTGRES_DB`)
   reflete no comportamento após recriar os contêineres, sem edição de código.
9. **Persistência**: `docker compose down` seguido de `up -d` mantém os dados do banco;
   apenas `down -v` os apaga.
10. **Reprodutibilidade**: em um ambiente limpo com Docker, após `cp .env.example .env` e
    `docker compose up -d --build`, o sistema fica utilizável.

---

## 13. Fora de escopo

- Definição do schema de tabelas de negócio (`usuários`, `apontamentos`) → features 003–007.
- Implementação da autenticação JWT, regras de negócio, telas e endpoints de domínio →
  features 003–007.
- Pipeline de CI/CD, deploy em nuvem e observabilidade (logs centralizados, métricas) —
  não exigidos pelo `readme.md`.
