const { execSync } = require('child_process');

async function runTests() {
  console.log("Cleaning up previous test data...");
  try {
    execSync(`npx wrangler d1 execute forense-db --command="DELETE FROM contatos_cliente WHERE email='john.doe@test.com'" --local`, { stdio: 'ignore' });
    execSync(`npx wrangler d1 execute forense-db --command="DELETE FROM projetos WHERE codigo_proposta='PPS-99999/2026'" --local`, { stdio: 'ignore' });
    execSync(`npx wrangler d1 execute forense-db --command="DELETE FROM clientes WHERE cnpj='88.888.888/0001-88'" --local`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore cleanup errors
  }

  const baseUrl = 'http://localhost:8788';
  const headers = {
    'X-Dev-Email': 'resper@ness.com.br',
    'Content-Type': 'application/json'
  };

  // ==========================================
  // CLIENTES CRUD TESTS
  // ==========================================
  console.log("\n--- Testing Clientes CRUD ---");

  // 1. Create Client (POST)
  console.log("Testing Client Creation (POST /api/admin/clientes)...");
  let res = await fetch(`${baseUrl}/api/admin/clientes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      razao_social: "Test Company S.A.",
      cnpj: "88.888.888/0001-88",
      notes: "Initial client notes"
    })
  });
  if (res.status !== 201) throw new Error(`Expected 201 on client create, got ${res.status}`);
  const client = await res.json();
  console.log("Client created:", client);
  if (!client.id) throw new Error("Client creation returned no ID!");

  // 2. Validate Duplicate CNPJ (POST conflict)
  console.log("Testing Duplicate CNPJ Conflict (POST /api/admin/clientes)...");
  res = await fetch(`${baseUrl}/api/admin/clientes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      razao_social: "Duplicate Corp",
      cnpj: "88.888.888/0001-88"
    })
  });
  console.log("Duplicate CNPJ status code (expected 409):", res.status);
  if (res.status !== 409) throw new Error(`Expected 409 status code on duplicate CNPJ, got ${res.status}`);

  // 3. List Clients (GET)
  console.log("Testing Listing Clients (GET /api/admin/clientes)...");
  res = await fetch(`${baseUrl}/api/admin/clientes`, { headers });
  if (res.status !== 200) throw new Error(`Expected 200 on client list, got ${res.status}`);
  const clients = await res.json();
  const foundClient = clients.find(c => c.id === client.id);
  if (!foundClient) throw new Error("Created client not found in GET response!");
  console.log(`Found client "${foundClient.razao_social}" (Projects: ${foundClient.projetos_count})`);

  // 4. Update Client (PUT)
  console.log("Testing Client Update (PUT /api/admin/clientes)...");
  res = await fetch(`${baseUrl}/api/admin/clientes`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      id: client.id,
      razao_social: "Updated Company S.A.",
      notas: "Updated notes"
    })
  });
  if (res.status !== 200) throw new Error(`Expected 200 on client update, got ${res.status}`);
  const updatedClient = await res.json();
  console.log("Client updated:", updatedClient);
  if (updatedClient.razao_social !== "Updated Company S.A.") throw new Error("Client name was not updated!");

  // ==========================================
  // CONTATOS CRUD TESTS
  // ==========================================
  console.log("\n--- Testing Contatos CRUD ---");

  // 1. Create Contact (POST)
  console.log("Testing Contact Creation (POST /api/admin/contatos)...");
  res = await fetch(`${baseUrl}/api/admin/contatos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      cliente_id: client.id,
      nome: "John Doe",
      email: "john.doe@test.com",
      telefone: "11999999999",
      cargo: "Diretor"
    })
  });
  if (res.status !== 201) throw new Error(`Expected 201 on contact create, got ${res.status}`);
  const contact = await res.json();
  console.log("Contact created:", contact);

  // 2. Validate Contact Email Format (POST 400)
  console.log("Testing Contact Email Validation (POST /api/admin/contatos)...");
  res = await fetch(`${baseUrl}/api/admin/contatos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      cliente_id: client.id,
      nome: "Jane",
      email: "invalidemail"
    })
  });
  console.log("Invalid email status code (expected 400):", res.status);
  if (res.status !== 400) throw new Error(`Expected 400 status code on invalid email format, got ${res.status}`);

  // 3. List Contacts (GET)
  console.log("Testing Listing Contacts (GET /api/admin/contatos)...");
  res = await fetch(`${baseUrl}/api/admin/contatos`, { headers });
  if (res.status !== 200) throw new Error(`Expected 200 on contacts list, got ${res.status}`);
  const contacts = await res.json();
  const foundContact = contacts.find(c => c.id === contact.id);
  if (!foundContact) throw new Error("Created contact not found in GET response!");

  // 4. List Contacts by client_id (GET)
  console.log("Testing Listing Contacts by client_id...");
  res = await fetch(`${baseUrl}/api/admin/contatos?cliente_id=${client.id}`, { headers });
  if (res.status !== 200) throw new Error(`Expected 200 on contacts filter, got ${res.status}`);
  const contactsByClient = await res.json();
  if (!contactsByClient.some(c => c.id === contact.id)) throw new Error("Contact not found in client-filtered GET response!");

  // 5. Update Contact (PUT)
  console.log("Testing Contact Update (PUT /api/admin/contatos)...");
  res = await fetch(`${baseUrl}/api/admin/contatos`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      id: contact.id,
      nome: "John Doe Updated",
      cargo: "VP"
    })
  });
  if (res.status !== 200) throw new Error(`Expected 200 on contact update, got ${res.status}`);
  const updatedContact = await res.json();
  console.log("Contact updated:", updatedContact);
  if (updatedContact.nome !== "John Doe Updated") throw new Error("Contact name was not updated!");

  // 6. Delete Contact (DELETE)
  console.log("Testing Contact Deactivation (DELETE /api/admin/contatos)...");
  res = await fetch(`${baseUrl}/api/admin/contatos?id=${contact.id}`, {
    method: 'DELETE',
    headers
  });
  if (res.status !== 200) throw new Error(`Expected 200 on contact delete, got ${res.status}`);
  const deletedContactResult = await res.json();
  if (!deletedContactResult.deactivated) throw new Error("Contact was not deactivated!");

  // Verify deactivation in GET
  res = await fetch(`${baseUrl}/api/admin/contatos`, { headers });
  const freshContacts = await res.json();
  const freshContact = freshContacts.find(c => c.id === contact.id);
  if (!freshContact || freshContact.ativo !== 0) throw new Error("Contact ativo status was not set to 0!");

  // ==========================================
  // PROJETOS CRUD TESTS
  // ==========================================
  console.log("\n--- Testing Projetos CRUD ---");

  // 1. Create Project (POST)
  console.log("Testing Project Creation (POST /api/admin/projetos)...");
  res = await fetch(`${baseUrl}/api/admin/projetos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      codigo_proposta: "PPS-99999/2026",
      cliente_id: client.id,
      titulo: "OSINT Test",
      descricao: "OSINT Project",
      valor: 15000
    })
  });
  if (res.status !== 201) throw new Error(`Expected 201 on project create, got ${res.status}`);
  const project = await res.json();
  console.log("Project created:", project);

  // 2. Validate Duplicate Proposal Code (POST conflict)
  console.log("Testing Duplicate Proposal Code Conflict...");
  res = await fetch(`${baseUrl}/api/admin/projetos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      codigo_proposta: "PPS-99999/2026",
      cliente_id: client.id,
      titulo: "OSINT Test 2"
    })
  });
  console.log("Duplicate project status (expected 409):", res.status);
  if (res.status !== 409) throw new Error(`Expected 409 on duplicate project, got ${res.status}`);

  // 3. List Projects (GET)
  console.log("Testing Listing Projects (GET /api/admin/projetos)...");
  res = await fetch(`${baseUrl}/api/admin/projetos`, { headers });
  if (res.status !== 200) throw new Error(`Expected 200 on project list, got ${res.status}`);
  const projects = await res.json();
  const foundProject = projects.find(p => p.id === project.id);
  if (!foundProject) throw new Error("Created project not found in GET response!");
  console.log(`Found project "${foundProject.titulo}" under client "${foundProject.cliente_razao_social}"`);

  // 4. Update Project (PUT)
  console.log("Testing Project Update (PUT /api/admin/projetos)...");
  res = await fetch(`${baseUrl}/api/admin/projetos`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      id: project.id,
      titulo: "OSINT Test Updated",
      status: "em_andamento"
    })
  });
  if (res.status !== 200) throw new Error(`Expected 200 on project update, got ${res.status}`);
  const updatedProject = await res.json();
  console.log("Project updated:", updatedProject);

  // 5. Delete Project (DELETE)
  console.log("Testing Project Deletion (DELETE /api/admin/projetos)...");
  res = await fetch(`${baseUrl}/api/admin/projetos?id=${project.id}`, {
    method: 'DELETE',
    headers
  });
  if (res.status !== 200) throw new Error(`Expected 200 on project delete, got ${res.status}`);
  const deletedProjectResult = await res.json();
  if (!deletedProjectResult.deleted) throw new Error("Project was not deleted!");

  // Verify deletion in GET
  res = await fetch(`${baseUrl}/api/admin/projetos`, { headers });
  const freshProjects = await res.json();
  if (freshProjects.some(p => p.id === project.id)) throw new Error("Project was still found in GET list after deletion!");

  // ==========================================
  // CLIENT DELETE / SOFT-DELETE TESTS
  // ==========================================
  console.log("\n--- Testing Clientes Soft Delete ---");

  // 1. Delete Client (DELETE / Soft delete)
  console.log("Testing Client Deactivation (DELETE /api/admin/clientes)...");
  res = await fetch(`${baseUrl}/api/admin/clientes?id=${client.id}`, {
    method: 'DELETE',
    headers
  });
  if (res.status !== 200) throw new Error(`Expected 200 on client delete, got ${res.status}`);
  const deactivatedClientResult = await res.json();
  if (!deactivatedClientResult.deactivated) throw new Error("Client was not deactivated!");

  // Verify deactivation in GET
  res = await fetch(`${baseUrl}/api/admin/clientes`, { headers });
  const freshClients = await res.json();
  const freshClient = freshClients.find(c => c.id === client.id);
  if (!freshClient || freshClient.ativo !== 0) throw new Error("Client ativo status was not set to 0!");

  console.log("\n==========================================");
  console.log("ALL CRUD TESTS PASSED SUCCESSFULLY!");
  console.log("==========================================");
}

runTests().catch(err => {
  console.error("\n==========================================");
  console.error("CRUD TESTS FAILED:", err.message);
  console.error("==========================================");
  process.exit(1);
});
