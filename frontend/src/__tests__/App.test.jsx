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

