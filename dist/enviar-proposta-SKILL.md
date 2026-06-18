---
name: enviar-proposta-portal-forense
description: Cadastra clientes e envia propostas comerciais (projetos com status 'proposta') com entregáveis para o portal.forense.io via API REST.
---

# Envio de Propostas — portal.forense.io

Esta skill permite a agentes de IA automatizarem o processo de prospecção e envio de propostas comerciais de investigação de inteligência/OSINT diretamente para o portal da Ness/Forense.io.

## Fluxo de Integração

O envio completo de uma proposta consiste em 3 etapas consecutivas via API:
1. **Cadastrar o Cliente:** Obter o `cliente_id` a partir do e-mail de contato dele.
2. **Criar a Proposta:** Registrar a proposta comercial no banco vinculada ao `cliente_id` com o status inicial `'proposta'`.
3. **Enviar os Entregáveis (Opcional):** Fazer o upload dos arquivos HTML/PDF correspondentes (deck comercial, dossiê inicial ou grafo).

---

## 🔑 Autenticação

Em desenvolvimento/localhost, envie o cabeçalho HTTP:
* `X-Dev-Email: <seu_email_admin@ness.com.br>`

Em produção, envie a sessão autenticada utilizando o cookie `portal_session` ou cabeçalhos de autorização do Cloudflare Access se configurado.

---

## 📡 Endpoints da API

### 1. Criar Cliente
* **URL:** `POST https://portal.forense.io/api/admin/clientes`
* **Content-Type:** `application/json`
* **Body:**
```json
{
  "nome": "Nome do Ponto de Contato",
  "empresa": "Razão Social da Empresa Cliente",
  "email": "contato@empresa.com",
  "telefone": "(11) 99999-9999",
  "notas": "Notas ou informações adicionais sobre o contexto comercial."
}
```
* **Resposta de Sucesso (201 Created):**
```json
{
  "id": "uuid-do-cliente",
  "nome": "Nome do Ponto de Contato",
  "email": "contato@empresa.com",
  "ativo": 1,
  "created_at": "2026-06-18T15:00:00.000Z"
}
```

---

### 2. Criar Proposta Comercial
* **URL:** `POST https://portal.forense.io/api/projetos`
* **Content-Type:** `application/json`
* **Body:**
```json
{
  "codigo": "PPS-XXXXX/2026",
  "cliente_id": "uuid-do-cliente",
  "titulo": "Mapeamento de Riscos & OSINT — Alvo: [Nome do Alvo]",
  "descricao": "Escopo detalhado da proposta comercial de inteligência.",
  "tipo": "inteligencia",
  "status": "proposta",
  "valor": 12500.00,
  "data_inicio": "2026-06-18",
  "data_entrega": "2026-06-25"
}
```
* **Resposta de Sucesso (201 Created):**
```json
{
  "id": "uuid-da-proposta",
  "codigo": "PPS-XXXXX/2026",
  "cliente_id": "uuid-do-cliente",
  "titulo": "Mapeamento de Riscos & OSINT — Alvo: [Nome do Alvo]",
  "status": "proposta",
  "created_at": "2026-06-18T15:05:00.000Z"
}
```

---

### 3. Fazer Upload de Entregáveis (Deck, Dossiê ou Grafo)
* **URL:** `POST https://portal.forense.io/api/admin/upload-entregavel`
* **Content-Type:** `multipart/form-data`
* **Form-Data:**
  * `projeto_id`: `uuid-da-proposta` (String)
  * `tipo`: `'relatorio'` ou `'apresentacao'` ou `'outro'` (String)
  * `titulo`: `"Deck Comercial Interativo"` (String)
  * `descricao`: `"Apresentação executiva e escopo de proposta."` (String)
  * `publicado`: `1` (Integer - 1 para visível ao cliente, 0 para rascunho admin)
  * `file`: `[Arquivo Binário]` (HTML/PDF)

* **Resposta de Sucesso (201 Created):**
```json
{
  "success": true,
  "entregavel_id": "uuid-do-entregavel",
  "r2_key": "projetos/PPS-XXXXX/2026/arquivo.html"
}
```

---

## 🐍 Exemplo de Script Automatizado (Python)

Você pode usar o seguinte script em Python para realizar o fluxo completo de cadastro:

```python
import requests

API_BASE = "https://portal.forense.io"
HEADERS = {
    "X-Dev-Email": "resper@ness.com.br" # Substitua pelo e-mail admin logado
}

# 1. Cadastra Cliente
cliente_payload = {
    "nome": "Diretoria Planova",
    "empresa": "Planova S/A",
    "email": "planova@cliente.com"
}
res_cli = requests.post(f"{API_BASE}/api/admin/clientes", json=cliente_payload, headers=HEADERS)
cliente_id = res_cli.json()["id"]

# 2. Cadastra Proposta
proposta_payload = {
    "codigo": "PPS-02000/2026",
    "cliente_id": cliente_id,
    "titulo": "Mapeamento de Riscos & OSINT — Alvo: Alvo Exemplo",
    "descricao": "Proposta comercial inicial.",
    "status": "proposta",
    "valor": 15000.00
}
res_prop = requests.post(f"{API_BASE}/api/projetos", json=proposta_payload, headers=HEADERS)
proposta_id = res_prop.json()["id"]

# 3. Envia o Deck HTML Comercial
files = {
    "file": ("apresentacao.html", open("caminho/do/deck.html", "rb"), "text/html")
}
data = {
    "projeto_id": proposta_id,
    "tipo": "apresentacao",
    "titulo": "Deck Comercial Interativo",
    "descricao": "Deck de apresentação de escopo comercial.",
    "publicado": 1
}
res_upload = requests.post(f"{API_BASE}/api/admin/upload-entregavel", data=data, files=files, headers=HEADERS)
print("Fluxo concluído:", res_upload.json())
```
