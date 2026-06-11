# Rota de implantação - GlinkFinance

## Fase 0 - Protótipo navegável

Status: entregue no MVP v0.2.

Objetivo: validar fluxo com o cliente sem banco, sem login e sem infraestrutura.

Entregas:

- identidade GlinkFinance;
- lançamentos de receita/despesa;
- filiais;
- credores/devedores;
- classificação em 3 níveis;
- rateio por percentual/valor;
- parcelamento;
- dashboard;
- relatórios;
- CSV.

## Fase 1 - MVP operacional

Objetivo: deixar pronto para uso controlado por equipe interna.

Entregas:

- migração JSON para PostgreSQL;
- autenticação;
- perfis de usuário: admin, financeiro, consulta, aprovador;
- tela de edição de lançamento;
- anexos de nota, boleto e comprovante;
- baixa com data, valor e forma de pagamento;
- filtros avançados;
- fechamento mensal por competência;
- logs de auditoria robustos.

## Fase 2 - Controle financeiro real

Objetivo: transformar o MVP em sistema financeiro interno confiável.

Entregas:

- aprovação de despesas;
- recorrências fixas;
- conciliação manual de extrato;
- contas bancárias;
- fluxo de caixa previsto x realizado;
- DRE gerencial simples;
- exportação Excel/PDF;
- alertas de vencimento;
- anexos em storage.

## Fase 3 - Integrações

Objetivo: conectar com o ecossistema real do provedor.

Entregas:

- integração eventual com IXC apenas para indicadores de receita/base, se necessário;
- importação da planilha legada;
- importação de extrato bancário OFX/CSV;
- WhatsApp/e-mail para alerta interno;
- API para BI externo.

## Fase 4 - Produto vendável

Objetivo: tornar o GlinkFinance replicável para outros grupos empresariais/provedores.

Entregas:

- multiempresa/multitenant;
- parametrização de plano de contas;
- permissões por filial;
- trilha de auditoria imutável;
- backups automáticos;
- onboarding guiado;
- documentação técnica e manual do usuário.
