// Testes do endpoint de healthcheck e da documentação OpenAPI.
// O pool é injetado via createApp({ pool }) — não há mocking de módulos,
// o que torna os testes determinísticos e independentes de banco real.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

function makeFakePool() {
  return { query: vi.fn() };
}

describe('GET /health', () => {
  let pool;
  let app;
  beforeEach(() => {
    pool = makeFakePool();
    app = createApp({ pool });
  });

  it('retorna 200 com {status:ok, db:up} quando o banco está disponível', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('retorna 503 quando o banco está indisponível', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
  });
});

describe('GET /openapi.json', () => {
  it('retorna um documento OpenAPI válido com o path /health', async () => {
    const res = await request(createApp()).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths['/health']).toBeDefined();
  });
});





