import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

type ApiRequest = {
  method?: string;
  headers: { authorization?: string | string[]; Authorization?: string | string[] };
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

type SmtpDebugDetails = {
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_username?: string;
  from_email?: string;
};

function errorResponse(res: ApiResponse, message: string, status = 400, debug?: SmtpDebugDetails) {
  return res.status(status).json({ error: message, ...(debug ? { debug } : {}) });
}

function decryptPassword(encryptedPassword: string, encryptionKey: string) {
  const [encodedIv, encodedCiphertext, ...remainder] = encryptedPassword.split(':');
  if (!encodedIv || !encodedCiphertext || remainder.length > 0) {
    throw new Error('Invalid encrypted SMTP password.');
  }

  const iv = Buffer.from(encodedIv, 'base64');
  const ciphertextWithTag = Buffer.from(encodedCiphertext, 'base64');
  if (iv.length !== 12 || ciphertextWithTag.length <= 16) {
    throw new Error('Invalid encrypted SMTP password.');
  }

  const authTag = ciphertextWithTag.subarray(-16);
  const ciphertext = ciphertextWithTag.subarray(0, -16);
  const key = createHash('sha256').update(encryptionKey, 'utf8').digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return message
    .replace(/(smtp_password_encrypted|SMTP_ENCRYPTION_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*[=:]\s*\S+/gi, '$1=[REDACTED]')
    .replace(/:\/\/[^\s:@/]+:[^\s@/]+@/g, '://[REDACTED]@')
    .replace(/\b(pass(?:word)?|auth)\s*[=:]\s*\S+/gi, '$1=[REDACTED]');
}

function maskSmtpUsername(username: string) {
  const [localPart, domain] = username.split('@');
  const maskedLocalPart = `${localPart.slice(0, 2)}********`;

  return domain ? `${maskedLocalPart}@${domain}` : maskedLocalPart;
}

function smtpDebugDetails(settings: SmtpSettings): SmtpDebugDetails {
  return {
    smtp_host: settings.smtp_host ?? undefined,
    smtp_port: settings.smtp_port ?? undefined,
    smtp_secure: settings.smtp_secure ?? true,
    smtp_username: settings.smtp_username ? maskSmtpUsername(settings.smtp_username) : undefined,
    from_email: settings.from_email ?? undefined,
  };
}

function smtpVerifyErrorMessage(error: unknown) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';

  if (code === 'EAUTH') {
    return 'SMTP authentication failed. Check your SMTP username and password.';
  }

  if (code === 'ETIMEDOUT' || code === 'ESOCKET') {
    return 'SMTP connection timed out. Check SMTP host, port, and secure connection.';
  }

  if (/certificate|ssl|tls|wrong version|handshake/i.test(safeErrorMessage(error))) {
    return 'SMTP SSL/TLS failed. Try port 465 with secure ON, or port 587 with secure OFF/STARTTLS.';
  }

  return `SMTP connection failed: ${safeErrorMessage(error)}`;
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed.', 405);
  }

  const rawAuthHeader =
    req.headers.authorization ||
    req.headers.Authorization;
  const authHeader = Array.isArray(rawAuthHeader)
    ? rawAuthHeader[0]
    : rawAuthHeader;

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: missing bearer token',
      hasAuthorizationHeader: Boolean(authHeader),
    });
  }

  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!accessToken) {
    return res.status(401).json({
      error: 'Unauthorized: empty bearer token',
      hasAuthorizationHeader: true,
      hasToken: false,
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const smtpEncryptionKey = process.env.SMTP_ENCRYPTION_KEY;
  if (!supabaseUrl) {
    return errorResponse(res, 'Missing SUPABASE_URL or VITE_SUPABASE_URL', 500);
  }
  if (!supabaseServiceRoleKey) {
    return errorResponse(res, 'Missing SUPABASE_SERVICE_ROLE_KEY', 500);
  }
  if (!smtpEncryptionKey) {
    return errorResponse(res, 'Missing SMTP_ENCRYPTION_KEY', 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !user) {
    return res.status(401).json({
      error: 'Unauthorized: invalid Supabase session',
      hasAuthorizationHeader: true,
      hasToken: true,
      authError: userError?.message || null,
    });
  }

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_smtp_settings')
    .select('from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, smtp_secure, is_configured')
    .eq('user_id', user.id)
    .maybeSingle<SmtpSettings>();

  if (settingsError) {
    return errorResponse(res, `Unable to load SMTP settings: ${safeErrorMessage(settingsError)}`, 500);
  }
  if (!settings?.is_configured) {
    return errorResponse(res, 'SMTP settings are not configured.');
  }
  if (!settings.smtp_password_encrypted) {
    return errorResponse(res, 'SMTP password is missing. Please save SMTP settings again.');
  }
  if (!settings.smtp_host || !settings.smtp_port || !settings.smtp_username || !settings.from_email) {
    return errorResponse(res, 'SMTP settings are not configured.');
  }

  let password: string;
  try {
    password = decryptPassword(settings.smtp_password_encrypted, smtpEncryptionKey);
  } catch {
    return errorResponse(res, 'Unable to decrypt SMTP password. Please save SMTP settings again.', 500);
  }

  const debug = smtpDebugDetails(settings);
  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_secure ?? true,
    auth: { user: settings.smtp_username, pass: password },
  });
  const from = settings.from_name?.trim()
    ? `"${settings.from_name.trim()}" <${settings.from_email}>`
    : settings.from_email;

  try {
    await transporter.verify();
  } catch (error) {
    return errorResponse(res, smtpVerifyErrorMessage(error), 502, debug);
  }

  try {
    await transporter.sendMail({
      from,
      to: settings.reply_to_email?.trim() || settings.from_email,
      subject: 'LeadScope AI SMTP Test',
      text: 'This is a test email from LeadScope AI to confirm your SMTP settings are working.',
    });
  } catch (error) {
    return errorResponse(res, `Unable to send test email: ${safeErrorMessage(error)}`, 502, debug);
  }

  return res.status(200).json({ success: true });
}
