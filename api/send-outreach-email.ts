import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

type ApiRequest = {
  method?: string;
  headers: { authorization?: string | string[]; Authorization?: string | string[] };
  body?: unknown;
};

type ApiResponse = {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type SmtpSettings = {
  from_name: string | null;
  from_email: string | null;
  reply_to_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  smtp_secure: boolean | null;
  is_configured: boolean | null;
};

type SendOutreachBody = {
  lead_id?: unknown;
  outreach_message_id?: unknown;
  campaign_lead_id?: unknown;
  to_email?: unknown;
  subject?: unknown;
  body?: unknown;
};

function errorResponse(res: ApiResponse, message: string, status = 400) {
  return res.status(status).json({ error: message });
}

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

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(smtp_password_encrypted|SMTP_ENCRYPTION_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*[=:]\s*\S+/gi, '$1=[REDACTED]')
    .replace(/:\/\/[^\s:@/]+:[^\s@/]+@/g, '://[REDACTED]@')
    .replace(/\b(pass(?:word)?|auth)\s*[=:]\s*\S+/gi, '$1=[REDACTED]');
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') return errorResponse(res, 'Method not allowed.', 405);

  const rawAuthHeader = req.headers.authorization || req.headers.Authorization;
  const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return errorResponse(res, 'Unauthorized.', 401);

  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return errorResponse(res, 'Unauthorized.', 401);

  const requestBody = (req.body ?? {}) as SendOutreachBody;
  const leadId = typeof requestBody.lead_id === 'string' ? requestBody.lead_id.trim() : '';
  const outreachMessageId = typeof requestBody.outreach_message_id === 'string' ? requestBody.outreach_message_id.trim() : '';
  const campaignLeadId = typeof requestBody.campaign_lead_id === 'string' ? requestBody.campaign_lead_id.trim() : '';
  const toEmail = typeof requestBody.to_email === 'string' ? requestBody.to_email.trim() : '';
  const subject = typeof requestBody.subject === 'string' ? requestBody.subject.trim() : '';
  const body = typeof requestBody.body === 'string' ? requestBody.body.trim() : '';

  if (!leadId) return errorResponse(res, 'lead_id is required.');
  if (!toEmail || !isValidEmail(toEmail)) return errorResponse(res, 'A valid recipient email is required.');
  if (!subject) return errorResponse(res, 'Subject is required.');
  if (!body) return errorResponse(res, 'Email body cannot be empty.');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.SMTP_ENCRYPTION_KEY;
  if (!supabaseUrl || !serviceRoleKey || !encryptionKey) return errorResponse(res, 'Email sending is not configured.', 500);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !user) return errorResponse(res, 'Unauthorized.', 401);

  const { data: lead, error: leadError } = await supabaseAdmin
    .from('leads')
    .select('id, user_id, email')
    .eq('id', leadId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (leadError || !lead) return errorResponse(res, 'Lead not found.', 404);
  if (!lead.email || lead.email.trim().toLowerCase() !== toEmail.toLowerCase()) {
    return errorResponse(res, 'Recipient must match the saved lead email.');
  }

  if (outreachMessageId) {
    const { data: message } = await supabaseAdmin
      .from('outreach_messages')
      .select('id')
      .eq('id', outreachMessageId)
      .eq('lead_id', leadId)
      .maybeSingle();
    if (!message) return errorResponse(res, 'Outreach message not found.', 404);
  }

  let campaignLead: { id: string; campaign_id: string; status: string } | null = null;
  let campaign: { id: string; status: string; daily_limit: number } | null = null;
  if (campaignLeadId) {
    const { data: memberById, error: memberByIdError } = await supabaseAdmin
      .from('outreach_campaign_leads')
      .select('id, campaign_id, lead_id, status, outreach_message_id')
      .eq('id', campaignLeadId)
      .maybeSingle();
    if (memberByIdError) return errorResponse(res, 'Unable to verify the campaign lead.', 500);

    let member = memberById;
    if (!member && outreachMessageId) {
      const { data: matchingMembers, error: matchingMemberError } = await supabaseAdmin
        .from('outreach_campaign_leads')
        .select('id, campaign_id, lead_id, status, outreach_message_id')
        .eq('lead_id', leadId)
        .eq('outreach_message_id', outreachMessageId)
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (matchingMemberError) return errorResponse(res, 'Unable to verify the approved campaign message.', 500);
      member = matchingMembers?.[0] ?? null;
    }

    if (!member) return errorResponse(res, 'Approved campaign lead not found. Refresh the campaign and try again.', 404);
    if (member.lead_id !== leadId) return errorResponse(res, 'Campaign lead does not match the selected lead.', 409);
    if (member.status !== 'approved') return errorResponse(res, 'Campaign message is not approved.', 409);
    if (!outreachMessageId || member.outreach_message_id !== outreachMessageId) {
      return errorResponse(res, 'Campaign message does not match the approved message. Refresh the campaign and try again.', 409);
    }

    const { data: ownerCampaign } = await supabaseAdmin
      .from('outreach_campaigns')
      .select('id, user_id, status, daily_limit')
      .eq('id', member.campaign_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!ownerCampaign) return errorResponse(res, 'Campaign not found.', 404);
    if (ownerCampaign.status !== 'active') return errorResponse(res, 'Activate the campaign before sending.', 409);
    campaignLead = member;
    campaign = ownerCampaign;

    const { data: suppressionRows } = await supabaseAdmin
      .from('outreach_suppression_list')
      .select('id, email')
      .eq('user_id', user.id)
    const suppressed = (suppressionRows ?? []).some(row => row.email.trim().toLowerCase() === toEmail.toLowerCase());
    if (suppressed) return errorResponse(res, 'This recipient is on the suppression list.', 409);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from('outreach_email_sends')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .gte('sent_at', startOfDay.toISOString());
    if ((count ?? 0) >= ownerCampaign.daily_limit) return errorResponse(res, 'Daily campaign sending limit reached.', 429);
  }

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_smtp_settings')
    .select('from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, smtp_secure, is_configured')
    .eq('user_id', user.id)
    .maybeSingle<SmtpSettings>();
  if (settingsError) return errorResponse(res, 'Unable to load SMTP settings.', 500);
  if (!settings?.is_configured || !settings.smtp_host || !settings.smtp_port || !settings.smtp_username || !settings.from_email) {
    return errorResponse(res, 'SMTP settings are not configured.');
  }
  if (!settings.smtp_password_encrypted) return errorResponse(res, 'SMTP password is missing. Please save SMTP settings again.');

  let password: string;
  try {
    password = decryptPassword(settings.smtp_password_encrypted, encryptionKey);
  } catch {
    return errorResponse(res, 'Unable to decrypt SMTP password. Please save SMTP settings again.', 500);
  }

  const smtpPortNumber = Number(settings.smtp_port);
  const isPort465 = smtpPortNumber === 465;
  const isPort587 = smtpPortNumber === 587;
  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: smtpPortNumber,
    secure: isPort465,
    requireTLS: isPort587 ? true : undefined,
    auth: { user: settings.smtp_username.trim(), pass: password },
    tls: { servername: settings.smtp_host },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  const fromEmail = settings.from_email.trim();
  const from = settings.from_name?.trim() ? `"${settings.from_name.trim()}" <${fromEmail}>` : fromEmail;
  const sendLog = {
    user_id: user.id,
    lead_id: leadId,
    outreach_message_id: outreachMessageId || null,
    to_email: toEmail,
    from_email: fromEmail,
    subject,
    body,
    provider: 'smtp',
  };

  try {
    const delivery = await transporter.sendMail({
      from,
      replyTo: settings.reply_to_email?.trim() || undefined,
      to: toEmail,
      subject,
      text: body,
    });
    const { error: logError } = await supabaseAdmin.from('outreach_email_sends').insert({
      ...sendLog,
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: delivery.messageId || null,
    });
    if (logError) return errorResponse(res, 'Email was sent, but the send log could not be saved.', 500);

    await supabaseAdmin.from('leads').update({ status: 'Contacted' }).eq('id', leadId).eq('user_id', user.id);
    if (campaignLead && campaign) {
      await supabaseAdmin.from('outreach_campaign_leads').update({
        status: 'sent',
        last_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaignLead.id).eq('campaign_id', campaign.id);
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    await supabaseAdmin.from('outreach_email_sends').insert({ ...sendLog, status: 'failed', error_message: errorMessage });
    if (campaignLead && campaign) {
      await supabaseAdmin.from('outreach_campaign_leads').update({
        error_message: errorMessage.slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq('id', campaignLead.id).eq('campaign_id', campaign.id);
    }
    return errorResponse(res, `Unable to send email: ${errorMessage}`, 502);
  }
}
