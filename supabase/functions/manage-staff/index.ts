// =====================================================================
// DPOS — manage-staff Edge Function
// Lets an authenticated ADMIN create / list / delete staff (cashier) logins
// that share the admin's business.
//
// Deploy:
//   supabase functions deploy manage-staff
// Secret (service role key: Dashboard → Settings → API → service_role):
//   supabase secrets set SERVICE_ROLE_KEY=your-service-role-key
//
// Request body: { action: "create" | "delete" | "list", ... }
//   create -> { action:"create", email, password, role? }
//   delete -> { action:"delete", user_id }
//   list   -> { action:"list" }
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    // Identify the caller from their JWT.
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const adminUser = userData.user;

    // Service-role client (bypasses RLS, can manage auth users).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // The caller must OWN a business to manage staff.
    const { data: business } = await admin
      .from("businesses")
      .select("id")
      .eq("owner_id", adminUser.id)
      .maybeSingle();
    if (!business) return json({ error: "Only the business admin can manage staff" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "create";

    // ---------- LIST ----------
    if (action === "list") {
      const { data, error } = await admin
        .from("business_members")
        .select("id, user_id, email, role, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      return json({ staff: data ?? [] });
    }

    // ---------- DELETE ----------
    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      // Make sure this staff actually belongs to the caller's business.
      const { data: member } = await admin
        .from("business_members")
        .select("id")
        .eq("user_id", user_id)
        .eq("business_id", business.id)
        .maybeSingle();
      if (!member) return json({ error: "Staff not found in your business" }, 404);

      await admin.from("business_members").delete().eq("user_id", user_id);
      await admin.auth.admin.deleteUser(user_id); // fully revoke login
      return json({ success: true });
    }

    // ---------- CREATE ----------
    if (action === "create") {
      const { email, password, role = "cashier" } = body;
      if (!email || !password) return json({ error: "Email and password required" }, 400);
      if (String(password).length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
      if (!["cashier", "admin"].includes(role)) return json({ error: "Invalid role" }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        return json({ error: createErr?.message ?? "Could not create user" }, 400);
      }

      const { error: memberErr } = await admin.from("business_members").insert({
        business_id: business.id,
        user_id: created.user.id,
        role,
        email,
      });
      if (memberErr) {
        await admin.auth.admin.deleteUser(created.user.id); // roll back orphan user
        return json({ error: memberErr.message }, 400);
      }

      return json({ success: true, user_id: created.user.id, email, role });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
