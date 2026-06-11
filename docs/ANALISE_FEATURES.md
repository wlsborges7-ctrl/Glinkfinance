# Análise das features solicitadas pelo cliente

## 01 - Entradas de Receitas e Despesas considerando data de vencimento e mês de competência

Status: implementado no MVP v0.2.

O sistema agora trabalha com `tipo` igual a `receita` ou `despesa`, `vencimento` em data completa e `competencia` no formato mês/ano.

## 02 - Lançamentos compartilhados entre duas ou mais filiais por percentual ou valor

Status: implementado no MVP v0.2.

Foram adicionados quatro modos:

- sem rateio;
- rateio padrão por percentual cadastrado na filial;
- rateio manual por percentual;
- rateio manual por valor.

O sistema valida fechamento de 100% no percentual e fechamento do valor total no rateio por valor.

## 03 - Classificação em três níveis

Status: implementado no MVP v0.2.

Foram criados cadastros independentes:

- Nível 1: Centro de custo;
- Nível 2: Plano de contas;
- Nível 3: Referência.

O lançamento exige seleção desses três níveis.

## 04 - Lançamentos parcelados mensalmente, por intervalo ou por quantidade de meses

Status: implementado no MVP v0.2.

O formulário permite criar múltiplas parcelas de uma vez, com periodicidade mensal ou por intervalo de dias. Também permite definir se o valor informado é o valor de cada parcela ou o total a ser dividido.

## 05 - Credor/devedor previamente cadastrado

Status: implementado no MVP v0.2.

Foi criado cadastro de credores/devedores com nome/razão social, CPF/CNPJ, e-mail, contato, chave Pix, tipo e natureza.

## 06 - Item em aberto no print

Status: pendente de especificação.

O item 06 aparece vazio no print enviado. Mantido como ponto de validação com o cliente.

## 07 - Campos exemplificados no print

Status: implementado parcialmente/funcional no MVP v0.2.

Campos já presentes:

- Data de vencimento;
- Competência;
- Filial;
- Tipo: despesa/receita;
- Centro de custo;
- Plano de contas;
- Referência;
- Descrição;
- Parcela;
- Valor provisionado.

Campos recomendados para próxima fase:

- Valor realizado;
- Data de realização/pagamento/recebimento editável;
- Conta bancária;
- Forma de pagamento;
- Documento fiscal;
- Comprovante;
- Aprovação por usuário;
- Histórico imutável de alterações.
