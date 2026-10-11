import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration error" }, 500);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, serviceKey);
  const { data: { user: caller }, error: callerError } = await userClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  if (callerError || !caller) return json({ error: "Invalid session" }, 401);

  const { data: callerProfile } = await admin.from("app_users").select("company_id, role").eq("id", caller.id).single();
  if (!callerProfile?.company_id || callerProfile.role !== "admin") return json({ error: "Only company administrators can manage users" }, 403);

  let input: { action?: string; id?: string; email?: string; name?: string; password?: string; role?: string; status?: string };
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const role = input.role || "staff";
  const allowedRoles = ["admin", "manager", "sales", "accountant", "technician", "staff"];
  if (input.action !== "delete" && (!input.email || !input.name || !allowedRoles.includes(role))) return json({ error: "Name, email and a valid role are required" }, 400);
  if (input.action === "create" && (!input.password || input.password.length < 8)) return json({ error: "Password must be at least 8 characters" }, 400);

  if (input.action === "create") {
    const { data, error } = await admin.auth.admin.createUser({ email: input.email!.trim().toLowerCase(), password: input.password, email_confirm: true, user_metadata: { full_name: input.name } });
    if (error || !data.user) return json({ error: error?.message || "Could not create user" }, 400);
    const { error: profileError } = await admin.from("app_users").insert({ id: data.user.id, company_id: callerProfile.company_id, full_name: input.name!.trim(), email: data.user.email, role, });
    if (profileError) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: profileError.message }, 400); }
    return json({ id: data.user.id, email: data.user.email, name: input.name!.trim(), role, status: input.status || "active" });
  }

  if (!input.id) return json({ error: "User id is required" }, 400);
  const { data: target } = await admin.from("app_users").select("id, company_id").eq("id", input.id).single();
  if (!target || target.company_id !== callerProfile.company_id) return json({ error: "User not found" }, 404);
  if (input.action === "delete") {
    if (input.id === caller.id) return json({ error: "You cannot delete your own account" }, 400);
    const { error } = await admin.auth.admin.deleteUser(input.id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }
  if (input.action !== "update") return json({ error: "Unknown action" }, 400);
  const authUpdate: Record<string, unknown> = {
    email: input.email!.trim().toLowerCase(),
    email_confirm: true,
    user_metadata: { full_name: input.name },
  };
  if (input.password) { if (input.password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400); authUpdate.password = input.password; }
  const { error: authError } = await admin.auth.admin.updateUserById(input.id, authUpdate);
  if (authError) return json({ error: authError.message }, 400);
  const { error: profileError } = await admin.from("app_users").update({ full_name: input.name!.trim(), email: input.email!.trim().toLowerCase(), role }).eq("id", input.id).eq("company_id", callerProfile.company_id);
  if (profileError) return json({ error: profileError.message }, 400);
  return json({ id: input.id, email: input.email, name: input.name!.trim(), role, status: input.status || "active" });
});
