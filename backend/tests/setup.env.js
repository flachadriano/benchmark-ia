// Garante variáveis mínimas para os testes (sem conexão real com o banco).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://app:changeme@db:5432/benchmark';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
process.env.BCRYPT_SALT = process.env.BCRYPT_SALT || '10';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';
