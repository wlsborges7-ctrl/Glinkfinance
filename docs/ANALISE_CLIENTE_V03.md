# Análise dos apontamentos do cliente - GlinkFinance v0.3

## 1. Tela de lançamento

Implantado:

- Rota `/lancamentos/novo` separada da listagem.
- Campos sem preenchimento automático, exceto quantidade de parcelas iniciando em 1 por coerência operacional.
- A tela de novo lançamento não contém a tabela de lançamentos cadastrados.
- Inclusão de Unidade de Negócio no lançamento.
- Campo Nota/NF.
- Upload de PDF da Nota Fiscal/Nota de Compra.
- Comprovante financeiro vinculado à baixa do lançamento.

## 2. Rateio entre filiais

Implantado:

- O bloco de rateio fica oculto até a marcação de `Com rateio`.
- O usuário pode adicionar ou remover filiais no rateio.
- O rateio pode ser feito por percentual ou por valor.
- Com rateio exige no mínimo duas filiais.
- Rateio percentual exige soma de 100%.
- Rateio por valor exige soma igual ao valor provisionado.

## 3. Área de parametrização

Implantado em `/parametrizacao`:

- Unidades de Negócio.
- Filiais.
- Credores/Devedores.
- Centros de Custo.
- Planos de Contas.
- Referências com teto de gasto.
- Parcelas.
- Formas de Pagamento.
- Bancos.

## 4. Classificação em quatro níveis

Implantado:

- Unidade de Negócio.
- Centro de Custo.
- Plano de Contas.
- Referência.

## 5. Campos do lançamento

Implantado:

- Data de vencimento.
- Competência.
- Filial.
- Tipo: despesa/receita.
- Unidade de Negócio.
- Centro de Custo.
- Plano de Contas.
- Referência.
- Descrição.
- Parcela.
- Valor provisionado.
- Nota/NF.
- Credor/Devedor.
- Forma de Pagamento.
- Banco.
- Data Pagamento.
- Valor Baixado.
- Valor Multa.
- Observação.
- Status.
- Anexo de nota.
- Comprovante de transação financeira.

## 6. Teto de gasto por referência

Implantado no relatório analítico:

- Verde: 0% a 75% do teto.
- Amarelo: acima de 75% até 100% do teto.
- Vermelho: acima de 100% do teto.

## 7. Lucro operacional

Implantado:

- Receita operacional.
- Despesa operacional.
- Lucro operacional.
- Percentual de lucro.
- Reservas e retiradas são desconsideradas da margem operacional.

## 8. Reservas

Implantado:

- Aba `/reservas`.
- Entrada e saída de reserva.
- Saldo de reservas.

## 9. Empréstimos e devoluções

Implantado:

- Aba `/emprestimos`.
- Cadastro de empréstimo.
- Registro de devolução parcial ou total.
- Saldo em aberto.
- Quitação automática quando devolvido integralmente.

## Próximo salto técnico

Para produção:

- Migrar JSON para PostgreSQL.
- Criar login e perfis de usuário.
- Criar edição de lançamentos.
- Criar logs de auditoria detalhados por campo alterado.
- Migrar uploads para storage persistente.
- Criar filtros avançados por período, filial, unidade, centro, plano e referência.
