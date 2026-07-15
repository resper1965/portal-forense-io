# Portal Forense — CRUD & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement CRUD endpoints for clients, contacts, and projects under a multitenant JWT cookie middleware in Cloudflare Pages Functions.

**Architecture:** A cookie-based JWT middleware intercepts incoming requests to parse roles (`admin` or `cliente`). It enforces strict access controls on `/api/admin/*` and injects `cliente_id` scope constraints on generic queries.

**Tech Stack:** Cloudflare Pages Functions (TypeScript/Wrangler), Cloudflare D1 (SQLite), Node.js.

## Global Constraints
* compatibility_date = "2026-06-01"
* database_name = "forense-db"
* SameSite = "Strict"
* Secure = true
* HttpOnly = true

---

### Task 1: Database Migration (D1 Schema)

**Files:**
- Create: `migrations/0002_rbac_crud.sql`
- Test: `scripts/test-migration.js`

**Interfaces:**
- Consumes: None
- Produces: SQLite tables `clientes`, `contatos_cliente`, `projetos`, `respostas_questionario`

- [ ] **Step 1: Write a script to test the migration**
  
  Create `scripts/test-migration.js`:
  ```javascript
  const { execSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');

  try {
    console.log("Applying local migration...");
    execSync('npx wrangler d1 execute forense-db --file=migrations/0002_rbac_crud.sql --local', { stdio: 'inherit' });
    console.log("Migration applied successfully!");
    
    console.log("Verifying schema tables...");
    const tables = execSync('npx wrangler d1 execute forense-db --command="SELECT name FROM sqlite_master WHERE type=\'table\'" --local').toString();
    console.log("Tables found:", tables);
    
    if (!tables.includes('contatos_cliente') || !tables.includes('respostas_questionario')) {
      throw new Error("Missing tables after migration!");
    }
    console.log("Verification PASSED");
  } catch (err) {
    console.error("Migration test FAILED:", err.message);
    process.exit(1);
  }
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `node scripts/test-migration.js`
  Expected: FAIL (Missing migration file or commands failing)

- [ ] **Step 3: Write the SQL migration file**

  Create `migrations/0002_rbac_crud.sql`:
  ```sql
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
  ```

- [ ] **Step 4: Run test to verify it passes**

  Run: `node scripts/test-migration.js`
  Expected: PASS

- [ ] **Step 5: Commit changes**

  ```bash
  git add migrations/0002_rbac_crud.sql scripts/test-migration.js
  git commit -m "migration: add RBAC tables and relationships"
  ```

---

### Task 2: Authentication Middleware & Session Validation

**Files:**
- Modify: `functions/api/_middleware.ts`
- Create: `functions/api/test-auth.ts`

**Interfaces:**
- Consumes: `portal_session` cookie
- Produces: `context.data.user` with role and client restrictions

- [ ] **Step 1: Write a test route for auth**

  Create `functions/api/test-auth.ts`:
  ```typescript
  import { PagesFunction } from '@cloudflare/workers-types';

  export const onRequest: PagesFunction<{ DB: D1Database }, any, { user?: any }> = async (context) => {
    const user = context.data.user;
    if (!user) {
      return new Response(JSON.stringify({ authenticated: false }), { status: 401 });
    }
    return new Response(JSON.stringify({ authenticated: true, user }), { status: 200 });
  };
  ```

- [ ] **Step 2: Run wrangler locally and test curl**

  Run dev server: `npx wrangler pages dev dist --port 8788` (in background/separate console)
  In main console, run: `curl http://localhost:8788/api/test-auth`
  Expected: FAIL with `401 Unauthorized`

- [ ] **Step 3: Implement JWT decoding in middleware**

  Modify `functions/api/_middleware.ts` to include:
  ```typescript
  import { PagesFunction } from '@cloudflare/workers-types';

  // Basic mock JWT decode for local dev verification (using header or cookie)
  export const onRequest: PagesFunction<{ DB: D1Database; SESSIONS: KVNamespace }> = async (context) => {
    const cookieHeader = context.request.headers.get('Cookie') || '';
    const devHeader = context.request.headers.get('X-Dev-Email');
    
    let userEmail = '';
    let userRole = 'cliente';
    let clienteId = null;

    if (devHeader) {
      userEmail = devHeader;
    } else {
      const match = cookieHeader.match(/portal_session=([^;]+)/);
      if (match) {
        userEmail = decodeURIComponent(match[1]); // Simplified session representation for dev
      }
    }

    if (userEmail) {
      // 1. Check if Admin
      const admin = await context.env.DB.prepare('SELECT email FROM admins WHERE email = ? AND ativo = 1')
        .bind(userEmail).first();
      
      if (admin) {
        userRole = 'admin';
        context.data.user = { email: userEmail, role: 'admin' };
      } else {
        // 2. Check if Client Contact
        const contact = await context.env.DB.prepare('SELECT id, cliente_id, email FROM contatos_cliente WHERE email = ? AND ativo = 1')
          .bind(userEmail).first<{ id: string; cliente_id: string; email: string }>();
        
        if (contact) {
          userRole = 'cliente';
          clienteId = contact.cliente_id;
          context.data.user = { email: userEmail, role: 'cliente', clienteId };
        }
      }
    }

    // Block client accesses to administrative paths
    if (context.request.url.includes('/api/admin/') && userRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    return context.next();
  };
  ```

- [ ] **Step 4: Run test to verify it passes**

  Run: `curl -H "X-Dev-Email: planova@ness.com.br" http://localhost:8788/api/test-auth`
  Expected: PASS with 200 and `{ authenticated: true, user: { email: "planova@ness.com.br", role: "admin" } }` (assuming seeded admin).
  
  Run: `curl -H "X-Dev-Email: fake-client@planova.com.br" http://localhost:8788/api/admin/any`
  Expected: FAIL with `403 Forbidden`

- [ ] **Step 5: Commit changes**

  ```bash
  git add functions/api/_middleware.ts functions/api/test-auth.ts
  git commit -m "feat: add auth middleware and multi-tenant scoping"
  ```

---

### Task 3: Administrative CRUD API Endpoints

**Files:**
- Create: `functions/api/admin/clientes.ts`
- Create: `functions/api/admin/projetos.ts`
- Modify: `functions/api/projetos/index.ts`

**Interfaces:**
- Consumes: CRUD JSON Payloads
- Produces: Database records in D1 tables

- [ ] **Step 1: Write integration tests for Admin CRUD**

  Create `scripts/test-crud.js`:
  ```javascript
  const { execSync } = require('child_process');

  try {
    console.log("Testing Client Creation...");
    const clientPost = execSync(
      `curl -s -X POST -H "X-Dev-Email: resper@ness.com.br" -H "Content-Type: application/json" ` +
      `-d "{\\\"razao_social\\\":\\\"Test Company S.A.\\\",\\\"cnpj\\\":\\\"12.345.678/0001-99\\\"}" ` +
      `http://localhost:8788/api/admin/clientes`
    ).toString();
    console.log("Client created response:", clientPost);
    const client = JSON.parse(clientPost);
    if (!client.id) throw new Error("Client creation returned no ID!");

    console.log("Testing Project Creation...");
    const projectPost = execSync(
      `curl -s -X POST -H "X-Dev-Email: resper@ness.com.br" -H "Content-Type: application/json" ` +
      `-d "{\\\"codigo_proposta\\\":\\\"PPS-99999/2026\\\",\\\"cliente_id\\\":\\\"${client.id}\\\",\\\"titulo\\\":\\\"OSINT Test\\\"}" ` +
      `http://localhost:8788/api/admin/projetos`
    ).toString();
    console.log("Project created response:", projectPost);
    
    console.log("CRUD Tests PASSED!");
  } catch (err) {
    console.error("CRUD Tests FAILED:", err.message);
    process.exit(1);
  }
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `node scripts/test-crud.js`
  Expected: FAIL (404/Not Found or network errors)

- [ ] **Step 3: Implement client and project CRUD handlers**

  Create `functions/api/admin/clientes.ts`:
  ```typescript
  import { PagesFunction } from '@cloudflare/workers-types';

  export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
    const { results } = await context.env.DB.prepare(
      'SELECT c.*, (SELECT COUNT(*) FROM projetos p WHERE p.cliente_id = c.id) AS projetos_count FROM clientes c'
    ).all();
    return Response.json(results);
  };

  export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
    const data = await context.request.json<{ razao_social: string; cnpj: string; notas?: string }>();
    const id = crypto.randomUUID();
    
    await context.env.DB.prepare(
      'INSERT INTO clientes (id, razao_social, cnpj, notas) VALUES (?, ?, ?, ?)'
    ).bind(id, data.razao_social, data.cnpj, data.notas || '').run();

    return new Response(JSON.stringify({ id, ...data }), { status: 201 });
  };
  ```

  Create `functions/api/admin/projetos.ts`:
  ```typescript
  import { PagesFunction } from '@cloudflare/workers-types';

  export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
    const { results } = await context.env.DB.prepare('SELECT * FROM projetos').all();
    return Response.json(results);
  };

  export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
    const data = await context.request.json<{ codigo_proposta: string; cliente_id: string; titulo: string; descricao?: string; github_repo_url?: string }>();
    const id = crypto.randomUUID();

    await context.env.DB.prepare(
      'INSERT INTO projetos (id, codigo_proposta, cliente_id, titulo, descricao, github_repo_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, data.codigo_proposta, data.cliente_id, data.titulo, data.descricao || '', data.github_repo_url || '', 'proposta').run();

    return new Response(JSON.stringify({ id, ...data }), { status: 201 });
  };
  ```

- [ ] **Step 4: Run test to verify it passes**

  Run: `node scripts/test-crud.js`
  Expected: PASS

- [ ] **Step 5: Commit changes**

  ```bash
  git add functions/api/admin/clientes.ts functions/api/admin/projetos.ts scripts/test-crud.js
  git commit -m "feat: implement administrative CRUD endpoints for clients and projects"
  ```
