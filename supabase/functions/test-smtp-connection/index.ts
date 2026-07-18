import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type StoredSmtpSettings = {
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

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decryptPassword(encryptedPassword: string, secret: string) {
  const [encodedIv, encodedCiphertext, ...extraParts] = encryptedPassword.split(":");
  if (!encodedIv || !encodedCiphertext || extraParts.length > 0) {
    throw new Error("Invalid encrypted SMTP password.");
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(encodedIv) },
    key,
    base64ToBytes(encodedCiphertext),
  );

  return new TextDecoder().decode(decrypted);
}

async function sendTestEmail(settings: StoredSmtpSettings, password: string) {
  const client = new SmtpClient();
  const connection = {
    hostname: settings.smtp_host!,
    port: settings.smtp_port!,
    username: settings.smtp_username!,
    password,
  };

  try {
    if (settings.smtp_secure) {
      await client.connectTLS(connection);
    } else {
      await client.connect(connection);
    }

    const from = settings.from_name?.trim()
      ? `"${settings.from_name.trim()}" <${settings.from_email}>`
      : settings.from_email!;
    await client.send({
      from,
      to: settings.reply_to_email?.trim() || settings.from_email!,
      subject: "LeadScope AI SMTP Test",
      content: "This is a test email from LeadScope AI to confirm your SMTP settings are working.",
    });
  } finally {
    await client.close().catch(() => undefined);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Missing Authorization Bearer token.", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionKey = Deno.env.get("SMTP_ENCRYPTION_KEY")?.trim();

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return errorResponse("Unable to test SMTP connection.", 500);
    }
    if (!encryptionKey) {
      return errorResponse("Missing SMTP encryption key.", 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return errorResponse("Unauthorized.", 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: settings, error: settingsError } = await serviceClient
      .from("user_smtp_settings")
      .select("from_name, from_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, smtp_secure, is_configured")
      .eq("user_id", user.id)
      .maybeSingle();

    if (settingsError) {
      return errorResponse("Unable to load SMTP settings.", 500);
    }
    if (!settings || !settings.is_configured) {
      return errorResponse("SMTP settings are not configured.");
    }
    if (!settings.smtp_password_encrypted) {
      return errorResponse("SMTP password is missing. Please save SMTP settings again.");
    }
    if (!settings.from_email || !settings.smtp_host || !settings.smtp_port || !settings.smtp_username) {
      return errorResponse("SMTP settings are not configured.");
    }

    let password: string;
    try {
      password = await decryptPassword(settings.smtp_password_encrypted, encryptionKey);
    } catch {
      return errorResponse("Unable to decrypt SMTP password. Please save SMTP settings again.", 500);
    }

    try {
      await sendTestEmail(settings as StoredSmtpSettings, password);
    } catch {
      return errorResponse("SMTP connection failed. This may require using an email API provider instead of direct SMTP.", 502);
    }

    return jsonResponse({ success: true });
  } catch {
    return errorResponse("Unable to test SMTP connection.", 500);
  }
});
