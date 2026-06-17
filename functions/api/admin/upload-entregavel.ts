import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * POST /api/admin/upload-entregavel — Upload a deliverable file to R2.
 *
 * Accepts file as multipart/form-data.
 * Stores in R2: projetos/{projeto_codigo}/{filename}
 * Creates entregável record in D1.
 * Optionally publishes immediately and sends notification.
 *
 * Form fields:
 * - file: File (the actual file)
 * - projeto_id: string (required)
 * - tipo: string (relatorio|apresentacao|proposta|anexo)
 * - titulo: string (required)
 * - descricao: string (optional)
 * - publicado: "0" | "1" (optional, default "0")
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { userEmail } = data;

  try {
    const contentType = request.headers.get('Content-Type') || '';

    let file: File | null = null;
    let projetoId: string = '';
    let tipo: string = 'relatorio';
    let titulo: string = '';
    let descricao: string = '';
    let publicado = 0;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data
      const formData = await request.formData();

      file = formData.get('file') as File | null;
      projetoId = (formData.get('projeto_id') as string) || '';
      tipo = (formData.get('tipo') as string) || 'relatorio';
      titulo = (formData.get('titulo') as string) || '';
      descricao = (formData.get('descricao') as string) || '';
      publicado = parseInt((formData.get('publicado') as string) || '0', 10);
    } else if (contentType.includes('application/json')) {
      // Handle JSON with base64 file content
      const body = await request.json<{
        projeto_id: string;
        tipo?: string;
        titulo: string;
        descricao?: string;
        publicado?: number;
        filename: string;
        mime_type: string;
        content_base64: string;
      }>();

      projetoId = body.projeto_id;
      tipo = body.tipo || 'relatorio';
      titulo = body.titulo;
      descricao = body.descricao || '';
      publicado = body.publicado ?? 0;

      // Decode base64 content
      const binaryString = atob(body.content_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      file = new File([bytes], body.filename, { type: body.mime_type });
    } else {
      return errorResponse('Content-Type deve ser multipart/form-data ou application/json.', 400);
    }

    // Validate required fields
    if (!file) {
      return errorResponse('Arquivo obrigatório (campo "file" ou content_base64).', 400);
    }

    if (!projetoId || !titulo) {
      return errorResponse('Campos obrigatórios: projeto_id, titulo.', 400);
    }

    // Fetch project info
    const projeto = await env.DB.prepare(
      `SELECT p.id, p.codigo, c.email AS cliente_email, c.nome AS cliente_nome
       FROM projetos p
       JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = ?`
    )
      .bind(projetoId)
      .first<{ id: string; codigo: string; cliente_email: string; cliente_nome: string }>();

    if (!projeto) {
      return errorResponse('Projeto não encontrado.', 404);
    }

    // Generate R2 key
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `projetos/${projeto.codigo}/${sanitizedFilename}`;

    // Upload to R2
    const fileBuffer = await file.arrayBuffer();
    await env.BUCKET.put(r2Key, fileBuffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: {
        uploadedBy: userEmail,
        titulo: titulo,
        projeto: projeto.codigo,
      },
    });

    // Create entregável record in D1
    const entregavelId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO entregaveis (id, projeto_id, tipo, titulo, descricao, r2_key, mime_type, tamanho, publicado, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        entregavelId,
        projetoId,
        tipo,
        titulo,
        descricao || null,
        r2Key,
        file.type || 'application/octet-stream',
        fileBuffer.byteLength,
        publicado,
        now,
        now
      )
      .run();

    // If published, add timeline entry and send email notification
    if (publicado === 1) {
      const tipoLabels: Record<string, string> = {
        relatorio: 'Relatório',
        apresentacao: 'Apresentação',
        proposta: 'Proposta',
        anexo: 'Anexo',
      };
      const label = tipoLabels[tipo] || tipo;

      // Timeline entry
      context.waitUntil(
        env.DB.prepare(
          `INSERT INTO timeline (id, projeto_id, tipo, titulo, descricao, visivel_cliente, autor, created_at)
           VALUES (?, ?, 'entrega', ?, ?, 1, ?, datetime('now'))`
        )
          .bind(
            crypto.randomUUID(),
            projetoId,
            `${label} publicado: ${titulo}`,
            `O ${label.toLowerCase()} "${titulo}" foi publicado e está disponível para visualização.`,
            userEmail
          )
          .run()
          .catch(() => {})
      );

      // Email notification (graceful — may not have binding)
      if (projeto.cliente_email) {
        context.waitUntil(
          (async () => {
            try {
              if (env.EMAIL && typeof env.EMAIL.send === 'function') {
                await env.EMAIL.send({
                  to: projeto.cliente_email,
                  from: 'portal@forense.io',
                  subject: `Novo ${label} disponível — ${titulo}`,
                  html: `<html><body style="font-family: 'Montserrat', sans-serif; color: #e0e0e0; background: #0a0a0f; padding: 20px;">` +
                    `<div style="border-bottom: 2px solid #00ade8; padding-bottom: 16px; margin-bottom: 24px;">` +
                    `<span style="font-size: 20px; font-weight: 500; color: #fff;">forense<span style="color: #00ade8;">.</span>io</span></div>` +
                    `<h2 style="color: #fff;">Olá, ${projeto.cliente_nome}</h2>` +
                    `<p style="color: #ccc;">Um novo ${label.toLowerCase()} está disponível no seu portal:</p>` +
                    `<p style="color: #fff;"><strong>${titulo}</strong></p>` +
                    `<p><a href="https://portal.forense.io" style="background: #00ade8; color: #0a0a0f; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Acessar Portal</a></p>` +
                    `<p style="color: #666; font-size: 12px; margin-top: 32px;">forense.io · a ness. company</p>` +
                    `</body></html>`,
                  text: `Olá, ${projeto.cliente_nome}. Um novo ${label.toLowerCase()} "${titulo}" está disponível em portal.forense.io`,
                });
              }
            } catch {
              // Silently ignore email errors
            }
          })()
        );
      }
    }

    return jsonResponse(
      {
        id: entregavelId,
        projeto_id: projetoId,
        projeto_codigo: projeto.codigo,
        tipo,
        titulo,
        r2_key: r2Key,
        mime_type: file.type,
        tamanho: fileBuffer.byteLength,
        publicado,
        created_at: now,
      },
      201
    );
  } catch (err) {
    return errorResponse(`Erro ao fazer upload do entregável: ${(err as Error).message}`, 500);
  }
};
