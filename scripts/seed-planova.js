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
  console.log('=== Iniciando Seeding do Cliente Planova ===\n');

  // 1. Rodar Migrações e seed.sql
  console.log('1. Migrando e Seeding do Banco D1 Local...');
  runCmd('npx wrangler d1 execute forense-db --file=migrations/0001_initial.sql --local');
  runCmd('npx wrangler d1 execute forense-db --file=seed.sql --local');

  // 2. Upload dos entregáveis da pasta dist para R2 local
  console.log('\n2. Fazendo upload dos entregáveis (dist/) para o R2 Local...');
  const deliverables = [
    {
      file: 'dossie_victor_penzo.html',
      key: `projetos/${PROJECT_CODIGO}/dossie_victor_penzo.html`
    },
    {
      file: 'apresentacao_osint.html',
      key: `projetos/${PROJECT_CODIGO}/apresentacao_osint.html`
    },
    {
      file: 'grafo_victor_penzo.html',
      key: `projetos/${PROJECT_CODIGO}/grafo_victor_penzo.html`
    }
  ];

  for (const deliv of deliverables) {
    const filePath = path.join(__dirname, '../dist', deliv.file);
    if (fs.existsSync(filePath)) {
      runCmd(`npx wrangler r2 object put "forense-bucket/${deliv.key}" --file="${filePath}" --local`);
    } else {
      console.warn(`Aviso: Arquivo de entregável não encontrado: ${filePath}`);
    }
  }

  // 3. Procurar e subir os PDFs de insumos e documentos legais na pasta Planova
  console.log('\n3. Verificando documentos e insumos na pasta Planova...');
  const planovaDir = path.join(__dirname, '../../Planova');
  
  if (fs.existsSync(planovaDir)) {
    const sqlStatements = [];

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
        
        // Fazer upload para o R2 local
        runCmd(`npx wrangler r2 object put "forense-bucket/${r2Key}" --file="${filePath}" --local`);
        
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

    // Documentos Legais & Proposta como Entregáveis do Projeto
    const legalFiles = [
      {
        id: 'contrato_PPS-01711',
        fileName: 'documentos_legais/Contrato_Prestacao_Servicos_Inteligencia_PPS-01711.md',
        keyName: 'Contrato_PPS-01711.md',
        tipo: 'outro',
        mime: 'text/markdown',
        titulo: 'Contrato de Prestação de Serviços — PPS-01711/2026',
        descricao: 'Contrato assinado de prestação de serviços de inteligência corporativa e OSINT.'
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
        descricao: 'Proposta técnica e comercial aprovada contendo o escopo e fundamentação da investigação.'
      }
    ];

    for (const doc of legalFiles) {
      const filePath = path.join(planovaDir, doc.fileName);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const r2Key = `projetos/${PROJECT_CODIGO}/${doc.keyName}`;
        
        console.log(`Encontrado Documento Legal: ${doc.fileName} (${(stats.size / 1024).toFixed(2)} KB)`);
        
        // Fazer upload para o R2 local
        runCmd(`npx wrangler r2 object put "forense-bucket/${r2Key}" --file="${filePath}" --local`);
        
        // Montar SQL de Entregável para D1
        sqlStatements.push(
          `INSERT OR IGNORE INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, versao, publicado) ` +
          `VALUES ('${doc.id}', '${PROJECT_ID}', '${doc.tipo}', '${doc.titulo.replace(/'/g, "''")}', '${doc.descricao.replace(/'/g, "''")}', '${r2Key}', '${doc.mime}', ${stats.size}, 1, 1);`
        );
      } else {
        console.warn(`Aviso: Documento legal não encontrado: ${filePath}`);
      }
    }

    if (sqlStatements.length > 0) {
      const sqlFile = path.join(__dirname, 'temp_uploads_seed.sql');
      fs.writeFileSync(sqlFile, sqlStatements.join('\n'));
      console.log('\nSalvando registros de uploads e entregáveis no banco D1 local...');
      runCmd(`npx wrangler d1 execute forense-db --file="${sqlFile}" --local`);
      fs.unlinkSync(sqlFile);
    }
  } else {
    console.warn(`Aviso: Diretório de insumos Planova não encontrado no caminho relativo: ${planovaDir}`);
  }

  console.log('\n=== Seeding da Planova Concluído com Sucesso! ===');
}

main();
