# Especificação de Design — Portal Forense (portal.forense.io)
**Data:** 15 de Julho de 2026  
**Status:** Aprovado  
**Escopo:** CRUD de Projetos/Clientes, RBAC de Segurança e Espaço de Interação de Auditoria.

---

## 1. Objetivo Geral
O **Portal Forense** é o centro operacional de gerenciamento de inteligência cível e OSINT da *forense.io*. A plataforma conecta a equipe técnica (humanos e agentes autônomos de IA) aos clientes, permitindo:
*   Visualização clara e restrita do progresso dos projetos por parte dos clientes.
*   Assinatura simplificada de NDA e contrato de prestação de serviços.
*   Upload de novos insumos (PDFs judiciais, provas de redes sociais).
*   Validação interativa e respostas do cliente aos questionários factuais de primeira fase.
*   CRUD de controle para a equipe da *forense.io* cadastrar novos alvos, propostas e links de repositório no GitHub.

---

## 2. Modelagem do Banco de Dados (D1)
Para suportar múltiplos contatos por cliente, controle de propostas e vínculos de governança, o banco D1 será estendido conforme o esquema abaixo:

```sql
-- Clientes (Entidade Corporativa Contratante)
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  razao_social TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  notas TEXT,
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Contatos Autorizados (Usuários do Cliente)
CREATE TABLE IF NOT EXISTS contatos_cliente (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, -- Login
  telefone TEXT,
  cargo TEXT,
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Projetos e Ciclo de Vida
CREATE TABLE IF NOT EXISTS projetos (
  id TEXT PRIMARY KEY,
  codigo_proposta TEXT UNIQUE NOT NULL,      -- Ex: PPS-01711/2026
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  github_repo_url TEXT,                      -- Link de governança
  status TEXT DEFAULT 'proposta',            -- 'proposta', 'em_andamento', 'concluido', 'arquivado'
  valor REAL,
  data_inicio TEXT,
  data_entrega TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Respostas dos Questionários de Alinhamento
CREATE TABLE IF NOT EXISTS respostas_questionario (
  id TEXT PRIMARY KEY,
  projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  contato_email TEXT NOT NULL,
  secao_alvo TEXT NOT NULL,                  -- Ex: 'Victor Penzo', 'WIE'
  alinhamento TEXT NOT NULL,                 -- 'confirmado' ou 'divergente'
  notas_cliente TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 3. Autenticação e RBAC (Controle de Acesso)
O portal implementará isolamento rígido de multilocatário (*multitenancy*) via cabeçalhos e cookies seguros:
*   **Cookie de Sessão:** `portal_session` contendo JWT assinado.
*   **Perfis de Acesso (Roles):**
    *   `admin`: Controle global. Permite execução de CRUDs, visualização de logs e publicação de entregáveis.
    *   `cliente`: Acesso restrito. Vinculado a um `cliente_id` específico.
*   **Middleware de Isolamento (`_middleware.ts`):**
    *   Garante que qualquer requisição aos endpoints `/api/admin/*` seja bloqueada para usuários comuns (retornando `403 Forbidden`).
    *   Injeta o `clienteId` nas requisições do cliente. Todas as queries de consulta (`SELECT`) cíveis de projetos, entregáveis e cronogramas serão filtradas automaticamente com a cláusula `WHERE cliente_id = ?` usando o parâmetro da sessão decodificada.

---

## 4. Especificação dos Endpoints de API

### 4.1. Endpoints Administrativos (`/api/admin/*`)
*   **Clientes:**
    *   `GET /api/admin/clientes` — Lista clientes e quantidade de projetos ativos.
    *   `POST /api/admin/clientes` — Cria nova conta de cliente corporativo.
    *   `PUT /api/admin/clientes/:id` — Atualiza razão social, CNPJ ou notas de auditoria.
*   **Contatos:**
    *   `GET /api/admin/clientes/:clienteId/contatos` — Lista usuários do cliente.
    *   `POST /api/admin/clientes/:clienteId/contatos` — Adiciona novo usuário com poder de login.
    *   `DELETE /api/admin/contatos/:id` — Revoga credenciais de login.
*   **Projetos:**
    *   `GET /api/admin/projetos` — Monitor geral de propostas e andamentos.
    *   `POST /api/admin/projetos` — Abre novo projeto/proposta associando ao cliente.
    *   `PUT /api/admin/projetos/:id` — Atualiza status (ex: promove `'proposta'` a `'em_andamento'`) ou insere URL do GitHub.

### 4.2. Endpoints do Cliente
*   **Projetos & Entregáveis:**
    *   `GET /api/projetos` — Retorna apenas os projetos vinculados ao `clienteId` da sessão ativa.
    *   `GET /api/projetos/:id/entregaveis` — Lista propostas, contratos, NDAs e HTMLs interativos daquele projeto.
*   **Upload de Insumos:**
    *   `POST /api/uploads/presign` — Gera URL pré-assinada para upload de novos PDFs direto para o R2 pelo cliente.
    *   `POST /api/uploads/confirm` — Confirma e salva o metadado do PDF enviado em `uploads` com status `pendente`.
*   **Respostas de Questionários:**
    *   `POST /api/projetos/:id/questionario` — Salva a decisão (`confirmado`/`divergente`) e observações escritas de alinhamento em `respostas_questionario`.

---

## 5. UI/UX e Interface Visual

### 5.1. Painel Administrativo (Forense Team)
Console centralizado exibindo métricas globais e modais para cadastro rápido de clientes, atribuição de contatos e atribuição de repositórios do GitHub a propostas aprovadas.

### 5.2. Workspace de Sucesso do Cliente
*   **Linha do Tempo Visual:** Gráfico interativo indicando as fases do projeto.
*   **Tabela de Download e Acesso Rápido:** Centralização dos entregáveis (Deck, Dossiê, Grafo) e documentos jurídicos (Contrato e NDA) para visualização rápida no navegador.
*   **Formulário de Alinhamento Factográfico:** Interface interativa baseada no questionário, permitindo que a Planova marque seu acordo/desacordo em cada ponto de vista e insira anotações de próprio punho diretamente nos registros.

---

## 6. Integração com Agentes de IA (MCP Layer)
A plataforma servirá como ponto de entrada para agentes automatizados (Cursor, Antigravity, Claude Code) por meio de:
1.  **Protocolo MCP:** Um servidor MCP lerá as propostas ativas e pendências do banco do portal para pautar o escopo da investigação.
2.  **Upload Direto:** O agente, ao finalizar uma busca, enviará relatórios gerados e HTMLs diretamente aos endpoints de uploads ou entregáveis do portal, eliminando a dependência de intervenção humana no fluxo de publicação.
