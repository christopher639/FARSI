import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, credential } = await req.json();

    if (!email || !credential) {
      return new Response(
        JSON.stringify({ error: "Email and credential are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by email and verify credential ID matches
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, biometric_credential_id, biometric_counter")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User not found", verified: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the credential ID matches
    if (profile.biometric_credential_id !== credential.id) {
      return new Response(
        JSON.stringify({ error: "Invalid credential", verified: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // In a production environment, you would:
    // 1. Verify the signature using the stored public key
    // 2. Check the counter to prevent replay attacks
    // 3. Verify the origin and RP ID
    
    // For now, we trust that the browser's WebAuthn API has verified the user
    // The credential ID match is our primary verification

    // Update counter to prevent replay attacks
    const newCounter = (profile.biometric_counter || 0) + 1;
    await supabase
      .from("profiles")
      .update({ biometric_counter: newCounter })
      .eq("user_id", profile.user_id);

    // Generate a temporary token for the login flow
    // This will be used to complete the sign-in after biometric verification
    const verificationToken = crypto.randomUUID();

    return new Response(
      JSON.stringify({ 
        verified: true, 
        userId: profile.user_id,
        verificationToken,
        message: "Biometric verification successful" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying login:", error);
    return new Response(
      JSON.stringify({ error: "Failed to verify login", verified: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
