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
    const { token, password, fullName, username, phone, badgeNumber } = await req.json();

    if (!token || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: "Token, password, and full name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("FARSIS_RESEND")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("user_invitations")
      .select("*")
      .eq("token", token)
      .is("accepted_at", null)
      .single();

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the profile with additional info
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        username: username || null,
        phone: phone || null,
        badge_number: badgeNumber || null,
        department: invitation.department || null,
        clearance_level: invitation.clearance_level,
      })
      .eq("user_id", newUser.user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // Assign role to the new user
    const { error: roleAssignError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: invitation.role,
      });

    if (roleAssignError) {
      console.error("Role assignment error:", roleAssignError);
    }

    // Mark invitation as accepted
    await supabaseAdmin
      .from("user_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    // Send welcome email - always use the published URL for consistency
    const publishedUrl = "https://farai-safari-guardian.lovable.app";
    const loginUrl = `${publishedUrl}/login`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FARSI Security <noreply@farsis.co.ke>",
        to: [invitation.email],
        subject: "Welcome to FARSI Security Platform",
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
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Welcome Aboard!</h1>
                      </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                      <td style="padding: 40px;">
                        <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                          Hello <strong style="color: #ffffff;">${fullName}</strong>,
                        </p>
                        <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                          Your FARSI Security Platform account has been successfully created. You now have access to our intelligence and security monitoring systems.
                        </p>
                        
                        <!-- Account Info Box -->
                        <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 20px; margin: 20px 0;">
                          <p style="color: #00d4ff; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">Your Account Details:</p>
                          <p style="color: #ffffff; font-size: 16px; margin: 0;">Email: <strong>${invitation.email}</strong></p>
                          <p style="color: #ffffff; font-size: 16px; margin: 5px 0 0 0;">Role: <strong>${invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}</strong></p>
                          ${invitation.department ? `<p style="color: #ffffff; font-size: 16px; margin: 5px 0 0 0;">Department: <strong>${invitation.department}</strong></p>` : ''}
                        </div>
                        
                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                          <tr>
                            <td align="center">
                              <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); color: #0a0a1a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(0, 212, 255, 0.4);">
                                Login to Dashboard
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Security Notice -->
                        <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 8px; padding: 15px; margin-top: 30px;">
                          <p style="color: #ff6b6b; font-size: 13px; margin: 0;">
                            🔐 <strong>Security Tips:</strong> Enable two-factor authentication in your settings for enhanced security. Never share your login credentials.
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

    console.log("User created and welcome email sent:", invitation.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account created successfully",
        user: { id: newUser.user.id, email: newUser.user.email }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in accept-invitation:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
