-- Seeding Planova/Valka OSINT project data into forense-db

-- 1. Insert Client
INSERT OR IGNORE INTO clientes (id, nome, empresa, email, telefone, notas, ativo)
VALUES (
  '8f0709cc7d8d4ef5b48197775a6c11db', 
  'Diretoria Executiva', 
  'Planova Planejamento e Construções S/A', 
  'planova@ness.com.br', 
  '(11) 3061-3000', 
  'Cliente prioritário de inteligência comercial e reputação corporativa (ORM).', 
  1
);

-- 2. Insert Project
INSERT OR IGNORE INTO projetos (id, codigo, cliente_id, titulo, descricao, tipo, status, valor, valor_pago, data_inicio, data_entrega, data_conclusao)
VALUES (
  '5f9630ec8b7c4a1eb4098bb36c310fb4', 
  'PPS-01711/2026', 
  '8f0709cc7d8d4ef5b48197775a6c11db', 
  'Mapeamento de Riscos & OSINT — Alvo: Victor Penzo Neto', 
  'Investigação de exposição digital, rede de conexões e histórico processual do advogado adverso Victor Penzo Neto (OAB/PR 61.006) contra a Planova/Valka S/A.', 
  'inteligencia', 
  'entregue', 
  10300.00, 
  10300.00, 
  '2026-06-17',
  '2026-06-17',
  '2026-06-17'
);

-- 3. Insert Deliverables (pointing to R2 keys)
INSERT OR IGNORE INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, versao, publicado)
VALUES (
  'd601b3fc827e4db69e710b1968875ea1', 
  '5f9630ec8b7c4a1eb4098bb36c310fb4', 
  'relatorio', 
  'Dossiê OSINT Aprofundado — Alvo: Victor Penzo Neto', 
  'Relatório detalhado mapeando processos, empresas, parceiros e a compartimentalização de equipe de Victor Penzo.', 
  'projetos/PPS-01711/2026/dossie_victor_penzo.html', 
  'text/html', 
  25144, 
  1, 
  1
);

INSERT OR IGNORE INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, versao, publicado)
VALUES (
  'f7823b1c67d34db59d120a45698c9db0', 
  '5f9630ec8b7c4a1eb4098bb36c310fb4', 
  'apresentacao', 
  'Apresentação Executiva Interativa (Deck)', 
  'Apresentação visual e executiva contendo a síntese estratégica dos achados e recomendações.', 
  'projetos/PPS-01711/2026/apresentacao_osint.html', 
  'text/html', 
  65190, 
  1, 
  1
);

INSERT OR IGNORE INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, versao, publicado)
VALUES (
  'a9314b2c78d44db69d230b567c9c0da2', 
  '5f9630ec8b7c4a1eb4098bb36c310fb4', 
  'outro', 
  'Grafo de Vínculos e Rede de Conexões', 
  'Visualização interativa das relações societárias, profissionais e acadêmicas de Victor Penzo Neto.', 
  'projetos/PPS-01711/2026/grafo_victor_penzo.html', 
  'text/html', 
  21320, 
  1, 
  1
);

-- 4. Insert Timeline Milestones
INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
VALUES (
  't1_5f9630ec8b7c4a1eb4098bb36c310fb4',
  '5f9630ec8b7c4a1eb4098bb36c310fb4',
  'inicio',
  'Projeto Iniciado',
  'Solicitação comercial e escopo da investigação aprovados (Proposta comercial código PPS-01711/2026).',
  1,
  'resper@ness.com.br'
);

INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
VALUES (
  't2_5f9630ec8b7c4a1eb4098bb36c310fb4',
  '5f9630ec8b7c4a1eb4098bb36c310fb4',
  'status',
  'Fase de Análise Concluída',
  'Concluída a coleta de bases públicas (OAB, Tribunais, Receita Federal). Dados estruturados na base local de inteligência.',
  1,
  'resper@ness.com.br'
);

INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
VALUES (
  't3_5f9630ec8b7c4a1eb4098bb36c310fb4',
  '5f9630ec8b7c4a1eb4098bb36c310fb4',
  'entrega',
  'Dossiê OSINT Aprofundado Entregue',
  'O relatório investigativo detalhando a compartimentalização de equipe e a rede de conexões do alvo foi anexado ao portal.',
  1,
  'resper@ness.com.br'
);

INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
VALUES (
  't4_5f9630ec8b7c4a1eb4098bb36c310fb4',
  '5f9630ec8b7c4a1eb4098bb36c310fb4',
  'entrega',
  'Apresentação & Grafo Publicados',
  'Apresentação executiva interativa (deck) e o grafo de vínculos de relações societárias e acadêmicas foram publicados no portal.',
  1,
  'resper@ness.com.br'
);
