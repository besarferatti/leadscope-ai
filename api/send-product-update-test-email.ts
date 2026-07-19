import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

type ApiRequest = { method?: string; headers: { authorization?: string | string[]; Authorization?: string | string[] }; body?: unknown };
type ApiResponse = { status: (statusCode: number) => ApiResponse; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
type SmtpSettings = { from_name: string | null; from_email: string | null; reply_to_email: string | null; smtp_host: string | null; smtp_port: number | null; smtp_username: string | null; smtp_password_encrypted: string | null; is_configured: boolean | null };
type RequestBody = { campaign_id?: unknown; update_id?: unknown; title?: unknown; subject?: unknown; body?: unknown };

const errorResponse = (res: ApiResponse, message: string, status = 400) => res.status(status).json({ error: message });

function decryptPassword(encryptedPassword: string, encryptionKey: string) {
  const [encodedIv, encodedCiphertext, ...remainder] = encryptedPassword.split(':');
  if (!encodedIv || !encodedCiphertext || remainder.length > 0) throw new Error('Invalid encrypted SMTP password.');
  const iv = Buffer.from(encodedIv, 'base64');
  const ciphertextWithTag = Buffer.from(encodedCiphertext, 'base64');
  if (iv.length !== 12 || ciphertextWithTag.length <= 16) throw new Error('Invalid encrypted SMTP password.');
  const key = createHash('sha256').update(encryptionKey, 'utf8').digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(ciphertextWithTag.subarray(-16));
  return Buffer.concat([decipher.update(ciphertextWithTag.subarray(0, -16)), decipher.final()]).toString('utf8');
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(smtp_password_encrypted|SMTP_ENCRYPTION_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*[=:]\s*\S+/gi, '$1=[REDACTED]').replace(/:\/\/[^\s:@/]+:[^\s@/]+@/g, '://[REDACTED]@').replace(/\b(pass(?:word)?|auth)\s*[=:]\s*\S+/gi, '$1=[REDACTED]');
}

function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function emailHtml(title: string, body: string) {
  const content = body.split('\n').map(line => {
    const escaped = escapeHtml(line.trim());
    if (!escaped) return '<div style="height:12px"></div>';
    if (escaped.startsWith('- ')) return `<li>${escaped.slice(2)}</li>`;
    return `<p style="margin:0 0 12px;color:#cbd5e1;line-height:1.6">${escaped}</p>`;
  }).join('');
  return `<!doctype html><html><body style="margin:0;background:#0f172a;font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto;padding:32px 20px"><section style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px"><h1 style="margin:0 0 20px;color:#fff;font-size:24px">${escapeHtml(title)}</h1>${content}<p style="margin:24px 0 0"><a href="https://www.leadscope.pro/updates" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">View product updates</a></p><hr style="border:0;border-top:1px solid #334155;margin:28px 0 16px"><p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5">You are receiving this because you registered for LeadScope AI. You can unsubscribe from product update emails at any time.</p></section></main></body></html>`;
}

export const config = { runtime: 'nodejs' };
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') return errorResponse(res, 'Method not allowed.', 405);
  const rawAuth = req.headers.authorization || req.headers.Authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return errorResponse(res, 'Unauthorized.', 401);
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return errorResponse(res, 'Unauthorized.', 401);
  const request = (req.body ?? {}) as RequestBody;
  const campaignId = typeof request.campaign_id === 'string' ? request.campaign_id.trim() : '';
  const updateId = typeof request.update_id === 'string' ? request.update_id.trim() : '';
  const title = typeof request.title === 'string' ? request.title.trim() : '';
  const subject = typeof request.subject === 'string' ? request.subject.trim() : '';
  const body = typeof request.body === 'string' ? request.body.trim() : '';
  if (!updateId || !title || !subject || !body) return errorResponse(res, 'Update, subject, and body are required.');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.SMTP_ENCRYPTION_KEY;
  if (!supabaseUrl || !serviceRoleKey || !encryptionKey) return errorResponse(res, 'Email sending is not configured.', 500);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !user?.email) return errorResponse(res, 'Unauthorized.', 401);
  const { data: profile } = await supabaseAdmin.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return errorResponse(res, 'Forbidden.', 403);

  const { data: settings, error: settingsError } = await supabaseAdmin.from('user_smtp_settings').select('from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, is_configured').eq('user_id', user.id).maybeSingle<SmtpSettings>();
  if (settingsError) return errorResponse(res, 'Unable to load SMTP settings.', 500);
  if (!settings?.is_configured || !settings.smtp_host || !settings.smtp_port || !settings.smtp_username || !settings.from_email || !settings.smtp_password_encrypted) return errorResponse(res, 'SMTP settings are not configured.');
  let password: string;
  try { password = decryptPassword(settings.smtp_password_encrypted, encryptionKey); } catch { return errorResponse(res, 'Unable to decrypt SMTP password. Please save SMTP settings again.', 500); }

  const fromEmail = settings.from_email.trim();
  const from = settings.from_name?.trim() ? `"${settings.from_name.trim()}" <${fromEmail}>` : fromEmail;
  const smtpPort = Number(settings.smtp_port);
  const transporter = nodemailer.createTransport({ host: settings.smtp_host, port: smtpPort, secure: smtpPort === 465, requireTLS: smtpPort === 587 ? true : undefined, auth: { user: settings.smtp_username.trim(), pass: password }, tls: { servername: settings.smtp_host } });
  const campaign = { update_id: updateId, title, subject, body, status: 'test_sent', test_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  try {
    await transporter.sendMail({ from, replyTo: settings.reply_to_email?.trim() || undefined, to: user.email, subject, text: `${body}\n\nYou are receiving this because you registered for LeadScope AI.\nYou can unsubscribe from product update emails at any time.`, html: emailHtml(title, body) });
    const query = campaignId ? supabaseAdmin.from('product_update_email_campaigns').update(campaign).eq('id', campaignId).select('id').single() : supabaseAdmin.from('product_update_email_campaigns').insert({ ...campaign, created_by: user.id }).select('id').single();
    const { data: savedCampaign, error: campaignError } = await query;
    if (campaignError || !savedCampaign) return errorResponse(res, 'Test email was sent, but the campaign could not be saved.', 500);
    return res.status(200).json({ success: true, campaign_id: savedCampaign.id });
  } catch (error) {
    const message = safeErrorMessage(error);
    if (campaignId) await supabaseAdmin.from('product_update_email_campaigns').update({ ...campaign, status: 'failed' }).eq('id', campaignId);
    return errorResponse(res, `Unable to send test email: ${message}`, 502);
  }
}
