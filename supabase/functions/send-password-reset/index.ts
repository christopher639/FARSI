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
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("FARSIS_RESEND")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error listing users:", userError);
      return new Response(
        JSON.stringify({ success: true, message: "If the email exists, a reset link has been sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // Don't reveal if user exists
      return new Response(
        JSON.stringify({ success: true, message: "If the email exists, a reset link has been sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure token
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Clean up old tokens for this user
    await supabase
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", user.id);

    // Store token
    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        email: email,
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing token:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate reset link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get origin from request or use default
    const origin = req.headers.get("origin") || "https://farai-safari-guardian.lovable.app";
    const resetUrl = `${origin}/reset-password?token=${token}`;

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FARSI Security <noreply@farsis.co.ke>",
        to: [email],
        subject: "Reset Your FARSI Password",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #0a0a1a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a1a; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 212, 255, 0.15);">
                    <!-- Header with Logo -->
                    <tr>
                      <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid rgba(0, 212, 255, 0.2);">
                        <div style="display: inline-block; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); padding: 15px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="color: #0a0a1a; font-size: 28px; font-weight: bold; letter-spacing: 2px;">🛡️ FARSI</span>
                        </div>
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Password Reset Request</h1>
                      </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                      <td style="padding: 40px;">
                        <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                          Hello,
                        </p>
                        <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                          We received a request to reset your password for your FARSI Security Intelligence account. Click the button below to create a new password:
                        </p>
                        
                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                          <tr>
                            <td align="center">
                              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); color: #0a0a1a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(0, 212, 255, 0.4);">
                                Reset Password
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
                          This link will expire in <strong style="color: #00d4ff;">1 hour</strong> for security reasons.
                        </p>
                        
                        <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 15px 0 0 0;">
                          If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
                        </p>
                        
                        <!-- Security Notice -->
                        <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 8px; padding: 15px; margin-top: 30px;">
                          <p style="color: #ff6b6b; font-size: 13px; margin: 0;">
                            ⚠️ <strong>Security Notice:</strong> Never share this link with anyone. FARSI staff will never ask for your password.
                          </p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px 40px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(0, 212, 255, 0.2);">
                        <p style="color: #666; font-size: 12px; margin: 0; text-align: center;">
                          Forensic Analysis Real-Time Security Intelligence<br>
                          <span style="color: #00d4ff;">farsis.co.ke</span>
                        </p>
                        <p style="color: #444; font-size: 11px; margin: 15px 0 0 0; text-align: center;">
                          This is an automated message. Please do not reply to this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to send reset email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Password reset email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "If the email exists, a reset link has been sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-password-reset:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
