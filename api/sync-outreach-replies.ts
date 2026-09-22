import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { ImapFlow } from 'imapflow';

type ApiRequest = { method?: string; headers: { authorization?: string | string[]; Authorization?: string | string[] } };
type ApiResponse = { status: (code: number) => ApiResponse; json: (body: unknown) => void; setHeader: (name: string, value: string) => void };
type SmtpSettings = { smtp_host: string; smtp_username: string; smtp_password_encrypted: string };

export const config = { runtime: 'nodejs', maxDuration: 60 };

function decryptPassword(value: string, encryptionKey: string) {
  const [ivValue, cipherValue] = value.split(':');
  if (!ivValue || !cipherValue) throw new Error('Invalid encrypted email password.');
  const iv = Buffer.from(ivValue, 'base64');
  const encrypted = Buffer.from(cipherValue, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(encryptionKey, 'utf8').digest(), iv);
  decipher.setAuthTag(encrypted.subarray(-16));
  return Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8');
}

function normalizeMessageId(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('<') ? trimmed : `<${trimmed}>`;
}

function imapHostFor(smtpHost: string) {
  const host = smtpHost.trim().toLowerCase();
  if (host === 'smtp.titan.email') return 'imap.titan.email';
  if (host.startsWith('smtp.')) return `imap.${host.slice(5)}`;
  return host;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const rawAuth = req.headers.authorization || req.headers.Authorization;
  const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!auth?.toLowerCase().startsWith('bearer ')) return res.status(401).json({ error: 'Unauthorized.' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.SMTP_ENCRYPTION_KEY;
  if (!supabaseUrl || !serviceKey || !encryptionKey) return res.status(500).json({ error: 'Reply tracking is not configured.' });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const { data: settings, error: settingsError } = await admin.from('user_smtp_settings')
    .select('smtp_host, smtp_username, smtp_password_encrypted').eq('user_id', user.id).maybeSingle<SmtpSettings>();
  if (settingsError || !settings?.smtp_password_encrypted) return res.status(400).json({ error: 'Save SMTP settings before syncing replies.' });

  let password: string;
  try { password = decryptPassword(settings.smtp_password_encrypted, encryptionKey); }
  catch { return res.status(500).json({ error: 'Unable to decrypt the saved email password.' }); }

  const client = new ImapFlow({
    host: imapHostFor(settings.smtp_host), port: 993, secure: true,
    auth: { user: settings.smtp_username.trim(), pass: password }, logger: false,
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
  });
  let matched = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX', { readOnly: true });
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
      const sequence = (await client.search({ since })) || [];
      if (sequence.length) {
        for await (const message of client.fetch(sequence, { envelope: true })) {
          const envelope = message.envelope;
          const inReplyTo = normalizeMessageId(envelope?.inReplyTo);
          const internetMessageId = normalizeMessageId(envelope?.messageId);
          const fromEmail = envelope?.from?.[0]?.address?.toLowerCase() ?? '';
          if (!inReplyTo || !internetMessageId || !fromEmail) continue;
          const { data: send } = await admin.from('outreach_email_sends')
            .select('id, lead_id, to_email').eq('user_id', user.id).eq('provider_message_id', inReplyTo).maybeSingle();
          if (!send || send.to_email.toLowerCase() !== fromEmail) continue;
          const { data: campaignMember } = await admin.from('outreach_campaign_leads')
            .select('id').eq('lead_id', send.lead_id).eq('status', 'sent').order('updated_at', { ascending: false }).limit(1).maybeSingle();
          const { error: replyError } = await admin.from('outreach_email_replies').upsert({
            user_id: user.id, lead_id: send.lead_id, campaign_lead_id: campaignMember?.id ?? null,
            email_send_id: send.id, internet_message_id: internetMessageId, in_reply_to: inReplyTo,
            from_email: fromEmail, subject: envelope?.subject ?? null,
            received_at: envelope?.date?.toISOString() ?? new Date().toISOString(),
          }, { onConflict: 'user_id,internet_message_id', ignoreDuplicates: true });
          if (replyError) continue;
          await admin.from('outreach_email_sends').update({ replied_at: envelope?.date?.toISOString() ?? new Date().toISOString() }).eq('id', send.id);
          if (campaignMember) await admin.from('outreach_campaign_leads').update({ status: 'replied', next_send_at: null, updated_at: new Date().toISOString() }).eq('id', campaignMember.id);
          matched += 1;
        }
      }
    } finally { lock.release(); }
    await client.logout();
    return res.status(200).json({ success: true, matched });
  } catch (error) {
    try { await client.logout(); } catch { /* connection may already be closed */ }
    const message = error instanceof Error ? error.message : 'Unknown IMAP error';
    return res.status(502).json({ error: `Unable to sync replies: ${message}` });
  }
}
