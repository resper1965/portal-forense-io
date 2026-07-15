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

-- 2. Insert Project (Status: em_andamento to reflect active phase)
INSERT OR IGNORE INTO projetos (id, codigo, cliente_id, titulo, descricao, tipo, status, valor, valor_pago, data_inicio, data_entrega, data_conclusao)
VALUES (
  '5f9630ec8b7c4a1eb4098bb36c310fb4', 
  'PPS-01711/2026', 
  '8f0709cc7d8d4ef5b48197775a6c11db', 
  'Mapeamento de Riscos & OSINT — Alvo: Victor Penzo Neto', 
  'Investigação de exposição digital, rede de conexões e histórico processual do advogado adverso Victor Penzo Neto (OAB/PR 61.006) contra a Planova/Valka S/A. Repositório de governança no GitHub: https://github.com/forense-io/PPS-01711-2026', 
  'inteligencia', 
  'em_andamento', 
  10300.00, 
  10300.00, 
  '2026-06-17',
  '2026-07-20',
  NULL
);

-- 3. Insert Timeline Milestones
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

INSERT OR IGNORE INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
VALUES (
  't2_5f9630ec8b7c4a1eb4098bb36c310fb4',
  '5f9630ec8b7c4a1eb4098bb36c310fb4',
  'status',
  'Documentos Legais Assinados',
  'Contrato de prestação de serviços de inteligência e Acordo de Confidencialidade (NDA) assinados pelas partes e anexados ao projeto.',
  1,
  'resper@ness.com.br'
);

INSERT OR IGNORE INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
VALUES (
  't3_5f9630ec8b7c4a1eb4098bb36c310fb4',
  '5f9630ec8b7c4a1eb4098bb36c310fb4',
  'entrega',
  'Entregáveis da Fase Inicial Publicados',
  'Dossiê OSINT, Apresentação de Diretoria e Grafo Interativo de Vínculos foram publicados na plataforma.',
  1,
  'resper@ness.com.br'
);

INSERT OR IGNORE INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
VALUES (
  't4_5f9630ec8b7c4a1eb4098bb36c310fb4',
  '5f9630ec8b7c4a1eb4098bb36c310fb4',
  'status',
  'Questionário de Alinhamento Publicado',
  'Questionário de primeira fase sobre o papel dos investigados disponibilizado para validação do cliente.',
  1,
  'resper@ness.com.br'
);
