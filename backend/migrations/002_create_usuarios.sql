-- 002_create_usuarios.sql — autenticação e perfis (feature 003)
-- Cria a tabela "usuários" (nome acentuado conforme readme). Referências subsequentes
-- à tabela devem usar aspas duplas: "usuários".

-- up migration
CREATE TABLE IF NOT EXISTS "usuários" (
  uid    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email  TEXT NOT NULL,
  senha  TEXT NOT NULL,
  perfil TEXT NOT NULL,
  CONSTRAINT chk_usuarios_perfil CHECK (perfil IN ('usuario', 'gestor'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_lower
  ON "usuários" (lower(email));

-- down migration
DROP TABLE IF EXISTS "usuários";
