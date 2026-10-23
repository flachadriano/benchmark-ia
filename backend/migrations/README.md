# Migrations versionadas do backend.
#
# Convenção de nome: NNN_descricao.sql (ex.: 001_init.sql, 003_create_usuarios.sql).
#
# Diretivas de bloco RECONHECIDAS pelo node-pg-migrate 7.x (regex do parser):
#     -- up migration      (executado em `migrate up`)
#     -- down migration    (executado em `migrate down`, reversão)
#
# ARMADILHA DO PARSER (importante): o regex é
#     /^\s*--[\s-]*up\s+migration/im   (e o análogo para "down")
# e casa a PRIMEIRA linha do arquivo que satisfaz o padrão. Como [\s-]* aceita
# hífens, uma linha de documentação como "--   -- up migration" (ou QUALQUER
# comentário "--" seguido de "up migration"/"down migration") também casa e
# "rouba" o marcador: o bloco "up" vira só um comentário e o SQL real cai no
# bloco "down" (que nunca roda em `migrate up`). Sintoma: a migration é
# registrada em `pgmigrations`, mas não produz efeito (ex.: extensão não
# é criada).
# REGRAS:
#   1. NÃO escreva as sequências "up migration" nem "down migration" no
#      cabeçalho/documentação ANTES dos marcadores reais.
#   2. Coloque "-- up migration" imediatamente antes do trecho de ida e
#      "-- down migration" imediatamente antes do trecho de reversão.
#
# Observação: a notação `-- @migration up` mencionada na spec (§6.2) NÃO é
# reconhecida pelo parser atual da ferramenta e faz com que todo o arquivo
# seja tratado como bloco "up" (sem reversão). Por isso, use sempre a forma
# `-- up migration` / `-- down migration`.
#
# As migrations são executadas automaticamente no startup do backend (§4.4),
# via src/db/migrate.js. A tabela de controle `pgmigrations` é criada pela
# própria ferramenta. Migrations de domínio (usuarios, apontamentos, etc.)
# são adicionadas pelas features 003-007.

