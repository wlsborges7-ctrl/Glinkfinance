# GlinkFinance MVP v0.6

Sistema de gestão financeira com foco em ISP's, estruturado para controlar receitas, despesas, competência, vencimento, rateios entre filiais, classificações, reservas, empréstimos/devoluções e anexos de nota/comprovante.

## Como rodar localmente

```bash
npm start
```

Acesse:

```txt
http://localhost:3000
```

## Funcionalidades implantadas nesta versão

- Tela separada de **Novo Lançamento**, sem listar lançamentos cadastrados.
- Campos de novo lançamento iniciando em branco.
- Cadastro de **Unidade de Negócio**.
- Classificação em quatro níveis: Unidade de Negócio, Centro de Custo, Plano de Contas e Referência.
- Cadastro prévio de filiais, credores/devedores, classificações, formas de pagamento e bancos na área de **Parametrização**.
- Receitas e despesas com data de vencimento e competência.
- Parcelamento mensal, por intervalo de dias ou por quantidade de meses.
- Rateio entre filiais apenas quando marcada a opção **Com rateio**.
- Inclusão dinâmica de mais/menos filiais no rateio.
- Rateio por percentual ou por valor.
- Campo de Nota/NF e upload de PDF de nota fiscal/nota de compra.
- Baixa de lançamento com data de pagamento, valor baixado, valor de multa, forma de pagamento, banco e comprovante.
- Relatório analítico com teto de gasto por referência e sinalização verde/amarela/vermelha.
- Margem de lucro operacional desconsiderando reservas e retiradas.
- Aba de controle de reservas.
- Aba de controle de empréstimos e devoluções.
- Exportação CSV.

## Observação importante para Render

Esta versão usa `data/db.json` e a pasta `uploads/` para persistência local. Em deploy gratuito no Render, o armazenamento local pode ser apagado em reinícios/redeploys. Para produção, migrar para PostgreSQL/Supabase e storage persistente.

## Comandos Render

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```


## Atualização v0.4 - Ajuste visual e gráficos

Esta versão revisa a apresentação da dashboard para reduzir sensação de tela embolada:

- fonte geral reduzida e hierarquia visual mais clara;
- sidebar ligeiramente menor;
- cards de indicadores mais compactos;
- dashboard com bloco principal de saldo previsto;
- tabela de próximos lançamentos mais enxuta;
- botão direto para a nova área de gráficos.

Nova rota:

```txt
/graficos
```

Indicadores visuais incluídos:

- receitas x despesas por competência;
- despesas por centro de custo;
- resultado por unidade de negócio;
- rateio por filial;
- status dos lançamentos;
- teto de gasto por referência, com sinalização verde/amarelo/vermelho.

API adicional:

```txt
/api/graficos
```

Observação: os gráficos são renderizados com HTML/CSS puro, sem dependência externa, para facilitar deploy no Render e evitar falhas por CDN.

## v0.5 - rodada de validação com cliente

A versão 0.5 adiciona:

- login obrigatório;
- usuários de demonstração Gestor e Assistente;
- perfil Gestor com acesso integral;
- perfil Assistente com controle específico de acesso a dados sensíveis;
- opção de "Dados sensíveis" no cadastro de Plano de Contas;
- filtros avançados na tela de Lançamentos;
- sinalização visual de lançamentos com rateio;
- alteração do dashboard de "Próximos lançamentos" para "Próximas Operações";
- remoção da tela própria de Reservas do menu, passando a tratar reservas/retiradas como lançamentos parametrizados;
- empréstimos/devoluções com parcelamento, data prevista de devolução e histórico de devoluções.

### Acessos de demonstração

Gestor:

```txt
gestor@glinkfinance.com / gestor123
```

Assistente:

```txt
assistente@glinkfinance.com / assistente123
```

Observação: autenticação, senhas e sessões são adequadas para demonstração. Em produção, migrar para PostgreSQL, hash forte com bcrypt/argon2, HTTPS obrigatório, storage persistente e trilha de auditoria transacional.

## v0.6 - usuários e visual executivo

A versão 0.6 adiciona e ajusta:

- rota própria de administração de usuários em `/usuarios`;
- criação de novos usuários pelo perfil Gestor;
- ativação/desativação de usuários;
- liberação ou bloqueio de acesso a dados sensíveis para Assistentes;
- saudação fixa no topo: `Olá, nome do usuário`;
- manutenção dos dois acessos de demonstração iniciais;
- paleta minimalista executivo-financeira, com fundo off-white, sidebar escura, botões verde profundo e destaque dourado discreto;
- redução visual da interface para deixar dashboard e tabelas mais limpas.

### Observação sobre usuários

O sistema não está limitado aos dois usuários de demonstração. Eles são apenas seeds iniciais. O Gestor pode criar os usuários reais do cliente em:

```txt
/usuarios
```

ou pela área:

```txt
/parametrizacao#usuarios
```
