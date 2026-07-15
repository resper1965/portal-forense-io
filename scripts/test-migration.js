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
