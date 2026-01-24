import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, biometric_enabled, biometric_credential_id, biometric_mandatory")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User not found", biometricAvailable: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.biometric_enabled || !profile.biometric_credential_id) {
      return new Response(
        JSON.stringify({ 
          biometricAvailable: false,
          biometricMandatory: false,
          message: "Biometric not configured for this user" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const challenge = generateChallenge();

    const options = {
      challenge,
      timeout: 60000,
      rpId: new URL(req.headers.get("origin") || supabaseUrl).hostname,
      allowCredentials: [
        {
          id: profile.biometric_credential_id,
          type: "public-key",
          transports: ["internal"],
        },
      ],
      userVerification: "required",
    };

    return new Response(
      JSON.stringify({ 
        options, 
        challenge,
        userId: profile.user_id,
        biometricAvailable: true,
        biometricMandatory: profile.biometric_mandatory || false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating login options:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate login options" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
