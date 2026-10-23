// Testes da seed (feature 003) — cenários 16-18 da spec.
// Usa pool falso que registra todas as queries emitidas (sem banco).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { seed, USERS } from '../src/db/seed.js';
import { comparePassword } from '../src/services/passwordService.js';

function makeFakePool() {
  const calls = [];
  const client = {
    query: vi.fn(async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) };
  return { pool, client, calls };
}

describe('seed', () => {
  let ctx;
  beforeEach(() => {
    ctx = makeFakePool();
  });

  it('16. seed() emite 2 INSERT ... ON CONFLICT DO NOTHING', async () => {
    await seed(ctx.pool);
    const inserts = ctx.calls.filter((c) => /INSERT INTO/i.test(c.sql));
    expect(inserts.length).toBe(2);
    for (const ins of inserts) {
      expect(ins.sql).toMatch(/INSERT INTO\s+"usuários"/i);
      expect(ins.sql).toMatch(/ON CONFLICT\s*\(\s*lower\s*\(\s*email\s*\)\s*\)\s*DO\s*NOTHING/i);
    }
    const sqls = ctx.calls.map((c) => c.sql);
    expect(sqls).toContain('BEGIN');
    expect(sqls).toContain('COMMIT');
    expect(ctx.client.release).toHaveBeenCalled();
  });

  it('17. reexecutar seed() emite o mesmo número de INSERTs (idempotente)', async () => {
    await seed(ctx.pool);
    const firstCount = ctx.calls.filter((c) => /INSERT INTO/i.test(c.sql)).length;
    await seed(ctx.pool);
    const total = ctx.calls.filter((c) => /INSERT INTO/i.test(c.sql)).length;
    expect(firstCount).toBe(2);
    expect(total).toBe(4); // 2 por execução (idempotência via ON CONFLICT no SQL)
    expect(ctx.pool.connect).toHaveBeenCalledTimes(2);
  });

  it('18. senhas gravadas são hashes bcrypt verificáveis (e texto plano não é gravado)', async () => {
    await seed(ctx.pool);
    const inserts = ctx.calls.filter((c) => /INSERT INTO/i.test(c.sql));
    const byEmail = Object.fromEntries(inserts.map((i) => [i.params[0], i.params]));
    expect(Object.keys(byEmail).length).toBe(2);

    const usuario = byEmail['usuario@email.com.br'];
    const gestor = byEmail['gestor@gmail.com.br'];
    expect(usuario).toBeDefined();
    expect(gestor).toBeDefined();

    expect(comparePassword('usuario123', usuario[1])).toBe(true);
    expect(comparePassword('gestor123', gestor[1])).toBe(true);
    expect(usuario[1]).not.toBe('usuario123');
    expect(gestor[1]).not.toBe('gestor123');
    expect(usuario[2]).toBe('usuario');
    expect(gestor[2]).toBe('gestor');
  });

  it('expõe USERS no formato esperado pela spec', () => {
    expect(USERS.length).toBe(2);
    expect(USERS.map((u) => u.email)).toEqual([
      'usuario@email.com.br',
      'gestor@gmail.com.br',
    ]);
  });
});
