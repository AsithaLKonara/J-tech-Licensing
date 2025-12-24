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

    const { fingerprint, name } = await req.json();

    // Input validation
    if (!fingerprint) {
      return new Response("Missing device fingerprint", { status: 400 });
    }

    const { data, error } = await supabaseClient
      .from("devices")
      .insert({ user_id: user.id, fingerprint, name })
      .select();

    if (error) {
      // Handle case where device already exists for this user
      if (error.code === "23505") { // Unique violation code
        const { data: existingDevice, error: fetchError } = await supabaseClient
          .from("devices")
          .select()
          .eq("fingerprint", fingerprint)
          .single();
        
        if (fetchError) {
            console.error("Error fetching existing device:", fetchError);
            return new Response(JSON.stringify({ error: fetchError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        if (existingDevice.user_id === user.id) {
            return new Response(JSON.stringify({ message: "Device already registered for this user", device: existingDevice }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        } else {
            return new Response("Device fingerprint already registered by another user.", { status: 409 });
        }
      }
      console.error("Error registering device:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ device: data[0] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
