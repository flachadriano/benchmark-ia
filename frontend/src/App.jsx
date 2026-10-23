import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

const STATUS = {
  checking: { label: 'Verificando API…', cls: 'warn' },
  ok: { label: 'API online', cls: 'ok' },
  degraded: { label: 'API online (banco indisponível)', cls: 'warn' },
  unreachable: { label: 'API offline', cls: 'err' },
};

function App() {
  const [health, setHealth] = useState({ status: 'checking', db: '?' });

  useEffect(() => {
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
  }, []);

  const meta = STATUS[health.status] || STATUS.checking;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot">A</span>
          Apontamento de Horas
        </div>
        <div className="spacer" />
        <span className={`badge ${meta.cls}`}>
          <span className="dot-state" /> {meta.label}
        </span>
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
            As funcionalidades de domínio (autenticação, apontamentos, resumo e visão
            do gestor) são entregues pelas features 003-007.
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
            <li><strong>003</strong> — Autenticação e perfis (JWT)</li>
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
