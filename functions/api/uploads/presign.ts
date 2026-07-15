import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';
import { AwsClient } from 'aws4fetch';

/**
 * POST /api/uploads/presign — Generate presigned URL for client upload to R2.
 *
 * Body: { projeto_id, filename, mime_type, tamanho?, descricao?, turnstile_token }
 *
 * Flow:
 * 1. Verify Turnstile token server-side
 * 2. Verify client has access to the project
 * 3. Validate MIME type against allowed list
 * 4. Validate file size against MAX_UPLOAD_SIZE
 * 5. Generate unique R2 key
 * 6. Generate presigned PUT URL using aws4fetch
 * 7. Insert upload record with status='pendente'
 * 8. Return { presigned_url, upload_id, r2_key }
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { userEmail } = data;

  try {
    const body = await request.json<{
      projeto_id: string;
      filename: string;
      mime_type: string;
      tamanho?: number;
      descricao?: string;
      turnstile_token: string;
    }>();

    // Validate required fields
    if (!body.projeto_id || !body.filename || !body.mime_type || !body.turnstile_token) {
      return errorResponse('Campos obrigatórios: projeto_id, filename, mime_type, turnstile_token.', 400);
    }

    // 1. Verify Turnstile token
    const turnstileValid = await verifyTurnstile(env.TURNSTILE_SECRET, body.turnstile_token, request.headers.get('CF-Connecting-IP') || '');
    if (!turnstileValid) {
      return errorResponse('Verificação Turnstile falhou. Tente novamente.', 403);
    }

    // 2. Verify client has access to the project
    const projeto = await env.DB.prepare(
      `SELECT p.id, p.codigo_proposta AS codigo, cc.email AS cliente_email
       FROM projetos p
       JOIN contatos_cliente cc ON p.cliente_id = cc.cliente_id
       WHERE p.id = ? AND cc.email = ? AND cc.ativo = 1`
    )
      .bind(body.projeto_id, userEmail)
      .first<{ id: string; codigo: string; cliente_email: string }>();

    // Admins can also upload
    let projetoCodigo: string;
    if (!projeto) {
      if (data.isAdmin) {
        const adminProjeto = await env.DB.prepare('SELECT id, codigo_proposta AS codigo FROM projetos WHERE id = ?')
          .bind(body.projeto_id)
          .first<{ id: string; codigo: string }>();

        if (!adminProjeto) {
          return errorResponse('Projeto não encontrado.', 404);
        }
        projetoCodigo = adminProjeto.codigo;
      } else {
        return errorResponse('Acesso negado a este projeto.', 403);
      }
    } else {
      projetoCodigo = projeto.codigo;
    }

    // 3. Validate MIME type
    const allowedTypes = env.ALLOWED_UPLOAD_TYPES.split(',').map((t) => t.trim());
    if (!allowedTypes.includes(body.mime_type)) {
      return errorResponse(
        `Tipo de arquivo não permitido: ${body.mime_type}. Tipos aceitos: ${allowedTypes.join(', ')}`,
        400
      );
    }

    // 4. Validate file size
    const maxSize = parseInt(env.MAX_UPLOAD_SIZE || '52428800', 10);
    if (body.tamanho && body.tamanho > maxSize) {
      return errorResponse(
        `Arquivo excede o limite de ${Math.round(maxSize / 1048576)}MB.`,
        413
      );
    }

    // 5. Generate unique R2 key
    const timestamp = Date.now();
    const sanitizedFilename = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `uploads/${projetoCodigo}/${timestamp}_${sanitizedFilename}`;

    // 6. Generate presigned PUT URL using aws4fetch
    const aws = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    });

    // R2 presigned URL endpoint
    const r2Url = new URL(
      `${env.R2_ENDPOINT}/forense-bucket/${r2Key}`
    );
    r2Url.searchParams.set('X-Amz-Expires', '3600'); // 1 hour expiry

    const presigned = await aws.sign(
      new Request(r2Url.toString(), {
        method: 'PUT',
        headers: {
          'Content-Type': body.mime_type,
        },
      }),
      { aws: { signQuery: true } }
    );

    // 7. Insert upload record with status='pendente'
    const uploadId = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO uploads (id, projeto_id, cliente_email, nome_original, r2_key, mime_type, tamanho, descricao, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)`
    )
      .bind(
        uploadId,
        body.projeto_id,
        userEmail,
        body.filename,
        r2Key,
        body.mime_type,
        body.tamanho || null,
        body.descricao || null,
        now
      )
      .run();

    // 8. Return presigned URL and upload metadata
    return jsonResponse(
      {
        presigned_url: presigned.url,
        upload_id: uploadId,
        r2_key: r2Key,
        expires_in: 3600,
      },
      201
    );
  } catch (err) {
    return errorResponse(`Erro ao gerar URL de upload: ${(err as Error).message}`, 500);
  }
};

/**
 * Verify a Turnstile token server-side.
 */
async function verifyTurnstile(secret: string, token: string, remoteIp: string): Promise<boolean> {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: remoteIp,
      }),
    });

    const result = await response.json<{ success: boolean }>();
    return result.success === true;
  } catch {
    return false;
  }
};
