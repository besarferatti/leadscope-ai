import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function getEncryptionKey(secret: string) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));

  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
}

async function encryptPassword(password: string, secret: string) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey(secret);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(password),
  );

  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionSecret = Deno.env.get("SMTP_ENCRYPTION_KEY");

    if (!supabaseUrl) return errorResponse("Missing Supabase URL.", 500);
    if (!anonKey) return errorResponse("Missing Supabase anon key.", 500);
    if (!serviceRoleKey) return errorResponse("Missing Supabase service role key.", 500);
    if (!encryptionSecret) return errorResponse("Missing SMTP encryption key.", 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing authorization header.", 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return errorResponse("Unauthorized.", 401);
    }

    const body = await req.json();

    const fromName = stringValue(body.from_name);
    const fromEmail = stringValue(body.from_email);
    const replyToEmail = stringValue(body.reply_to_email);
    const smtpHost = stringValue(body.smtp_host);
    const smtpUsername = stringValue(body.smtp_username);
    const smtpPassword = stringValue(body.smtp_password);
    const smtpPort =
      typeof body.smtp_port === "number"
        ? body.smtp_port
        : Number(body.smtp_port);
    const smtpSecure =
      typeof body.smtp_secure === "boolean" ? body.smtp_secure : true;

    if (!fromEmail || !smtpHost || !smtpUsername || !Number.isInteger(smtpPort)) {
      return errorResponse("from_email, smtp_host, smtp_port, and smtp_username are required.");
    }

    if (!isEmail(fromEmail) || (replyToEmail && !isEmail(replyToEmail))) {
      return errorResponse("Enter valid email addresses.");
    }

    if (smtpPort < 1 || smtpPort > 65535) {
      return errorResponse("smtp_port must be between 1 and 65535.");
    }

    if (!smtpPassword) {
      return errorResponse("smtp_password is required.");
    }

    const smtpPasswordEncrypted = await encryptPassword(smtpPassword, encryptionSecret);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data, error: saveError } = await serviceClient
      .from("user_smtp_settings")
      .upsert(
        {
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
        },
        { onConflict: "user_id" },
      )
      .select(
        "from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_secure, is_configured, updated_at",
      )
      .single();

    if (saveError) {
      return errorResponse(`Unable to save SMTP settings: ${saveError.message}`, 500);
    }

    return jsonResponse({ settings: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(`Unable to save SMTP settings: ${message}`, 500);
  }
});
