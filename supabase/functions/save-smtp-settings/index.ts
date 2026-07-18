import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type SmtpSettingsPayload = {
  from_name?: unknown;
  from_email?: unknown;
  reply_to_email?: unknown;
  smtp_host?: unknown;
  smtp_port?: unknown;
  smtp_username?: unknown;
  smtp_password?: unknown;
  smtp_secure?: unknown;
};

type SafeSmtpSettings = {
  from_name: string;
  from_email: string;
  reply_to_email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_secure: boolean;
  is_configured: boolean;
  updated_at: string;
};

type ExistingSmtpSettings = {
  id: string;
  user_id: string;
  smtp_password_encrypted: string | null;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptPassword(password: string, secret: string) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  const key = await crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(password));
  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Missing Authorization Bearer token", 401);

    const encryptionKey = Deno.env.get("SMTP_ENCRYPTION_KEY")?.trim();
    if (!encryptionKey) return errorResponse("Missing SMTP encryption key.", 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) return errorResponse("Missing Supabase service role key.", 500);
    if (!supabaseUrl || !supabaseAnonKey) return errorResponse("Supabase is not configured on the server.", 500);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return errorResponse("Unauthorized", 401);

    const body = await req.json() as SmtpSettingsPayload;
    const fromName = stringValue(body.from_name);
    const fromEmail = stringValue(body.from_email);
    const replyToEmail = stringValue(body.reply_to_email);
    const smtpHost = stringValue(body.smtp_host);
    const smtpUsername = stringValue(body.smtp_username);
    const smtpPassword = typeof body.smtp_password === "string" ? body.smtp_password : "";
    const smtpPort = typeof body.smtp_port === "number" ? body.smtp_port : Number(body.smtp_port);
    const smtpSecure = typeof body.smtp_secure === "boolean" ? body.smtp_secure : true;

    if (!fromEmail || !smtpHost || !smtpUsername || !Number.isInteger(smtpPort)) {
      return errorResponse("from_email, smtp_host, smtp_port, and smtp_username are required.");
    }
    if (!isEmail(fromEmail) || (replyToEmail && !isEmail(replyToEmail))) return errorResponse("Enter valid email addresses.");
    if (smtpPort < 1 || smtpPort > 65535) return errorResponse("smtp_port must be between 1 and 65535.");

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    let smtpPasswordEncrypted: string | null = null;

    if (smtpPassword) {
      smtpPasswordEncrypted = await encryptPassword(smtpPassword, encryptionKey);
    } else {
      const { data: existingSettings, error: existingError } = await serviceClient
        .from("user_smtp_settings")
        .select("id, user_id, smtp_password_encrypted")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingError) {
        return errorResponse(
          `Unable to load existing SMTP settings: ${existingError.message}`,
          500,
        );
      }

      const existing = existingSettings as ExistingSmtpSettings | null;
      if (!existing?.smtp_password_encrypted) {
        return errorResponse("smtp_password is required when creating SMTP settings.");
      }

      smtpPasswordEncrypted = existing.smtp_password_encrypted;
    }
    const { data, error: saveError } = await serviceClient
      .from("user_smtp_settings")
      .upsert({
        user_id: user.id,
        from_name: fromName,
        from_email: fromEmail,
        reply_to_email: replyToEmail,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_username: smtpUsername,
        smtp_password_encrypted: smtpPasswordEncrypted,
        smtp_secure: smtpSecure,
        is_configured: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select("from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_secure, is_configured, updated_at")
      .single();
    if (saveError) {
      return errorResponse(
        `Unable to save SMTP settings: ${saveError.message}`,
        500,
      );
    }

    return jsonResponse({ settings: data as SafeSmtpSettings });
  } catch {
    return errorResponse("Unable to save SMTP settings.", 500);
  }
});
