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
