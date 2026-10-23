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
