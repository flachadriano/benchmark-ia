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
