# Apontamento de horas

No header da aplicação deve ter um botão "Apontamentos"

Ao clicar no botão deve apresentar uma lista com as seguintes colunas:
- Projeto: campo de texto
- Data: campo com seleção de dia/mes/ano
- Hora inicial: seleção de hora e minuto do dia
- Hora final: seleção de hora e minuto do dia
- Total de horas: diferença entre a hora inicial e hora final na máscara horas e minutos
- Editar: botão com ícone de lápis
- Excluir: botão com ícone de lixeira

Quando clicar no botão Editar, deve abrir ir para a tela de cadastro de apontamentos.

Tela de cadastro de apontamentos deve ter os seguintes campos:
- Projeto: campo de texto, deve ser um autocomplete, pesquisando algum projeto já cadastrado anteriormente, se não houver, utilizar o que foi digitado
- Data: campo com seleção de dia/mes/ano
- Hora inicial: seleção de hora e minuto do dia
- Hora final: seleção de hora e minuto do dia
- Total de horas: diferença entre a hora inicial e hora final na máscara horas e minutos

Tela central do sistema, pensada para registro rápido ao longo ou ao final do dia de trabalho.

- Seleção do dia com navegação rápida (dia anterior, hoje, próximo dia);
- Registro de apontamento com projeto, hora de início e hora de fim (ou duração);
- Lista dos apontamentos do dia com edição e exclusão;
- Total de horas do dia sempre visível;
- Uso completo por teclado (tab e enter) para agilizar o apontamento;

Ao salvar um apontamento de hora, o registro deve preencher intermanente com o nome do usuário que criou o registro, deve voltar para a tela com a lista de apontamentos

Ao carregar a lista de apontamentos, deve carregar todos os registros de apontamentos vinculados ao usuário logado através do campo de identificação do usuário que criou o registro.

Devem ser criados testes automatizados que validem a implementação.
