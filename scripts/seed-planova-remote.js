const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_CODIGO = 'PPS-01711/2026';
const PROJECT_ID = '5f9630ec8b7c4a1eb4098bb36c310fb4';
const CLIENT_EMAIL = 'planova@ness.com.br';

function runCmd(cmd) {
  console.log(`Running: ${cmd}`);
  try {
    const output = execSync(cmd, { stdio: 'inherit' });
    if (output) console.log(output.toString());
  } catch (err) {
    console.error(`Failed to execute: ${cmd}\nError: ${err.message}`);
    process.exit(1);
  }
}

function main() {
  console.log('=== Iniciando Seeding do Cliente Planova (PRODUÇÃO / REMOTO) ===\n');

  // 1. Limpar entregáveis antigos e atualizar o status do projeto no D1 Remoto
  console.log('1. Limpando entregáveis antigos e atualizando status do projeto no D1 Remoto...');
  const cleanCmd = `DELETE FROM entregaveis WHERE projeto_id = '${PROJECT_ID}'; ` +
                    `UPDATE projetos SET status = 'em_andamento', titulo = 'Mapeamento de Riscos & OSINT — Alvo: Victor Penzo Neto', ` +
                    `descricao = 'Investigação de exposição digital, rede de conexões e histórico processual do advogado adverso Victor Penzo Neto (OAB/PR 61.006) contra a Planova/Valka S/A. Repositório de governança no GitHub: https://github.com/forense-io/PPS-01711-2026' ` +
                    `WHERE id = '${PROJECT_ID}';`;
  
  const tempSqlFile = path.join(__dirname, 'temp_clean.sql');
  fs.writeFileSync(tempSqlFile, cleanCmd);
  runCmd(`npx wrangler d1 execute forense-db --file="${tempSqlFile}" --remote`);
  fs.unlinkSync(tempSqlFile);

  // 2. Upload dos entregáveis da pasta dist para o R2 Remoto
  console.log('\n2. Fazendo upload dos entregáveis (dist/) para o R2 Remoto...');
  const deliverables = [
    {
      id: 'dossie_PPS-01711',
      file: 'dossie_victor_penzo.html',
      key: `projetos/${PROJECT_CODIGO}/dossie_victor_penzo.html`,
      tipo: 'relatorio',
      mime: 'text/html',
      titulo: 'Dossiê OSINT Aprofundado — Alvo: Victor Penzo Neto',
      descricao: 'Dossiê investigativo detalhado contendo análise cadastral, processual, rede de co-patrocínios e a WIE.'
    },
    {
      id: 'apresentacao_PPS-01711',
      file: 'apresentacao_osint.html',
      key: `projetos/${PROJECT_CODIGO}/apresentacao_osint.html`,
      tipo: 'apresentacao',
      mime: 'text/html',
      titulo: 'Apresentação Executiva Interativa (Deck)',
      descricao: 'Apresentação interativa com síntese executiva dos achados para a Diretoria.'
    },
    {
      id: 'grafo_PPS-01711',
      file: 'grafo_victor_penzo.html',
      key: `projetos/${PROJECT_CODIGO}/grafo_victor_penzo.html`,
      tipo: 'outro',
      mime: 'text/html',
      titulo: 'Grafo de Vínculos e Rede de Conexões',
      descricao: 'Grafo dinâmico das relações societárias, profissionais e acadêmicas do alvo.'
    },
    {
      id: 'github_PPS-01711',
      file: 'github_link.html',
      key: `projetos/${PROJECT_CODIGO}/github_link.html`,
      tipo: 'outro',
      mime: 'text/html',
      titulo: 'Repositório de Governança (GitHub)',
      descricao: 'Link direto e seguro para o repositório GitHub contendo todo o controle de versão e governança do projeto.'
    }
  ];

  const sqlStatements = [];

  for (const deliv of deliverables) {
    const filePath = path.join(__dirname, '../dist', deliv.file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      // Adicionado --remote para upload no bucket de produção
      runCmd(`npx wrangler r2 object put "forense-bucket/${deliv.key}" --file="${filePath}" --remote`);
      
      sqlStatements.push(
        `INSERT OR REPLACE INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, versao, publicado) ` +
        `VALUES ('${deliv.id}', '${PROJECT_ID}', '${deliv.tipo}', '${deliv.titulo.replace(/'/g, "''")}', '${deliv.descricao.replace(/'/g, "''")}', '${deliv.key}', '${deliv.mime}', ${stats.size}, 1, 1);`
      );
    } else {
      console.warn(`Aviso: Arquivo de entregável não encontrado: ${filePath}`);
    }
  }

  // 3. Procurar e subir os arquivos na pasta Planova
  console.log('\n3. Verificando documentos e insumos na pasta Planova...');
  const planovaDir = path.join(__dirname, '../../Planova');
  
  if (fs.existsSync(planovaDir)) {
    // Insumos Originais (Uploads)
    const pdfFiles = [
      {
        fileName: 'insumos/Cópia petições S&M_0051993-73.2023.8.26.0100.pdf',
        keyName: 'Copia_peticoes_SM.pdf',
        descricao: 'Cópia de petições e decisão de penhora do processo S&M vs Planova.'
      },
      {
        fileName: 'insumos/Relatório 047.044.629-35.pdf',
        keyName: 'Relatorio_047.044.629-35.pdf',
        descricao: 'Relatório de pesquisa de CPF / dados cadastrais e processos de Ricardo Esper.'
      }
    ];

    for (const pdf of pdfFiles) {
      const filePath = path.join(planovaDir, pdf.fileName);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const r2Key = `projetos/${PROJECT_CODIGO}/uploads/${pdf.keyName}`;
        
        console.log(`Encontrado Insumo: ${pdf.fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Fazer upload para o R2 remoto com --remote
        runCmd(`npx wrangler r2 object put "forense-bucket/${r2Key}" --file="${filePath}" --remote`);
        
        // Montar SQL para D1
        const uploadId = require('crypto').randomBytes(16).toString('hex');
        sqlStatements.push(
          `INSERT OR IGNORE INTO uploads (id, projeto_id, cliente_email, nome_original, r2_key, mime_type, tamanho, descricao, status) ` +
          `VALUES ('${uploadId}', '${PROJECT_ID}', '${CLIENT_EMAIL}', '${path.basename(pdf.fileName).replace(/'/g, "''")}', '${r2Key}', 'application/pdf', ${stats.size}, '${pdf.descricao.replace(/'/g, "''")}', 'recebido');`
        );
      } else {
        console.warn(`Aviso: Arquivo de insumo não encontrado: ${filePath}`);
      }
    }

    // Documentos Legais & Questionário
    const extraDeliverables = [
      {
        id: 'contrato_PPS-01711',
        fileName: 'documentos_legais/Contrato_Prestacao_Servicos_Inteligencia_PPS-01711.md',
        keyName: 'Contrato_PPS-01711.md',
        tipo: 'outro',
        mime: 'text/markdown',
        titulo: 'Contrato de Prestação de Serviços — PPS-01711/2026',
        descricao: 'Contrato de prestação de serviços assinado regulando a consultoria de inteligência.'
      },
      {
        id: 'nda_PPS-01711',
        fileName: 'documentos_legais/NDA_Acordo_Confidencialidade_PPS-01711.md',
        keyName: 'NDA_PPS-01711.md',
        tipo: 'outro',
        mime: 'text/markdown',
        titulo: 'Acordo de Confidencialidade (NDA) — PPS-01711/2026',
        descricao: 'Acordo de confidencialidade assinado regulando o sigilo de dados do projeto.'
      },
      {
        id: 'proposta_PPS-01711',
        fileName: 'insumos/Relatório 047.044.629-35.pdf',
        keyName: 'Proposta_Aprovada_PPS-01711.pdf',
        tipo: 'relatorio',
        mime: 'application/pdf',
        titulo: 'Proposta Comercial Aprovada — PPS-01711/2026',
        descricao: 'Proposta técnica e comercial aprovada contendo o escopo e a fundamentação da investigação.'
      },
      {
        id: 'questionario_PPS-01711',
        fileName: 'relatorios/questionario_alinhamento.md',
        keyName: 'questionario_alinhamento.md',
        tipo: 'relatorio',
        mime: 'text/markdown',
        titulo: 'Questionário de Alinhamento — Fase 1',
        descricao: 'Questionário contendo o ponto de vista da equipe de inteligência e validação de papéis dos investigados.'
      }
    ];

    for (const doc of extraDeliverables) {
      const filePath = path.join(planovaDir, doc.fileName);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const r2Key = `projetos/${PROJECT_CODIGO}/${doc.keyName}`;
        
        console.log(`Encontrado Documento do Projeto: ${doc.fileName} (${(stats.size / 1024).toFixed(2)} KB)`);
        
        // Fazer upload para o R2 remoto com --remote
        runCmd(`npx wrangler r2 object put "forense-bucket/${r2Key}" --file="${filePath}" --remote`);
        
        // Montar SQL de Entregável para D1
        sqlStatements.push(
          `INSERT OR REPLACE INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, versao, publicado) ` +
          `VALUES ('${doc.id}', '${PROJECT_ID}', '${doc.tipo}', '${doc.titulo.replace(/'/g, "''")}', '${doc.descricao.replace(/'/g, "''")}', '${r2Key}', '${doc.mime}', ${stats.size}, 1, 1);`
        );
      } else {
        console.warn(`Aviso: Documento do projeto não encontrado: ${filePath}`);
      }
    }

    if (sqlStatements.length > 0) {
      const sqlFile = path.join(__dirname, 'temp_uploads_seed_remote.sql');
      fs.writeFileSync(sqlFile, sqlStatements.join('\n'));
      console.log('\nSalvando registros no banco D1 remoto...');
      runCmd(`npx wrangler d1 execute forense-db --file="${sqlFile}" --remote`);
      fs.unlinkSync(sqlFile);
    }
  } else {
    console.warn(`Aviso: Diretório de insumos Planova não encontrado no caminho relativo: ${planovaDir}`);
  }

  // 4. Inserir marcos da timeline no D1 remoto
  console.log('\n4. Inserindo marcos da timeline no D1 remoto...');
  const timelineSql = `
    INSERT OR IGNORE INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
    VALUES ('t1_5f9630ec8b7c4a1eb4098bb36c310fb4', '${PROJECT_ID}', 'inicio', 'Projeto Iniciado', 'Proposta comercial código PPS-01711/2026 aprovada e integrada ao portal.', 1, 'resper@ness.com.br');
    
    INSERT OR IGNORE INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
    VALUES ('t2_5f9630ec8b7c4a1eb4098bb36c310fb4', '${PROJECT_ID}', 'status', 'Documentos Legais Assinados', 'Contrato de prestação de serviços de inteligência e Acordo de Confidencialidade (NDA) assinados pelas partes e anexados ao projeto.', 1, 'resper@ness.com.br');
    
    INSERT OR IGNORE INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
    VALUES ('t3_5f9630ec8b7c4a1eb4098bb36c310fb4', '${PROJECT_ID}', 'entrega', 'Entregáveis da Fase Inicial Publicados', 'Dossiê OSINT, Apresentação de Diretoria e Grafo Interativo de Vínculos foram publicados na plataforma.', 1, 'resper@ness.com.br');
    
    INSERT OR IGNORE INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor)
    VALUES ('t4_5f9630ec8b7c4a1eb4098bb36c310fb4', '${PROJECT_ID}', 'status', 'Questionário de Alinhamento Publicado', 'Questionário de primeira fase sobre o papel dos investigados disponibilizado para validação do cliente.', 1, 'resper@ness.com.br');
  `;
  const tempTimelineFile = path.join(__dirname, 'temp_timeline.sql');
  fs.writeFileSync(tempTimelineFile, timelineSql);
  runCmd(`npx wrangler d1 execute forense-db --file="${tempTimelineFile}" --remote`);
  fs.unlinkSync(tempTimelineFile);

  console.log('\n=== Seeding da Planova em PRODUÇÃO Concluído com Sucesso! ===');
}

main();
