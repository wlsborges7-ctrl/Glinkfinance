# GlinkFinance v0.6 - Usuários e identidade visual

## Apontamento do cliente

O cliente questionou se a aplicação permite criação de usuários além dos dois acessos de demonstração e solicitou saudação nominal ao entrar no sistema. Também foi solicitada revisão da paleta para um tom mais minimalista, executivo e financeiro.

## Implementado

1. Rota própria `/usuarios` para administração de usuários.
2. Menu `Usuários` visível para perfil Gestor.
3. Criação de usuários com nome, e-mail, senha inicial, perfil e permissão de dados sensíveis.
4. Ativação/desativação de usuários.
5. Liberação/bloqueio de dados sensíveis para Assistentes.
6. Saudação no topo da aplicação: `Olá, nome do usuário`.
7. Paleta visual revista para padrão executivo financeiro.

## Regra de acesso

- Gestor: acesso integral, inclusive usuários, parametrização e dados sensíveis.
- Assistente: acesso operacional. Só visualiza dados sensíveis quando liberado pelo Gestor.

## Observação técnica

A camada de autenticação segue adequada para demonstração. Para produção, recomenda-se migrar usuários e sessões para PostgreSQL/Supabase, com hash forte de senha, reset de senha, logs transacionais e política de permissões por empresa/filial.
