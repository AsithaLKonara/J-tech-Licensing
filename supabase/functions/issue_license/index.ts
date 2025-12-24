import { serve } from "std/server.ts";
import { createClient } from "supabase/";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PRIVATE_KEY_JWK = Deno.env.get("LICENSE_SIGNING_PRIVATE_KEY_JWK") ?? "";

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

    const { product, plan, features, device_fingerprint, expires_in_days } = await req.json();

    // Input validation
    if (!product || !plan || !features || !device_fingerprint || !expires_in_days) {
      return new Response("Missing required fields", { status: 400 });
    }

    const license_id = crypto.randomUUID();
    const issued_at = Math.floor(Date.now() / 1000);
    const expires_at = issued_at + expires_in_days * 24 * 60 * 60;
    const nonce = crypto.randomUUID();

    const licensePayload = {
      license_id,
      user_id: user.id,
      product,
      plan,
      features,
      device_fingerprint,
      issued_at,
      expires_at,
      nonce,
    };

    const privateKey = await jose.importJWK(JSON.parse(PRIVATE_KEY_JWK), "ES256");

    const jwt = await new jose.SignJWT(licensePayload)
      .setProtectedHeader({ alg: "ES256" })
      .setIssuedAt()
      .setExpirationTime(expires_at)
      .sign(privateKey);

    const { data, error } = await supabaseClient.from("licenses").insert({
      id: license_id,
      user_id: user.id,
      product,
      plan,
      features,
      device_fingerprint,
      issued_at: issued_at, // Store as BIGINT (Unix timestamp)
      expires_at: expires_at, // Store as BIGINT (Unix timestamp)
      nonce,
      signature: jwt, // Store the full JWT as the signature
      is_active: true, // New licenses are active by default
    });

    if (error) {
      console.error("Error inserting license:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ license: jwt }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
