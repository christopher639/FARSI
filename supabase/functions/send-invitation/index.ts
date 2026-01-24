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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, role, clearanceLevel, department } = await req.json();

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("FARSIS_RESEND")!;

    // Verify the requesting user is an admin
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: currentUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !currentUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if current user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Only admins can send invitations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from("user_invitations")
      .select("id")
      .eq("email", email.toLowerCase())
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "A pending invitation already exists for this email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate invitation token
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store invitation
    const { error: insertError } = await supabaseAdmin
      .from("user_invitations")
      .insert({
        email: email.toLowerCase(),
        token,
        role,
        clearance_level: clearanceLevel || "unclassified",
        department: department || null,
        invited_by: currentUser.id,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing invitation:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get inviter's name
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", currentUser.id)
      .single();

    const inviterName = inviterProfile?.full_name || "An administrator";

    // Generate invitation URL
    const origin = req.headers.get("origin") || "https://farai-safari-guardian.lovable.app";
    const inviteUrl = `${origin}/accept-invitation?token=${token}`;

    // Send invitation email
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FARSI Security <noreply@farsis.co.ke>",
        to: [email],
        subject: "You're Invited to Join FARSI Security Platform",
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
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">You're Invited!</h1>
                      </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                      <td style="padding: 40px;">
                        <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                          Hello,
                        </p>
                        <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                          <strong style="color: #ffffff;">${inviterName}</strong> has invited you to join the FARSI Security Intelligence Platform as a <strong style="color: #00d4ff;">${role.charAt(0).toUpperCase() + role.slice(1)}</strong>.
                        </p>
                        
                        <!-- Role Info Box -->
                        <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 20px; margin: 20px 0;">
                          <p style="color: #00d4ff; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">Your Access Level:</p>
                          <p style="color: #ffffff; font-size: 16px; margin: 0;">Role: <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong></p>
                          ${department ? `<p style="color: #ffffff; font-size: 16px; margin: 5px 0 0 0;">Department: <strong>${department}</strong></p>` : ''}
                        </div>
                        
                        <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                          Click the button below to complete your registration and set up your account:
                        </p>
                        
                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                          <tr>
                            <td align="center">
                              <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); color: #0a0a1a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(0, 212, 255, 0.4);">
                                Accept Invitation
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
                          This invitation link will expire in <strong style="color: #00d4ff;">7 days</strong>.
                        </p>
                        
                        <!-- Security Notice -->
                        <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 8px; padding: 15px; margin-top: 30px;">
                          <p style="color: #ff6b6b; font-size: 13px; margin: 0;">
                            ⚠️ <strong>Security Notice:</strong> Never share this link with anyone. This invitation is exclusively for you.
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
      
      // Delete the invitation since email failed
      await supabaseAdmin.from("user_invitations").delete().eq("token", token);
      
      return new Response(
        JSON.stringify({ error: "Failed to send invitation email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invitation email sent successfully to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Invitation sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-invitation:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
