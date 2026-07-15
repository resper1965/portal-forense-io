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
  console.log('=== Iniciando Seeding do Cliente Planova (Apenas Proposta) ===\n');

  // 1. Rodar Migrações e seed.sql (que contém apenas a proposta como entregável)
  console.log('1. Migrando e Seeding do Banco D1 Local...');
  runCmd('npx wrangler d1 execute forense-db --file=migrations/0001_initial.sql --local');
  runCmd('npx wrangler d1 execute forense-db --file=seed.sql --local');

  // 2. Procurar e subir os arquivos na pasta Planova
  console.log('\n2. Verificando documentos e insumos na pasta Planova...');
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

    // Apenas a Proposta Aprovada como Entregável
    const proposalFile = {
      id: 'proposta_PPS-01711',
      fileName: 'insumos/Relatório 047.044.629-35.pdf',
      keyName: 'Proposta_Aprovada_PPS-01711.pdf',
      tipo: 'relatorio',
      mime: 'application/pdf',
      titulo: 'Proposta Comercial Aprovada — PPS-01711/2026',
      descricao: 'Proposta técnica e comercial aprovada contendo o escopo e a fundamentação da investigação.'
    };

    const filePath = path.join(planovaDir, proposalFile.fileName);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const r2Key = `projetos/${PROJECT_CODIGO}/${proposalFile.keyName}`;
      
      console.log(`Encontrada Proposta Aprovada: ${proposalFile.fileName} (${(stats.size / 1024).toFixed(2)} KB)`);
      
      // Fazer upload para o R2 local
      runCmd(`npx wrangler r2 object put "forense-bucket/${r2Key}" --file="${filePath}" --local`);
      
      // Montar SQL de Entregável para D1 (garantir o tamanho real do arquivo)
      sqlStatements.push(
        `INSERT OR REPLACE INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, versao, publicado) ` +
        `VALUES ('${proposalFile.id}', '${PROJECT_ID}', '${proposalFile.tipo}', '${proposalFile.titulo.replace(/'/g, "''")}', '${proposalFile.descricao.replace(/'/g, "''")}', '${r2Key}', '${proposalFile.mime}', ${stats.size}, 1, 1);`
      );
    } else {
      console.warn(`Aviso: Arquivo da proposta não encontrado: ${filePath}`);
    }

    if (sqlStatements.length > 0) {
      const sqlFile = path.join(__dirname, 'temp_uploads_seed.sql');
      fs.writeFileSync(sqlFile, sqlStatements.join('\n'));
      console.log('\nSalvando registros no banco D1 local...');
      runCmd(`npx wrangler d1 execute forense-db --file="${sqlFile}" --local`);
      fs.unlinkSync(sqlFile);
    }
  } else {
    console.warn(`Aviso: Diretório de insumos Planova não encontrado no caminho relativo: ${planovaDir}`);
  }

  console.log('\n=== Seeding da Planova Concluído com Sucesso! ===');
}

main();
