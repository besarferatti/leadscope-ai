import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

type ApiRequest = {
  method?: string;
  headers: { authorization?: string | string[] };
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

const SMTP_CONNECTION_ERROR_CODES = new Set([
  'ECONNECTION',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ESOCKET',
  'ETIMEDOUT',
]);

function errorResponse(res: ApiResponse, message: string, status = 400) {
  return res.status(status).json({ error: message });
}

function getBearerToken(authorization: string | string[] | undefined) {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return value?.startsWith('Bearer ') ? value : null;
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

function smtpErrorMessage(error: unknown) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  const responseCode = error instanceof Error && 'responseCode' in error
    ? Number(error.responseCode)
    : 0;

  if (code === 'EAUTH' || responseCode === 535) {
    return 'SMTP authentication failed. Check your username and password.';
  }

  if (SMTP_CONNECTION_ERROR_CODES.has(code)) {
    return 'SMTP connection failed. Check host, port, and secure connection.';
  }

  return 'Unable to send test email: The SMTP server rejected the test email.';
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') {
    return errorResponse(res, 'Method not allowed.', 405);
  }

  const authorization = getBearerToken(req.headers.authorization);
  if (!authorization) {
    return errorResponse(res, 'Missing Authorization Bearer token.', 401);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.SMTP_ENCRYPTION_KEY?.trim();
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !encryptionKey) {
    return errorResponse(res, 'Unable to send test email.', 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return errorResponse(res, 'Unauthorized.', 401);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: settings, error: settingsError } = await serviceClient
    .from('user_smtp_settings')
    .select('from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, smtp_secure, is_configured')
    .eq('user_id', user.id)
    .maybeSingle<SmtpSettings>();

  if (settingsError) {
    return errorResponse(res, 'Unable to send test email.', 500);
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
    password = decryptPassword(settings.smtp_password_encrypted, encryptionKey);
  } catch {
    return errorResponse(res, 'Unable to send test email: Please save SMTP settings again.', 500);
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure ?? true,
      auth: { user: settings.smtp_username, pass: password },
    });
    const from = settings.from_name?.trim()
      ? `"${settings.from_name.trim()}" <${settings.from_email}>`
      : settings.from_email;

    await transporter.sendMail({
      from,
      to: settings.reply_to_email?.trim() || settings.from_email,
      subject: 'LeadScope AI SMTP Test',
      text: 'This is a test email from LeadScope AI to confirm your SMTP settings are working.',
    });
  } catch (error) {
    return errorResponse(res, smtpErrorMessage(error), 502);
  }

  return res.status(200).json({ success: true });
}
