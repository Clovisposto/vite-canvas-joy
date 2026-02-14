import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Auth check: service role key in header OR authenticated admin user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    let authorized = false;

    if (token) {
      // Check if it's an authenticated user who is admin
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await callerClient.auth.getUser();
      if (userData?.user) {
        const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin");
        authorized = !!(roles && roles.length > 0);
      }
    }

    // Also allow internal calls (no auth header = internal invocation from Lovable tooling)
    // For security, check a shared internal secret
    const internalKey = req.headers.get("x-internal-key");
    if (internalKey === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      authorized = true;
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Forbidden - admin access required" }), { status: 403, headers: corsHeaders });
    }

    const { email, password, full_name, role } = await req.json();

    // Create user via admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: corsHeaders });
    }

    // Assign role
    if (newUser?.user && role) {
      const { error: roleError } = await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role });
      if (roleError) {
        return new Response(JSON.stringify({ 
          success: true, 
          warning: "User created but role assignment failed: " + roleError.message,
          user_id: newUser.user.id 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser?.user?.id, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
