# GlinkFinance MVP v0.2

MVP funcional para controle financeiro interno de grupo de provedores, separado do IXC. O IXC permanece como fonte de clientes/contratos. O GlinkFinance controla lançamentos internos, despesas, receitas, credores/devedores, filiais, rateios, classificação em três níveis e parcelamentos.

## Como rodar

Requisito: Node.js instalado.

```bash
cd GlinkFinance
node server.js
```

Acesse:

```txt
http://localhost:3000
```

Não há dependências externas nesta versão. A base de teste fica em `data/db.json`.

## Funcionalidades implementadas no MVP

- Nome e identidade visual alterados para **GlinkFinance**;
- Entradas de receitas e despesas;
- Data de vencimento e mês de competência;
- Filiais previamente cadastradas;
- Rateio/compartilhamento entre filiais por percentual padrão;
- Rateio manual por percentual;
- Rateio manual por valor;
- Lançamento sem rateio;
- Classificação em três níveis:
  - Nível 1: Centro de custo;
  - Nível 2: Plano de contas;
  - Nível 3: Referência;
- Credor/devedor previamente cadastrado;
- Cadastro de filial, credor/devedor e classificações;
- Lançamentos parcelados por quantidade de parcelas/meses;
- Lançamentos por intervalo de dias;
- Valor provisionado;
- Status provisionado, aprovado, liquidado e cancelado;
- Dashboard;
- Relatórios por centro de custo, plano de contas e referência;
- Relatório de rateios;
- Exportação CSV;
- API simples.

## Rotas principais

```txt
GET  /                         Dashboard
GET  /lancamentos              Lista e cria lançamentos
POST /lancamentos              Cria lançamento simples ou parcelado
POST /lancamentos/:id/liquidar Liquida despesa/receita
POST /lancamentos/:id/cancelar Cancela lançamento
GET  /rateios                  Relatório de rateios
GET  /filiais                  Cadastro de filiais
POST /filiais                  Cria filial
GET  /credores-devedores       Cadastro de credores/devedores
POST /credores-devedores       Cria credor/devedor
GET  /classificacoes           Cadastros de centro, plano, referência e parcela
GET  /relatorios               Relatórios gerenciais
GET  /api/dashboard            Dashboard em JSON
GET  /api/lancamentos          Lançamentos em JSON
GET  /export/lancamentos.csv   Exportação CSV
```

## Observação

Este MVP usa JSON para teste local rápido. Para implantação real, migrar para PostgreSQL, autenticação, permissões, storage de anexos/comprovantes e logs imutáveis.
