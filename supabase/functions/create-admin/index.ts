import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ADMIN_EMAIL = "admin@leadscope.pro";
  const ADMIN_PASSWORD = "Besar123";

  // Find existing admin by email in user_profiles
  const { data: existingProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();

  // Delete old admin user if exists (cascades to user_profiles)
  if (existingProfile?.id) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(existingProfile.id);
    if (deleteError) {
      return new Response(JSON.stringify({ step: "delete", error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Create fresh admin user via Admin SDK (correct GoTrue format)
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: "Admin",
      email_verified: true,
      phone_verified: false,
    },
  });

  if (createError || !created?.user) {
    return new Response(JSON.stringify({ step: "create", error: createError?.message ?? "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Upgrade the profile created by the trigger to admin role
  const { error: profileError } = await supabase.from("user_profiles").update({
    full_name: "Admin",
    role: "admin",
    current_plan: "admin_unlimited",
    subscription_status: "active",
    is_active: true,
    must_change_password: false,
  }).eq("id", created.user.id);

  if (profileError) {
    return new Response(JSON.stringify({ step: "profile", error: profileError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    message: "Admin recreated successfully. Login: admin@leadscope.pro / Besar123",
    id: created.user.id,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});



