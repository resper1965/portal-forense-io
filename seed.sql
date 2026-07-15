-- Seeding Planova/Valka OSINT project data into forense-db

-- 1. Insert Client
INSERT OR IGNORE INTO clientes (id, nome, empresa, email, telefone, notas, ativo)
VALUES (
  '8f0709cc7d8d4ef5b48197775a6c11db', 
  'Diretoria Executiva', 
  'Planova Planejamento e Construções S/A', 
  'planova@ness.com.br', 
  '(11) 3061-3000', 
  'Cliente de inteligência comercial e reputação corporativa (ORM).', 
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

-- 3. Insert ONLY the Approved Proposal as Deliverable
INSERT OR IGNORE INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, versao, publicado)
VALUES (
  'proposta_PPS-01711', 
  '5f9630ec8b7c4a1eb4098bb36c310fb4', 
  'relatorio', 
  'Proposta Comercial Aprovada — PPS-01711/2026', 
  'Proposta técnica e comercial aprovada contendo o escopo e a fundamentação da investigação.', 
  'projetos/PPS-01711/2026/Proposta_Aprovada_PPS-01711.pdf', 
  'application/pdf', 
  1327856, 
  1, 
  1
);

-- 4. Insert Timeline Milestones (only project start and proposal approval)
INSERT OR IGNORE INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
VALUES (
  't1_5f9630ec8b7c4a1eb4098bb36c310fb4',
  '5f9630ec8b7c4a1eb4098bb36c310fb4',
  'inicio',
  'Projeto Iniciado',
  'Proposta comercial código PPS-01711/2026 aprovada e integrada ao portal.',
  1,
  'resper@ness.com.br'
);
