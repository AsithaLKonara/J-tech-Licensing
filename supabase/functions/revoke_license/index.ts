import { serve } from "std/server.ts";
import { createClient } from "supabase/";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
      auth: { persistSession: false },
    });

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { license_id, reason } = await req.json();

    // Input validation
    if (!license_id) {
      return new Response("Missing license_id", { status: 400 });
    }

    // Check if the user owns the license or if the user has admin privileges
    const { data: license, error: licenseError } = await supabaseClient
      .from("licenses")
      .select("id, user_id")
      .eq("id", license_id)
      .single();

    if (licenseError || !license) {
      return new Response("License not found or unauthorized", { status: 404 });
    }

    // Basic authorization: ensure user owns the license or is an admin
    if (license.user_id !== user.id /* && !user.is_admin */) { // TODO: Implement admin role check
      return new Response("Unauthorized to revoke this license", { status: 403 });
    }

    const { data: revoked, error } = await supabaseClient.from("revoked_licenses").insert({
      license_id,
      reason: reason || "User requested revocation",
      revoked_by: user.id,
    });

    if (error) {
      if (error.code === "23505") { // Unique violation code, license already revoked
        return new Response(JSON.stringify({ message: "License already revoked" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      console.error("Error revoking license:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // Optionally, update the license to inactive
    await supabaseClient.from("licenses").update({ is_active: false }).eq("id", license_id);

    return new Response(JSON.stringify({ message: "License revoked successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
