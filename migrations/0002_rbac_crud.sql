-- Drop existing tables to recreate with clean relations
DROP TABLE IF EXISTS timeline;
DROP TABLE IF EXISTS entregaveis;
DROP TABLE IF EXISTS uploads;
DROP TABLE IF EXISTS projetos;
DROP TABLE IF EXISTS clientes;

-- 1. Clientes (Accounts)
CREATE TABLE clientes (
  id TEXT PRIMARY KEY,
  razao_social TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  notas TEXT,
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Contatos (Client Users)
CREATE TABLE contatos_cliente (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  cargo TEXT,
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 3. Projetos
CREATE TABLE projetos (
  id TEXT PRIMARY KEY,
  codigo_proposta TEXT UNIQUE NOT NULL,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  github_repo_url TEXT,
  status TEXT DEFAULT 'proposta',
  valor REAL,
  data_inicio TEXT,
  data_entrega TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 4. Entregáveis
CREATE TABLE entregaveis (
  id TEXT PRIMARY KEY,
  projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  r2_key TEXT NOT NULL,
  mime_type TEXT DEFAULT 'text/html',
  tamanho INTEGER,
  versao INTEGER DEFAULT 1,
  publicado INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 5. Uploads do Cliente
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  cliente_email TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  mime_type TEXT,
  tamanho INTEGER,
  descricao TEXT,
  status TEXT DEFAULT 'recebido',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 6. Timeline
CREATE TABLE timeline (
  id TEXT PRIMARY KEY,
  projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  visivel_cliente INTEGER DEFAULT 1,
  autor TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 7. Respostas do Questionário
CREATE TABLE respostas_questionario (
  id TEXT PRIMARY KEY,
  projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  contato_email TEXT NOT NULL,
  secao_alvo TEXT NOT NULL,
  alinhamento TEXT NOT NULL,
  notas_cliente TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_contatos_cliente_email ON contatos_cliente(email);
CREATE INDEX idx_projetos_cliente ON projetos(cliente_id);
CREATE INDEX idx_entregaveis_projeto ON entregaveis(projeto_id);
CREATE INDEX idx_uploads_projeto ON uploads(projeto_id);
CREATE INDEX idx_timeline_projeto ON timeline(projeto_id);
CREATE INDEX idx_respostas_quest_proj ON respostas_questionario(projeto_id);
