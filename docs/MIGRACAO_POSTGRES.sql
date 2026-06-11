-- Esboço de migração futura para PostgreSQL
-- MVP atual usa JSON para teste local. Este arquivo é referência de modelagem.

CREATE TABLE filiais (
  id UUID PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  percentual_rateio_padrao NUMERIC(8,4) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativa'
);

CREATE TABLE credores_devedores (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('credor','devedor')),
  natureza TEXT,
  cpf_cnpj TEXT,
  email TEXT,
  contato TEXT,
  chave_pix TEXT,
  status TEXT NOT NULL DEFAULT 'ativo'
);

CREATE TABLE centros_custo (id UUID PRIMARY KEY, nome TEXT NOT NULL, status TEXT DEFAULT 'ativo');
CREATE TABLE planos_contas (id UUID PRIMARY KEY, nome TEXT NOT NULL, status TEXT DEFAULT 'ativo');
CREATE TABLE referencias (id UUID PRIMARY KEY, nome TEXT NOT NULL, status TEXT DEFAULT 'ativo');
CREATE TABLE parcelas_tipos (id UUID PRIMARY KEY, nome TEXT NOT NULL, modo TEXT, status TEXT DEFAULT 'ativo');

CREATE TABLE lancamentos (
  id UUID PRIMARY KEY,
  grupo_parcelamento_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  descricao TEXT NOT NULL,
  credor_devedor_id UUID REFERENCES credores_devedores(id),
  filial_id UUID REFERENCES filiais(id),
  centro_custo_id UUID REFERENCES centros_custo(id),
  plano_conta_id UUID REFERENCES planos_contas(id),
  referencia_id UUID REFERENCES referencias(id),
  parcela_tipo_id UUID REFERENCES parcelas_tipos(id),
  competencia CHAR(7) NOT NULL,
  vencimento DATE NOT NULL,
  parcela_numero INTEGER DEFAULT 1,
  parcela_total INTEGER DEFAULT 1,
  valor_provisionado NUMERIC(14,2) NOT NULL,
  valor_realizado NUMERIC(14,2) DEFAULT 0,
  data_realizacao DATE,
  status TEXT NOT NULL DEFAULT 'provisionado',
  rateio_modo TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE TABLE rateios (
  id UUID PRIMARY KEY,
  lancamento_id UUID REFERENCES lancamentos(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES filiais(id),
  modo TEXT NOT NULL,
  percentual NUMERIC(10,4),
  valor_rateado NUMERIC(14,2) NOT NULL
);

CREATE TABLE logs_auditoria (
  id UUID PRIMARY KEY,
  usuario_id UUID,
  entidade TEXT NOT NULL,
  entidade_id UUID,
  acao TEXT NOT NULL,
  dados JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
