-- 001_init.sql — baseline de infraestrutura (feature 002 - configuracao)
--
-- NÃO cria schema de domínio (usuarios, apontamentos, resumo, etc.):
-- esses objetos são introduzidos pelas features 003-007 (§13 da spec).
--
-- Esta migration apenas habilita a extensão "pgcrypto" de forma idempotente
-- e segura (somente se disponível na imagem), útil para geração de UUIDs e
-- funções de hash em SQL nas próximas features. A tabela de controle de
-- migrations (pgmigrations) é criada automaticamente pelo node-pg-migrate.
--
-- Marcadores de bloco do node-pg-migrate 7.x ficam imediatamente antes de
-- cada trecho (ida/reversão) mais abaixo. Veja migrations/README.md para a
-- convenção completa e as armadilhas do parser (NÃO documentar os marcadores
-- literalmente no cabeçalho antes do bloco SQL real).

-- up migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgcrypto') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  ELSE
    RAISE NOTICE 'Extensão pgcrypto indisponível nesta imagem — baseline ignorado.';
  END IF;
END
$$;

-- down migration
DROP EXTENSION IF EXISTS pgcrypto;
