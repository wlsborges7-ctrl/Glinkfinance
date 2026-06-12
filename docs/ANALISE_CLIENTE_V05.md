# Análise dos apontamentos do cliente - GlinkFinance v0.5

## Implantado nesta rodada

1. **Login e senha**
   - Criado acesso obrigatório.
   - Criados perfis Gestor e Assistente.
   - Gestor acessa tudo.
   - Assistente pode ter acesso ou não a dados sensíveis.

2. **Dados sensíveis**
   - Adicionado campo "Dados sensíveis" no cadastro de Plano de Contas.
   - Adicionado controle de permissão no usuário.
   - Quando o usuário não tem permissão, os lançamentos vinculados a plano sensível são ocultados dos lançamentos, dashboards, gráficos, relatórios e API.

3. **Tela de Lançamentos**
   - Adicionados filtros por vencimento, competência, unidade de negócio, filial, tipo, centro de custo, plano de contas, referência, valor, credor/devedor, status, nota/NF, forma de pagamento, data de pagamento e valor baixado.
   - Adicionada sinalização visual de lançamento com rateio.

4. **Dashboard**
   - Alterado o bloco "Próximos lançamentos" para "Próximas Operações".

5. **Reservas**
   - Removida a tela própria do menu.
   - A lógica recomendada é tratar reservas, retiradas e aportes como lançamentos comuns, diferenciados por Plano de Contas e Referência.

6. **Empréstimos e devoluções**
   - Adicionada criação parcelada.
   - Adicionada primeira data prevista de devolução.
   - Adicionado histórico de devolução com data e valor.

## Pontos viáveis agora

- Login simples para demonstração.
- Controle básico de perfis.
- Ocultação de dados sensíveis por plano de contas.
- Filtros avançados em tela.
- Rateio sinalizado na visualização.
- Empréstimos parcelados.

## Pontos que devem ficar para produção

- Criptografia robusta de senha com bcrypt ou argon2.
- Sessões persistentes em banco/Redis.
- PostgreSQL como banco principal.
- Storage persistente para anexos.
- Controle granular de permissões por tela/ação.
- Logs transacionais e imutáveis.
- Auditoria de alteração de dados sensíveis.
- Recuperação de senha.
- Política LGPD formal.
