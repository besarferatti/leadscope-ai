import { createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

type ApiRequest = { method?: string; headers: { authorization?: string | string[]; Authorization?: string | string[] }; body?: unknown };
type ApiResponse = { status: (statusCode: number) => ApiResponse; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
type SmtpSettings = { from_name: string | null; from_email: string | null; reply_to_email: string | null; smtp_host: string | null; smtp_port: number | null; smtp_username: string | null; smtp_password_encrypted: string | null; is_configured: boolean | null };
type Campaign = { id: string; update_id: string; title: string; subject: string; body: string; status: string };
type Preference = { user_id: string; email: string; product_updates_enabled: boolean; unsubscribe_token: string };
type Recipient = { id: string; user_id: string | null; email: string; status: string };
type RequestBody = { campaign_id?: unknown; update_id?: unknown; subject?: unknown; body?: unknown; preview?: unknown };
type EligibleRecipient = { userId: string; email: string; unsubscribeToken: string };

const errorResponse = (res: ApiResponse, message: string, status = 400) => res.status(status).json({ error: message });
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function decryptPassword(encryptedPassword: string, encryptionKey: string) {
  const [encodedIv, encodedCiphertext, ...remainder] = encryptedPassword.split(':');
  if (!encodedIv || !encodedCiphertext || remainder.length > 0) throw new Error('Invalid encrypted SMTP password.');
  const iv = Buffer.from(encodedIv, 'base64');
  const ciphertextWithTag = Buffer.from(encodedCiphertext, 'base64');
  if (iv.length !== 12 || ciphertextWithTag.length <= 16) throw new Error('Invalid encrypted SMTP password.');
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(encryptionKey, 'utf8').digest(), iv);
  decipher.setAuthTag(ciphertextWithTag.subarray(-16));
  return Buffer.concat([decipher.update(ciphertextWithTag.subarray(0, -16)), decipher.final()]).toString('utf8');
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(smtp_password_encrypted|SMTP_ENCRYPTION_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*[=:]\s*\S+/gi, '$1=[REDACTED]').replace(/:\/\/[^\s:@/]+:[^\s@/]+@/g, '://[REDACTED]@').replace(/\b(pass(?:word)?|auth)\s*[=:]\s*\S+/gi, '$1=[REDACTED]');
}
function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function campaignHtml(title: string, body: string, unsubscribeToken: string) {
  const content = body.split('\n').map(line => {
    const escaped = escapeHtml(line.trim());
    if (!escaped) return '<div style="height:12px"></div>';
    if (escaped.startsWith('- ')) return `<li style="color:#cbd5e1;line-height:1.6">${escaped.slice(2)}</li>`;
    return `<p style="margin:0 0 12px;color:#cbd5e1;line-height:1.6">${escaped}</p>`;
  }).join('');
  const unsubscribeUrl = `https://www.leadscope.pro/unsubscribe/${encodeURIComponent(unsubscribeToken)}`;
  return `<!doctype html><html><body style="margin:0;background:#0f172a;font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto;padding:32px 20px"><section style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px"><p style="margin:0 0 16px;color:#60a5fa;font-weight:bold">LeadScope AI</p><h1 style="margin:0 0 20px;color:#fff;font-size:24px">${escapeHtml(title)}</h1>${content}<p style="margin:24px 0 0"><a href="https://www.leadscope.pro/updates" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">View product updates</a></p><hr style="border:0;border-top:1px solid #334155;margin:28px 0 16px"><p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5">You are receiving this email because you registered for LeadScope AI.<br>You can unsubscribe from product update emails at any time.<br><a href="${unsubscribeUrl}" style="color:#93c5fd">Unsubscribe from product updates</a></p></section></main></body></html>`;
}

async function listRegisteredRecipients(supabaseAdmin: ReturnType<typeof createClient>, adminUserId: string): Promise<EligibleRecipient[]> {
  const users: Array<{ id: string; email?: string }> = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const registeredUsers = users.filter(user => user.id !== adminUserId && !!user.email && validEmail(user.email));
  if (!registeredUsers.length) return [];
  const userIds = registeredUsers.map(user => user.id);
  const { data: preferenceRows, error: preferencesError } = await supabaseAdmin.from('user_email_preferences').select('user_id, email, product_updates_enabled, unsubscribe_token').in('user_id', userIds);
  if (preferencesError) throw preferencesError;
  const preferences = new Map((preferenceRows as Preference[] | null ?? []).map(preference => [preference.user_id, preference]));
  const missing = registeredUsers.filter(user => !preferences.has(user.id));
  if (missing.length) {
    const rows = missing.map(user => ({ user_id: user.id, email: user.email!, product_updates_enabled: true, unsubscribe_token: randomBytes(24).toString('hex') }));
    const { data: created, error: createError } = await supabaseAdmin.from('user_email_preferences').insert(rows).select('user_id, email, product_updates_enabled, unsubscribe_token');
    if (createError) throw createError;
    for (const preference of created as Preference[] ?? []) preferences.set(preference.user_id, preference);
  }
  return registeredUsers.flatMap(user => {
    const preference = preferences.get(user.id);
    return preference?.product_updates_enabled && preference.unsubscribe_token ? [{ userId: user.id, email: user.email!, unsubscribeToken: preference.unsubscribe_token }] : [];
  });
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
  const subject = typeof request.subject === 'string' ? request.subject.trim() : '';
  const body = typeof request.body === 'string' ? request.body.trim() : '';
  const preview = request.preview === true;
  if (!updateId || !subject || !body || (!preview && !campaignId)) return errorResponse(res, 'Campaign, update, subject, and body are required.');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return errorResponse(res, 'Unable to send campaign.', 500);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !user) return errorResponse(res, 'Unauthorized.', 401);
  const { data: profile } = await supabaseAdmin.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return errorResponse(res, 'Admin access required.', 403);

  try {
    const recipients = await listRegisteredRecipients(supabaseAdmin, user.id);
    if (preview) return res.status(200).json({ success: true, eligible_count: recipients.length });
    if (!recipients.length) return errorResponse(res, 'No eligible recipients found.');
    const { data: campaign, error: campaignError } = await supabaseAdmin.from('product_update_email_campaigns').select('id, update_id, title, subject, body, status').eq('id', campaignId).maybeSingle<Campaign>();
    if (campaignError || !campaign) return errorResponse(res, 'Campaign not found.', 404);
    if (campaign.status !== 'test_sent' || campaign.update_id !== updateId || campaign.subject !== subject || campaign.body !== body) return errorResponse(res, 'A successful test email is required before sending this campaign.');

    const encryptionKey = process.env.SMTP_ENCRYPTION_KEY;
    if (!encryptionKey) return errorResponse(res, 'Unable to send campaign.', 500);
    const { data: settings } = await supabaseAdmin.from('user_smtp_settings').select('from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, is_configured').eq('user_id', user.id).maybeSingle<SmtpSettings>();
    if (!settings?.is_configured || !settings.smtp_host || !settings.smtp_port || !settings.smtp_username || !settings.from_email || !settings.smtp_password_encrypted) return errorResponse(res, 'SMTP settings are not configured.');
    let password: string;
    try { password = decryptPassword(settings.smtp_password_encrypted, encryptionKey); } catch { return errorResponse(res, 'Unable to send campaign.', 500); }
    const smtpPort = Number(settings.smtp_port);
    const transporter = nodemailer.createTransport({ host: settings.smtp_host, port: smtpPort, secure: smtpPort === 465, requireTLS: smtpPort === 587 ? true : undefined, auth: { user: settings.smtp_username.trim(), pass: password }, tls: { servername: settings.smtp_host } });
    const now = new Date().toISOString();
    await supabaseAdmin.from('product_update_email_campaigns').update({ status: 'sending', recipient_count: recipients.length, updated_at: now }).eq('id', campaign.id);
    const { data: existingRows, error: existingError } = await supabaseAdmin.from('product_update_email_recipients').select('id, user_id, email, status').eq('campaign_id', campaign.id).in('email', recipients.map(recipient => recipient.email));
    if (existingError) throw existingError;
    const existingByEmail = new Map((existingRows as Recipient[] | null ?? []).map(row => [row.email.toLowerCase(), row]));
    let sentCount = 0; let failedCount = 0; let skippedCount = 0;
    const fromEmail = settings.from_email.trim();
    const from = settings.from_name?.trim() ? `"${settings.from_name.trim()}" <${fromEmail}>` : fromEmail;
    for (const recipient of recipients) {
      const existing = existingByEmail.get(recipient.email.toLowerCase());
      if (existing?.status === 'sent') { skippedCount += 1; continue; }
      let recipientId = existing?.id;
      if (recipientId) {
        const { error } = await supabaseAdmin.from('product_update_email_recipients').update({ user_id: recipient.userId, status: 'pending', error_message: null, sent_at: null }).eq('id', recipientId);
        if (error) { failedCount += 1; continue; }
      } else {
        const { data, error } = await supabaseAdmin.from('product_update_email_recipients').insert({ campaign_id: campaign.id, user_id: recipient.userId, email: recipient.email, status: 'pending' }).select('id').single();
        if (error || !data) { failedCount += 1; continue; }
        recipientId = data.id;
      }
      try {
        const unsubscribeUrl = `https://www.leadscope.pro/unsubscribe/${encodeURIComponent(recipient.unsubscribeToken)}`;
        await transporter.sendMail({ from, replyTo: settings.reply_to_email?.trim() || undefined, to: recipient.email, subject: campaign.subject, text: `${campaign.body}\n\nView product updates: https://www.leadscope.pro/updates\n\nYou are receiving this email because you registered for LeadScope AI.\nYou can unsubscribe from product update emails at any time.\nUnsubscribe: ${unsubscribeUrl}`, html: campaignHtml(campaign.title, campaign.body, recipient.unsubscribeToken) });
        await supabaseAdmin.from('product_update_email_recipients').update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null }).eq('id', recipientId);
        sentCount += 1;
      } catch (error) {
        await supabaseAdmin.from('product_update_email_recipients').update({ status: 'failed', error_message: safeErrorMessage(error).slice(0, 500) }).eq('id', recipientId);
        failedCount += 1;
      }
    }
    const status = sentCount > 0 ? 'sent' : 'failed';
    await supabaseAdmin.from('product_update_email_campaigns').update({ status, recipient_count: recipients.length, sent_count: sentCount, failed_count: failedCount, sent_at: sentCount > 0 ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', campaign.id);
    return res.status(200).json({ success: true, sent_count: sentCount, failed_count: failedCount, skipped_count: skippedCount, status });
  } catch {
    return errorResponse(res, 'Unable to send campaign.', 500);
  }
}
