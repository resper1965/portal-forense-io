import type { Env, UserContext } from '../../types';
import { jsonResponse, errorResponse } from '../../types';

/**
 * POST /api/admin/send-notification — Send custom email notification to a client.
 *
 * Body: {
 *   cliente_email: string,
 *   subject: string,
 *   html?: string,
 *   text?: string,
 *   cliente_nome?: string
 * }
 *
 * Uses Cloudflare Email Service REST API.
 * From: portal@forense.io
 */
export const onRequestPost: PagesFunction<Env, string, UserContext> = async (context) => {
  const { request, env, data } = context;
  const { userEmail } = data;

  try {
    const body = await request.json<{
      cliente_email: string;
      subject: string;
      html?: string;
      text?: string;
      cliente_nome?: string;
    }>();

    // Validate required fields
    if (!body.cliente_email || !body.subject) {
      return errorResponse('Campos obrigatórios: cliente_email, subject.', 400);
    }

    if (!body.html && !body.text) {
      return errorResponse('Pelo menos um de "html" ou "text" deve ser fornecido.', 400);
    }

    // Validate email format
    if (!body.cliente_email.includes('@')) {
      return errorResponse('Email do cliente inválido.', 400);
    }

    // Build email content with branding
    const recipientName = body.cliente_nome || body.cliente_email.split('@')[0];

    let htmlContent = body.html || '';
    if (htmlContent) {
      htmlContent = `
        <html>
        <body style="font-family: 'Montserrat', -apple-system, sans-serif; color: #e0e0e0; background: #0a0a0f; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="border-bottom: 2px solid #00ade8; padding-bottom: 16px; margin-bottom: 24px;">
            <span style="font-size: 20px; font-weight: 500; color: #fff;">forense<span style="color: #00ade8;">.</span>io</span>
            <span style="font-size: 12px; color: #666; margin-left: 12px;">a ness<span style="color: #00ade8;">.</span> company</span>
          </div>
          ${body.html}
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #1a1a2e;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              forense.io · <a href="https://portal.forense.io" style="color: #00ade8;">portal.forense.io</a>
            </p>
          </div>
        </body>
        </html>
      `.trim();
    }

    const textContent = body.text || '';

    // Send via Cloudflare Email Service REST API
    const accountId = env.R2_ACCOUNT_ID;

    // Use the Worker's own service binding or fetch directly
    // Since Pages Functions can't have send_email binding,
    // we use the REST API with the CF API token from the request context
    let emailSent = false;
    let emailError = '';

    try {
      // Try using the Email Service Worker binding if available
      if (env.EMAIL && typeof env.EMAIL.send === 'function') {
        await env.EMAIL.send({
          to: body.cliente_email,
          from: 'portal@forense.io',
          subject: body.subject,
          html: htmlContent || undefined,
          text: textContent || undefined,
        });
        emailSent = true;
      } else {
        // Email binding not available — log but don't fail
        emailError = 'Email Service binding não configurado. Configure via dashboard CF.';
      }
    } catch (sendErr) {
      emailError = (sendErr as Error).message;
    }

    // Log the notification (non-blocking)
    context.waitUntil(
      env.DB.prepare(
        `INSERT INTO access_log (id, email, acao, recurso, ip, user_agent, created_at)
         VALUES (?, ?, 'send_notification', ?, ?, ?, datetime('now'))`
      )
        .bind(
          crypto.randomUUID(),
          userEmail,
          `email_to:${body.cliente_email}:${body.subject}`,
          context.request.headers.get('CF-Connecting-IP') || 'unknown',
          context.request.headers.get('User-Agent') || ''
        )
        .run()
        .catch(() => {})
    );

    return jsonResponse({
      sent: emailSent,
      to: body.cliente_email,
      subject: body.subject,
      sent_by: userEmail,
      warning: emailError || undefined,
    });
  } catch (err) {
    return errorResponse(`Erro ao enviar notificação: ${(err as Error).message}`, 500);
  }
};
