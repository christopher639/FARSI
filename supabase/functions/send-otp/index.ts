import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userId } = await req.json();

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: "Email and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("FARSIS_RESEND")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clean up old OTPs for this user
    await supabase
      .from("otp_codes")
      .delete()
      .eq("user_id", userId);

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("otp_codes")
      .insert({
        user_id: userId,
        email: email,
        code: otp,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send OTP via Resend REST API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FARSI Security <noreply@farsis.co.ke>",
        to: [email],
        subject: "Your FARSI Login Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px;">
              <h1 style="color: #00d4ff; margin: 0 0 20px 0; text-align: center;">FARSI Security</h1>
              <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; text-align: center;">
                <p style="color: #ffffff; margin: 0 0 15px 0; font-size: 16px;">Your verification code is:</p>
                <div style="background: #0a0a1a; padding: 15px 30px; border-radius: 8px; display: inline-block;">
                  <span style="color: #00d4ff; font-size: 32px; font-weight: bold; letter-spacing: 8px;">${otp}</span>
                </div>
                <p style="color: #888; margin: 20px 0 0 0; font-size: 14px;">This code expires in 10 minutes.</p>
              </div>
              <p style="color: #666; margin: 20px 0 0 0; font-size: 12px; text-align: center;">
                If you didn't request this code, please ignore this email.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to send OTP email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("OTP email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-otp:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
