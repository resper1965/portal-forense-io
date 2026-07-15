const { execSync } = require('child_process');

try {
  // Clean up previous runs
  console.log("Cleaning up previous test data...");
  try {
    execSync(`npx wrangler d1 execute forense-db --command="DELETE FROM projetos WHERE codigo_proposta='PPS-99999/2026'" --local`, { stdio: 'ignore' });
    execSync(`npx wrangler d1 execute forense-db --command="DELETE FROM clientes WHERE cnpj='88.888.888/0001-88'" --local`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore cleanup errors
  }

  console.log("Testing Client Creation...");
  const clientPost = execSync(
    `curl -s -X POST -H "X-Dev-Email: resper@ness.com.br" -H "Content-Type: application/json" ` +
    `-d "{\\\"razao_social\\\":\\\"Test Company S.A.\\\",\\\"cnpj\\\":\\\"88.888.888/0001-88\\\"}" ` +
    `http://localhost:8788/api/admin/clientes`
  ).toString();
  console.log("Client created response:", clientPost);
  const client = JSON.parse(clientPost);
  if (!client.id) throw new Error("Client creation returned no ID!");

  console.log("Testing Listing Clients (GET /api/admin/clientes)...");
  const clientsGet = execSync(
    `curl -s -X GET -H "X-Dev-Email: resper@ness.com.br" http://localhost:8788/api/admin/clientes`
  ).toString();
  console.log("Clients response length:", JSON.parse(clientsGet).length);
  const foundClient = JSON.parse(clientsGet).find(c => c.id === client.id);
  if (!foundClient) throw new Error("Created client not found in GET response!");

  console.log("Testing Project Creation...");
  const projectPost = execSync(
    `curl -s -X POST -H "X-Dev-Email: resper@ness.com.br" -H "Content-Type: application/json" ` +
    `-d "{\\\"codigo_proposta\\\":\\\"PPS-99999/2026\\\",\\\"cliente_id\\\":\\\"${client.id}\\\",\\\"titulo\\\":\\\"OSINT Test\\\"}" ` +
    `http://localhost:8788/api/admin/projetos`
  ).toString();
  console.log("Project created response:", projectPost);
  const project = JSON.parse(projectPost);
  if (!project.id) throw new Error("Project creation returned no ID!");
  
  console.log("Testing Listing Projects (GET /api/admin/projetos)...");
  const projectsGet = execSync(
    `curl -s -X GET -H "X-Dev-Email: resper@ness.com.br" http://localhost:8788/api/admin/projetos`
  ).toString();
  console.log("Projects response length:", JSON.parse(projectsGet).length);
  const foundProject = JSON.parse(projectsGet).find(p => p.id === project.id);
  if (!foundProject) throw new Error("Created project not found in admin projects GET response!");

  console.log("Testing general Project listing as Admin (GET /api/projetos)...");
  const generalProjectsGet = execSync(
    `curl -s -X GET -H "X-Dev-Email: resper@ness.com.br" http://localhost:8788/api/projetos`
  ).toString();
  const parsedGeneral = JSON.parse(generalProjectsGet);
  console.log("General projects count:", parsedGeneral.projetos ? parsedGeneral.projetos.length : 0);
  const foundInGeneral = parsedGeneral.projetos.find(p => p.id === project.id);
  if (!foundInGeneral) throw new Error("Created project not found in general projects listing as admin!");

  console.log("CRUD Tests PASSED!");
} catch (err) {
  console.error("CRUD Tests FAILED:", err.message);
  process.exit(1);
}
