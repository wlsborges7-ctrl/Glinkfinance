# Rotas - GlinkFinance v0.3

```txt
GET  /                                  Dashboard
GET  /lancamentos                       Lista lançamentos
GET  /lancamentos/novo                  Novo lançamento
POST /lancamentos                       Cria lançamento simples ou parcelado
GET  /lancamentos/:id/baixar            Tela de baixa
POST /lancamentos/:id/baixar            Baixa lançamento
POST /lancamentos/:id/cancelar          Cancela lançamento
GET  /rateios                           Lista rateios
GET  /reservas                          Controle de reservas
POST /reservas                          Lança entrada/saída de reserva
GET  /emprestimos                       Controle de empréstimos/devoluções
POST /emprestimos                       Cadastra empréstimo
POST /emprestimos/:id/devolver          Registra devolução
GET  /relatorios                        Relatórios analíticos
GET  /parametrizacao                    Cadastros do sistema
POST /parametrizacao/unidades           Cria unidade de negócio
POST /parametrizacao/filiais            Cria filial
POST /parametrizacao/credores           Cria credor/devedor
POST /parametrizacao/formas-pagamento   Cria forma de pagamento
POST /parametrizacao/bancos             Cria banco
POST /parametrizacao/centros            Cria centro de custo
POST /parametrizacao/planos             Cria plano de contas
POST /parametrizacao/referencias        Cria referência com teto
POST /parametrizacao/parcelas           Cria tipo de parcela
GET  /api/dashboard                     Dashboard JSON
GET  /api/lancamentos                   Lançamentos JSON
GET  /export/lancamentos.csv            Exportação CSV
GET  /uploads/:arquivo                  Arquivos enviados
```
