import { serve } from "std/server.ts";
import { createClient } from "supabase/";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PUBLIC_KEY_JWK = Deno.env.get("LICENSE_SIGNING_PUBLIC_KEY_JWK") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
      auth: { persistSession: false },
    });

    // This function can be called by the desktop app without a logged-in user
    // However, if a user is logged in, we can use their ID for enhanced logging/auditing
    const { data: { user } } = await supabaseClient.auth.getUser();

    const { license_jwt, device_fingerprint } = await req.json();

    // Input validation
    if (!license_jwt || !device_fingerprint) {
      return new Response("Missing required fields: license_jwt or device_fingerprint", { status: 400 });
    }

    let licensePayload: jose.JWTPayload;
    try {
      const publicKey = await jose.importJWK(JSON.parse(PUBLIC_KEY_JWK), "ES256");
      const { payload } = await jose.jwtVerify(license_jwt, publicKey);
      licensePayload = payload;
    } catch (e) {
      console.error("JWT verification failed:", e);
      return new Response("Invalid license signature or format", { status: 403 });
    }

    // Check expiration
    if (licensePayload.exp && licensePayload.exp < Math.floor(Date.now() / 1000)) {
      return new Response("License expired", { status: 403 });
    }

    // Check device fingerprint
    if (licensePayload.device_fingerprint !== device_fingerprint) {
      return new Response("License not bound to this device", { status: 403 });
    }

    // Check against revocation list in the database
    const { data: revokedEntry, error: revokedError } = await supabaseClient
      .from("revoked_licenses")
      .select("id")
      .eq("license_id", licensePayload.license_id)
      .maybeSingle();

    if (revokedError) {
      console.error("Error checking revocation list:", revokedError);
      return new Response(JSON.stringify({ error: revokedError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    if (revokedEntry) {
      return new Response("License has been revoked", { status: 403 });
    }

    // Check if the license is still active in the licenses table
    const { data: licenseRecord, error: licenseRecordError } = await supabaseClient
      .from("licenses")
      .select("is_active")
      .eq("id", licensePayload.license_id)
      .single();

    if (licenseRecordError || !licenseRecord.is_active) {
      return new Response("License is inactive or not found", { status: 403 });
    }

    // Optionally, update last_seen for the device or log audit event
    await supabaseClient.from("devices").update({ last_seen: new Date().toISOString() }).eq("fingerprint", device_fingerprint);
    await supabaseClient.from("audit_logs").insert({
        user_id: user?.id, // Log user if authenticated
        event_type: "license_validation",
        event_details: { license_id: licensePayload.license_id, device_fingerprint },
        ip_address: req.headers.get("X-Forwarded-For") || req.headers.get("X-Real-IP") || req.headers.get("CF-Connecting-IP"),
    });

    return new Response(JSON.stringify({ message: "License is valid", license: licensePayload }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
