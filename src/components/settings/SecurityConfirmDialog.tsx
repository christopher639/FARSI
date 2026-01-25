import { useState, useEffect, useRef } from "react";
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
import { Loader2, Shield, Smartphone, Fingerprint, Mail, AlertTriangle, Lock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startAuthentication } from "@simplewebauthn/browser";

type ConfirmationType = 'totp' | 'biometric' | 'email' | 'password';
type AlternativeMethod = 'email' | 'password';

// Session storage keys for state persistence
const SEC_STORAGE_KEY_CODE_SENT = 'sec_confirm_code_sent';
const SEC_STORAGE_KEY_SHOW_ALT = 'sec_confirm_show_alt';
const SEC_STORAGE_KEY_ALT_METHOD = 'sec_confirm_alt_method';

interface SecurityConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ConfirmationType;
  onConfirm: () => void;
  title?: string;
  description?: string;
  userEmail: string;
  userId: string;
  allowAlternative?: boolean; // Allow using alternative methods if primary fails
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
  allowAlternative = true,
}: SecurityConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  // Initialize from session storage to persist across tab switches
  const [codeSent, setCodeSent] = useState(() => {
    return sessionStorage.getItem(SEC_STORAGE_KEY_CODE_SENT) === 'true';
  });
  const [showAlternative, setShowAlternative] = useState(() => {
    return sessionStorage.getItem(SEC_STORAGE_KEY_SHOW_ALT) === 'true';
  });
  const [alternativeMethod, setAlternativeMethod] = useState<AlternativeMethod | null>(() => {
    const saved = sessionStorage.getItem(SEC_STORAGE_KEY_ALT_METHOD);
    return saved as AlternativeMethod | null;
  });
  const [biometricFailed, setBiometricFailed] = useState(false);
  
  // Track if mounted
  const isMountedRef = useRef(true);

  // Persist state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(SEC_STORAGE_KEY_CODE_SENT, String(codeSent));
  }, [codeSent]);

  useEffect(() => {
    sessionStorage.setItem(SEC_STORAGE_KEY_SHOW_ALT, String(showAlternative));
  }, [showAlternative]);

  useEffect(() => {
    if (alternativeMethod) {
      sessionStorage.setItem(SEC_STORAGE_KEY_ALT_METHOD, alternativeMethod);
    } else {
      sessionStorage.removeItem(SEC_STORAGE_KEY_ALT_METHOD);
    }
  }, [alternativeMethod]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleClose = () => {
    setCode("");
    setPassword("");
    setError(null);
    setCodeSent(false);
    setLoading(false);
    setShowAlternative(false);
    setAlternativeMethod(null);
    setBiometricFailed(false);
    // Clear persisted state
    sessionStorage.removeItem(SEC_STORAGE_KEY_CODE_SENT);
    sessionStorage.removeItem(SEC_STORAGE_KEY_SHOW_ALT);
    sessionStorage.removeItem(SEC_STORAGE_KEY_ALT_METHOD);
    onOpenChange(false);
  };

  const getIcon = () => {
    if (alternativeMethod === 'email') return <Mail className="w-6 h-6 text-primary" />;
    if (alternativeMethod === 'password') return <Lock className="w-6 h-6 text-primary" />;
    
    switch (type) {
      case 'totp':
        return <Smartphone className="w-6 h-6 text-primary" />;
      case 'biometric':
        return <Fingerprint className="w-6 h-6 text-primary" />;
      case 'email':
        return <Mail className="w-6 h-6 text-primary" />;
      case 'password':
        return <Lock className="w-6 h-6 text-primary" />;
    }
  };

  const getTitle = () => {
    if (showAlternative && !alternativeMethod) return "Choose Verification Method";
    if (alternativeMethod === 'email') return "Verify with Email";
    if (alternativeMethod === 'password') return "Verify with Password";
    if (title) return title;
    
    switch (type) {
      case 'totp':
        return "Verify with Authenticator";
      case 'biometric':
        return "Verify with Biometrics";
      case 'email':
        return "Verify with Email";
      case 'password':
        return "Verify with Password";
    }
  };

  const getDescription = () => {
    if (showAlternative && !alternativeMethod) {
      return "Can't access your primary verification method? Choose an alternative way to confirm your identity.";
    }
    if (alternativeMethod === 'email') {
      return "We'll send a verification code to your email to confirm this security change.";
    }
    if (alternativeMethod === 'password') {
      return "Enter your account password to confirm this security change.";
    }
    if (description) return description;
    
    switch (type) {
      case 'totp':
        return "Enter the 6-digit code from your authenticator app to confirm this security change.";
      case 'biometric':
        return "Use your biometric credential (Face ID, Touch ID, or Windows Hello) to confirm this security change.";
      case 'email':
        return "We'll send a verification code to your email to confirm this security change.";
      case 'password':
        return "Enter your account password to confirm this security change.";
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
        body: { userId, code },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success && !response.data?.verified) throw new Error("Invalid verification code");

      handleClose();
      onConfirm();
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyPassword = async () => {
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verify password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (signInError) {
        throw new Error("Incorrect password");
      }

      handleClose();
      onConfirm();
    } catch (err: any) {
      setError(err.message || "Password verification failed");
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
      if (!response.data?.success && !response.data?.verified) throw new Error("Invalid authenticator code");

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
          credential: authResponse,
        },
      });

      if (verifyResponse.error) throw new Error(verifyResponse.error.message);
      if (!verifyResponse.data?.verified && !verifyResponse.data?.success) throw new Error("Biometric verification failed");

      handleClose();
      onConfirm();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Biometric authentication was cancelled or not allowed");
        setBiometricFailed(true);
      } else if (err.message?.includes("No passkey") || err.message?.includes("not found")) {
        setError("No passkey found on this device. Please use an alternative method.");
        setBiometricFailed(true);
      } else {
        setError(err.message || "Biometric verification failed");
        setBiometricFailed(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    if (alternativeMethod === 'email') {
      if (!codeSent) {
        sendEmailOTP();
      } else {
        verifyEmailOTP();
      }
      return;
    }
    
    if (alternativeMethod === 'password') {
      verifyPassword();
      return;
    }
    
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
      case 'password':
        verifyPassword();
        break;
    }
  };

  const handleUseAlternative = () => {
    setError(null);
    setShowAlternative(true);
    setAlternativeMethod(null);
    setBiometricFailed(false);
  };

  const handleSelectAlternative = (method: AlternativeMethod) => {
    setError(null);
    setCode("");
    setPassword("");
    setCodeSent(false);
    setAlternativeMethod(method);
  };

  const handleBackFromAlternative = () => {
    setError(null);
    setCode("");
    setPassword("");
    setCodeSent(false);
    setAlternativeMethod(null);
    setShowAlternative(false);
    setBiometricFailed(false);
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

          {/* Alternative Method Selection */}
          {showAlternative && !alternativeMethod && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-4 flex items-center gap-4"
                onClick={() => handleSelectAlternative('email')}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-medium">Email Verification</div>
                  <div className="text-sm text-muted-foreground">Send a code to {userEmail}</div>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-4 flex items-center gap-4"
                onClick={() => handleSelectAlternative('password')}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-medium">Password Verification</div>
                  <div className="text-sm text-muted-foreground">Enter your account password</div>
                </div>
              </Button>

              <button
                type="button"
                onClick={handleBackFromAlternative}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to primary method
              </button>
            </div>
          )}

          {/* Password Input (alternative method) */}
          {alternativeMethod === 'password' && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50"
              />
              <button
                type="button"
                onClick={handleBackFromAlternative}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
              >
                <ArrowLeft className="w-4 h-4" /> Try another method
              </button>
            </div>
          )}

          {/* Email OTP Input (alternative method) */}
          {alternativeMethod === 'email' && (
            <div className="space-y-2">
              {!codeSent ? (
                <p className="text-sm text-muted-foreground">
                  Click the button below to receive a verification code at <strong>{userEmail}</strong>
                </p>
              ) : (
                <>
                  <Label htmlFor="alt-email-code">Verification Code</Label>
                  <Input
                    id="alt-email-code"
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
              <button
                type="button"
                onClick={handleBackFromAlternative}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
              >
                <ArrowLeft className="w-4 h-4" /> Try another method
              </button>
            </div>
          )}

          {/* TOTP Input (primary) */}
          {type === 'totp' && !showAlternative && (
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
              {allowAlternative && (
                <button
                  type="button"
                  onClick={handleUseAlternative}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Can't access your authenticator?
                </button>
              )}
            </div>
          )}

          {/* Email OTP Input (primary) */}
          {type === 'email' && !showAlternative && (
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

          {/* Password Input (primary) */}
          {type === 'password' && !showAlternative && (
            <div className="space-y-2">
              <Label htmlFor="primary-password">Password</Label>
              <Input
                id="primary-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50"
              />
            </div>
          )}

          {/* Biometric Prompt (primary) */}
          {type === 'biometric' && !showAlternative && !loading && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Fingerprint className="w-10 h-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Click verify to authenticate with your device's biometric sensor
              </p>
              {(biometricFailed || allowAlternative) && (
                <button
                  type="button"
                  onClick={handleUseAlternative}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  {biometricFailed ? "Use alternative method" : "Can't use your passkey?"}
                </button>
              )}
            </div>
          )}

          {/* Biometric Loading */}
          {type === 'biometric' && !showAlternative && loading && (
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

        {/* Action Buttons */}
        {!(showAlternative && !alternativeMethod) && (
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
              ) : (type === 'email' || alternativeMethod === 'email') && !codeSent ? (
                "Send Code"
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
