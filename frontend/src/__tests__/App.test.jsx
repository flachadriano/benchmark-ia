import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renderiza o título do sistema', () => {
    render(<App />);
    // getByText lança se o elemento não existir, então basta verificar truthy.
    const title = screen.getByText('Sistema de Apontamento de Horas');
    expect(title).toBeTruthy();
  });
});

