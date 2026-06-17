-- ══════════════════════════════════════
-- portal.forense.io · Schema Inicial
-- ══════════════════════════════════════

PRAGMA foreign_keys = ON;

-- ── CLIENTES ──
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nome TEXT NOT NULL,
  empresa TEXT,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  notas TEXT,
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── PROJETOS ──
CREATE TABLE IF NOT EXISTS projetos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  codigo TEXT UNIQUE NOT NULL,
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT DEFAULT 'inteligencia',
  status TEXT DEFAULT 'em_andamento',
  valor REAL,
  valor_pago REAL DEFAULT 0,
  data_inicio TEXT,
  data_entrega TEXT,
  data_conclusao TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projetos_cliente ON projetos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_projetos_codigo ON projetos(codigo);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos(status);

-- ── ENTREGÁVEIS ──
CREATE TABLE IF NOT EXISTS entregaveis (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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

CREATE INDEX IF NOT EXISTS idx_entregaveis_projeto ON entregaveis(projeto_id);

-- ── UPLOADS DO CLIENTE ──
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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

CREATE INDEX IF NOT EXISTS idx_uploads_projeto ON uploads(projeto_id);

-- ── TIMELINE ──
CREATE TABLE IF NOT EXISTS timeline (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  visivel_cliente INTEGER DEFAULT 1,
  autor TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timeline_projeto ON timeline(projeto_id);

-- ── LOG DE ACESSOS ──
CREATE TABLE IF NOT EXISTS access_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL,
  acao TEXT NOT NULL,
  recurso TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_access_log_email ON access_log(email);
CREATE INDEX IF NOT EXISTS idx_access_log_created ON access_log(created_at);

-- ── ADMINS ──
CREATE TABLE IF NOT EXISTS admins (
  email TEXT PRIMARY KEY,
  nome TEXT,
  role TEXT DEFAULT 'analyst',
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seeds
INSERT OR IGNORE INTO admins (email, nome, role) VALUES
  ('resper@ness.com.br', 'Resper', 'admin'),
  ('dajzen@ness.com.br', 'Dajzen', 'admin'),
  ('rsalerno@ness.com.br', 'R. Salerno', 'admin');
