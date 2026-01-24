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
    const { userId, email, userAgent, ipAddress, isNewDevice } = await req.json();

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: "UserId and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("FARSIS_RESEND")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Generate a device fingerprint from user agent
    const deviceFingerprint = await generateFingerprint(userAgent || "");

    // Check if this device has been used before
    const { data: existingSessions } = await supabaseAdmin
      .from("login_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("device_fingerprint", deviceFingerprint)
      .limit(1);

    const isActuallyNewDevice = !existingSessions || existingSessions.length === 0;

    // Store the login session
    await supabaseAdmin
      .from("login_sessions")
      .insert({
        user_id: userId,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        device_fingerprint: deviceFingerprint,
        is_new_device: isActuallyNewDevice,
      });

    // Get user profile for name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .single();

    const userName = profile?.full_name || "User";
    const loginTime = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Parse user agent for device info
    const deviceInfo = parseUserAgent(userAgent || "Unknown device");

    // Send login notification email
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FARSI Security <noreply@farsis.co.ke>",
        to: [email],
        subject: isActuallyNewDevice 
          ? "⚠️ New Device Login Detected - FARSI Security" 
          : "Login Notification - FARSI Security",
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
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid rgba(0, 212, 255, 0.2);">
                        <div style="display: inline-block; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); padding: 15px 20px; border-radius: 12px; margin-bottom: 20px;">
                          <span style="color: #0a0a1a; font-size: 28px; font-weight: bold; letter-spacing: 2px;">🛡️ FARSI</span>
                        </div>
                        <h1 style="color: ${isActuallyNewDevice ? '#ff6b6b' : '#ffffff'}; margin: 0; font-size: 24px; font-weight: 600;">
                          ${isActuallyNewDevice ? '⚠️ New Device Login' : 'Login Notification'}
                        </h1>
                      </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                      <td style="padding: 40px;">
                        <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                          Hello <strong style="color: #ffffff;">${userName}</strong>,
                        </p>
                        <p style="color: #b0b0b0; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                          ${isActuallyNewDevice 
                            ? 'We detected a login to your FARSI account from a new device:' 
                            : 'A login to your FARSI account was detected:'}
                        </p>
                        
                        <!-- Login Details Box -->
                        <div style="background: ${isActuallyNewDevice ? 'rgba(255, 107, 107, 0.1)' : 'rgba(0, 212, 255, 0.1)'}; border: 1px solid ${isActuallyNewDevice ? 'rgba(255, 107, 107, 0.3)' : 'rgba(0, 212, 255, 0.3)'}; border-radius: 8px; padding: 20px; margin: 20px 0;">
                          <p style="color: ${isActuallyNewDevice ? '#ff6b6b' : '#00d4ff'}; font-size: 14px; margin: 0 0 15px 0; font-weight: bold;">Login Details:</p>
                          <table style="width: 100%;">
                            <tr>
                              <td style="color: #888; font-size: 14px; padding: 5px 0;">Time:</td>
                              <td style="color: #ffffff; font-size: 14px; padding: 5px 0; text-align: right;">${loginTime}</td>
                            </tr>
                            <tr>
                              <td style="color: #888; font-size: 14px; padding: 5px 0;">Device:</td>
                              <td style="color: #ffffff; font-size: 14px; padding: 5px 0; text-align: right;">${deviceInfo.device}</td>
                            </tr>
                            <tr>
                              <td style="color: #888; font-size: 14px; padding: 5px 0;">Browser:</td>
                              <td style="color: #ffffff; font-size: 14px; padding: 5px 0; text-align: right;">${deviceInfo.browser}</td>
                            </tr>
                            ${ipAddress ? `
                            <tr>
                              <td style="color: #888; font-size: 14px; padding: 5px 0;">IP Address:</td>
                              <td style="color: #ffffff; font-size: 14px; padding: 5px 0; text-align: right;">${ipAddress}</td>
                            </tr>
                            ` : ''}
                          </table>
                        </div>
                        
                        ${isActuallyNewDevice ? `
                        <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 8px; padding: 15px; margin-top: 20px;">
                          <p style="color: #ff6b6b; font-size: 14px; margin: 0;">
                            <strong>⚠️ If this wasn't you:</strong><br>
                            Please change your password immediately and contact your administrator. You can reset your password from the login page.
                          </p>
                        </div>
                        ` : ''}
                        
                        <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
                          If this was you, no action is needed. We send these notifications to help keep your account secure.
                        </p>
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

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend error:", errorData);
      // Don't fail the whole request if email fails
    } else {
      console.log("Login alert email sent:", email, isActuallyNewDevice ? "(new device)" : "");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        isNewDevice: isActuallyNewDevice,
        message: "Login recorded" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-login-alert:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateFingerprint(userAgent: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userAgent);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}

function parseUserAgent(ua: string): { device: string; browser: string } {
  let device = "Unknown Device";
  let browser = "Unknown Browser";

  // Detect browser
  if (ua.includes("Chrome") && !ua.includes("Edg")) {
    browser = "Chrome";
  } else if (ua.includes("Firefox")) {
    browser = "Firefox";
  } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
    browser = "Safari";
  } else if (ua.includes("Edg")) {
    browser = "Microsoft Edge";
  } else if (ua.includes("Opera") || ua.includes("OPR")) {
    browser = "Opera";
  }

  // Detect device/OS
  if (ua.includes("iPhone")) {
    device = "iPhone";
  } else if (ua.includes("iPad")) {
    device = "iPad";
  } else if (ua.includes("Android")) {
    device = "Android Device";
  } else if (ua.includes("Windows")) {
    device = "Windows PC";
  } else if (ua.includes("Mac OS")) {
    device = "Mac";
  } else if (ua.includes("Linux")) {
    device = "Linux";
  }

  return { device, browser };
}
