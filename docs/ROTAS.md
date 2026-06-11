# Rotas do GlinkFinance MVP

## Interface

```txt
GET  /                         Dashboard financeiro
GET  /lancamentos              Tela de lançamentos
POST /lancamentos              Criação de lançamento simples ou parcelado
POST /lancamentos/:id/liquidar Baixa de receita/despesa
POST /lancamentos/:id/cancelar Cancelamento de lançamento
GET  /rateios                  Relatório de rateios por filial
GET  /filiais                  Cadastro/listagem de filiais
POST /filiais                  Criação de filial
GET  /credores-devedores       Cadastro/listagem de credores e devedores
POST /credores-devedores       Criação de credor/devedor
GET  /classificacoes           Centro de custo, plano de contas, referência e parcela
POST /classificacoes/centro    Criação de centro de custo
POST /classificacoes/plano     Criação de plano de contas
POST /classificacoes/referencia Criação de referência
POST /classificacoes/parcela   Criação de tipo de parcela
GET  /relatorios               Relatórios gerenciais
```

## API

```txt
GET /api/dashboard
GET /api/lancamentos
GET /export/lancamentos.csv
```

## Próximas rotas recomendadas

```txt
GET    /lancamentos/:id
POST   /lancamentos/:id/editar
POST   /lancamentos/:id/anexos
POST   /lancamentos/:id/aprovar
GET    /fechamentos
POST   /fechamentos
GET    /contas-bancarias
POST   /contas-bancarias
GET    /importacao
POST   /importacao/planilha
```
