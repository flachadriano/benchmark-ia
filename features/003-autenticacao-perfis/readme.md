# Autenticação e Perfis

Implementar autenticação com e-mail e senha, usando o padrão JWT.

O usuário pode ter um dos seguintes perfis: Usuário e Gestor.

Deve ser criada uma seed para dois usuários:
- usuario com e-mail usuario@email.com.br e senha usuario123 com perfil usuário
- gestor com e-mail gestor@gmail.com.br e senha gestor123 com perfil gestor

A tabela deve se chamar usuários, com os campos: uid, email, senha.

O campo de senha deve salvar o seu conteúdo usando bcrypt usando teste como salt.

Devem ser criados testes automatizados que validem a implementação.
