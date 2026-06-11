# GlinkFinance v0.4 - Ajuste visual e área de gráficos

## Motivo da atualização

O cliente avaliou positivamente o fluxo funcional, mas apontou que a dashboard estava visualmente embolada, com fonte e cards grandes demais. Também solicitou uma área específica de gráficos para acompanhar indicadores principais.

## Ajustes implantados

1. Redução da densidade visual da dashboard.
2. Fonte geral mais contida, cards menores e espaçamentos mais regulares.
3. Dashboard reorganizada com destaque para saldo previsto e indicadores auxiliares.
4. Tabela de próximos lançamentos simplificada.
5. Criação da rota `/graficos`.
6. Criação de gráficos em HTML/CSS puro, sem dependência externa.
7. Inclusão de indicadores gráficos:
   - receitas x despesas por competência;
   - despesas por centro de custo;
   - resultado por unidade de negócio;
   - rateio por filial;
   - status dos lançamentos;
   - teto de gasto por referência.

## Leitura técnica

A versão v0.4 fecha a etapa de protótipo navegável com uma apresentação mais adequada para cliente final. Ainda não deve ser tratada como versão de produção, pois persistência em JSON e upload local devem migrar para PostgreSQL e storage persistente na próxima fase.
