import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Smartphone, Fingerprint, Mail, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startAuthentication } from "@simplewebauthn/browser";

type ConfirmationType = 'totp' | 'biometric' | 'email';

interface SecurityConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ConfirmationType;
  onConfirm: () => void;
  title?: string;
  description?: string;
  userEmail: string;
  userId: string;
}

export function SecurityConfirmDialog({
  open,
  onOpenChange,
  type,
  onConfirm,
  title,
  description,
  userEmail,
  userId,
}: SecurityConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const handleClose = () => {
    setCode("");
    setError(null);
    setCodeSent(false);
    setLoading(false);
    onOpenChange(false);
  };

  const getIcon = () => {
    switch (type) {
      case 'totp':
        return <Smartphone className="w-6 h-6 text-primary" />;
      case 'biometric':
        return <Fingerprint className="w-6 h-6 text-primary" />;
      case 'email':
        return <Mail className="w-6 h-6 text-primary" />;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'totp':
        return "Verify with Authenticator";
      case 'biometric':
        return "Verify with Biometrics";
      case 'email':
        return "Verify with Email";
    }
  };

  const getDescription = () => {
    if (description) return description;
    switch (type) {
      case 'totp':
        return "Enter the 6-digit code from your authenticator app to confirm this security change.";
      case 'biometric':
        return "Use your biometric credential (Face ID, Touch ID, or Windows Hello) to confirm this security change.";
      case 'email':
        return "We'll send a verification code to your email to confirm this security change.";
    }
  };

  const sendEmailOTP = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("send-otp", {
        body: { email: userEmail, userId },
      });

      if (response.error) throw new Error(response.error.message);
      
      setCodeSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOTP = async () => {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("verify-otp", {
        body: { email: userEmail, code },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error("Invalid verification code");

      handleClose();
      onConfirm();
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyTOTP = async () => {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("verify-totp", {
        body: { userId, code },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error("Invalid authenticator code");

      handleClose();
      onConfirm();
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyBiometric = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get login options from server
      const optionsResponse = await supabase.functions.invoke("webauthn-login-options", {
        body: { email: userEmail },
      });

      if (optionsResponse.error) throw new Error(optionsResponse.error.message);
      if (!optionsResponse.data?.options) throw new Error("Failed to get authentication options");

      // Start the WebAuthn authentication
      const authResponse = await startAuthentication({
        optionsJSON: optionsResponse.data.options,
      });

      // Verify with the server
      const verifyResponse = await supabase.functions.invoke("webauthn-login-verify", {
        body: {
          email: userEmail,
          response: authResponse,
        },
      });

      if (verifyResponse.error) throw new Error(verifyResponse.error.message);
      if (!verifyResponse.data?.success) throw new Error("Biometric verification failed");

      handleClose();
      onConfirm();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Biometric authentication was cancelled or not allowed");
      } else {
        setError(err.message || "Biometric verification failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    switch (type) {
      case 'totp':
        verifyTOTP();
        break;
      case 'biometric':
        verifyBiometric();
        break;
      case 'email':
        if (!codeSent) {
          sendEmailOTP();
        } else {
          verifyEmailOTP();
        }
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-200">
              This action will modify your security settings. Please verify your identity to continue.
            </AlertDescription>
          </Alert>

          {/* TOTP Input */}
          {type === 'totp' && (
            <div className="space-y-2">
              <Label htmlFor="totp-code">Authenticator Code</Label>
              <Input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
          )}

          {/* Email OTP Input */}
          {type === 'email' && (
            <div className="space-y-2">
              {!codeSent ? (
                <p className="text-sm text-muted-foreground">
                  Click the button below to receive a verification code at <strong>{userEmail}</strong>
                </p>
              ) : (
                <>
                  <Label htmlFor="email-code">Verification Code</Label>
                  <Input
                    id="email-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Code sent to {userEmail}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Biometric Prompt */}
          {type === 'biometric' && !loading && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Fingerprint className="w-10 h-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Click verify to authenticate with your device's biometric sensor
              </p>
            </div>
          )}

          {/* Biometric Loading */}
          {type === 'biometric' && loading && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Fingerprint className="w-10 h-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Please complete the biometric verification on your device...
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleVerify} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : type === 'email' && !codeSent ? (
              "Send Code"
            ) : (
              "Verify"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
