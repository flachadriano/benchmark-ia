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
