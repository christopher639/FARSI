import React, { useState, forwardRef, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Shield, Fingerprint, Smartphone, Mail, Loader2, CheckCircle, AlertCircle, ArrowRight, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";
import { TotpSetupDialog } from "./TotpSetupDialog";

type SetupMethod = 'totp' | 'biometric' | 'email';
type StepType = 'intro' | 'verify-email' | 'selecting' | 'setting-up' | 'success';

// Session storage keys for state persistence
const STORAGE_KEY_STEP = 'mfa_setup_step';
const STORAGE_KEY_OTP_SENT = 'mfa_setup_otp_sent';
const STORAGE_KEY_EMAIL_VERIFIED = 'mfa_setup_email_verified';
const STORAGE_KEY_SELECTED_METHOD = 'mfa_setup_selected_method';

interface MandatorySecuritySetupDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
  userEmail: string;
  mandatoryMethod?: string; // 'email' | 'totp' | 'biometric' | 'any'
  preventClose?: boolean;
}

export const MandatorySecuritySetupDialog = forwardRef<HTMLDivElement, MandatorySecuritySetupDialogProps>(
  function MandatorySecuritySetupDialog({
    open,
    onOpenChange,
    onSuccess,
    userId,
    userEmail,
    mandatoryMethod = 'any',
    preventClose = false,
  }, ref) {
    // Initialize state from sessionStorage to persist across tab switches
    const [step, setStep] = useState<StepType>(() => {
      const saved = sessionStorage.getItem(STORAGE_KEY_STEP);
      return (saved as StepType) || 'intro';
    });
    const [selectedMethod, setSelectedMethod] = useState<SetupMethod | null>(() => {
      const saved = sessionStorage.getItem(STORAGE_KEY_SELECTED_METHOD);
      return saved as SetupMethod | null;
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTotpSetup, setShowTotpSetup] = useState(false);
    
    // Email OTP verification state - persist across tab switches
    const [otpCode, setOtpCode] = useState("");
    const [otpSent, setOtpSent] = useState(() => {
      return sessionStorage.getItem(STORAGE_KEY_OTP_SENT) === 'true';
    });
    const [emailVerified, setEmailVerified] = useState(() => {
      return sessionStorage.getItem(STORAGE_KEY_EMAIL_VERIFIED) === 'true';
    });
    const [sendingOtp, setSendingOtp] = useState(false);
    
    // Track if component is mounted to prevent state updates on unmount
    const isMountedRef = useRef(true);

    // Persist state to sessionStorage when it changes
    useEffect(() => {
      sessionStorage.setItem(STORAGE_KEY_STEP, step);
    }, [step]);

    useEffect(() => {
      sessionStorage.setItem(STORAGE_KEY_OTP_SENT, String(otpSent));
    }, [otpSent]);

    useEffect(() => {
      sessionStorage.setItem(STORAGE_KEY_EMAIL_VERIFIED, String(emailVerified));
    }, [emailVerified]);

    useEffect(() => {
      if (selectedMethod) {
        sessionStorage.setItem(STORAGE_KEY_SELECTED_METHOD, selectedMethod);
      } else {
        sessionStorage.removeItem(STORAGE_KEY_SELECTED_METHOD);
      }
    }, [selectedMethod]);

    // Cleanup on unmount
    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    const handleClose = () => {
      // Prevent closing without completing setup if preventClose is true
      if (preventClose && step !== 'success') {
        return;
      }
      if (step === 'success') {
        onOpenChange?.(false);
        resetState();
      }
    };

    const resetState = () => {
      setStep('intro');
      setSelectedMethod(null);
      setError(null);
      setLoading(false);
      setOtpCode("");
      setOtpSent(false);
      setEmailVerified(false);
      setSendingOtp(false);
      // Clear persisted state
      sessionStorage.removeItem(STORAGE_KEY_STEP);
      sessionStorage.removeItem(STORAGE_KEY_OTP_SENT);
      sessionStorage.removeItem(STORAGE_KEY_EMAIL_VERIFIED);
      sessionStorage.removeItem(STORAGE_KEY_SELECTED_METHOD);
    };

    const getAvailableMethods = (): SetupMethod[] => {
      switch (mandatoryMethod) {
        case 'email':
          return ['email'];
        case 'totp':
          return ['totp'];
        case 'biometric':
          return ['biometric'];
        default:
          return ['email', 'totp', 'biometric'];
      }
    };

    // Send OTP to verify user owns the email
    const sendVerificationOtp = async () => {
      setError(null);
      setSendingOtp(true);

      try {
        const { data, error } = await supabase.functions.invoke('send-otp', {
          body: { email: userEmail, userId },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setOtpSent(true);
        toast.success('Verification code sent to your email');
      } catch (err: any) {
        console.error('Error sending OTP:', err);
        setError(err.message || 'Failed to send verification code');
      } finally {
        setSendingOtp(false);
      }
    };

    // Verify the OTP code
    const verifyOtp = async () => {
      if (otpCode.length !== 6) {
        setError('Please enter the complete 6-digit code');
        return;
      }

      setError(null);
      setLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke('verify-otp', {
          body: { userId, code: otpCode },
        });

        if (error) throw error;
        if (!data?.verified) throw new Error('Invalid or expired code');

        setEmailVerified(true);
        toast.success('Email verified successfully!');
        
        // Move to method selection
        const methods = getAvailableMethods();
        if (methods.length === 1) {
          // Only one method available, go directly to setup
          setSelectedMethod(methods[0]);
          handleSetupMethod(methods[0]);
        } else {
          setStep('selecting');
        }
      } catch (err: any) {
        console.error('Error verifying OTP:', err);
        setError(err.message || 'Invalid verification code');
      } finally {
        setLoading(false);
      }
    };

    const handleStartSetup = () => {
      // First, send email OTP for verification
      setStep('verify-email');
      sendVerificationOtp();
    };

    const handleSelectMethod = (method: SetupMethod) => {
      setSelectedMethod(method);
      handleSetupMethod(method);
    };

    const handleSetupMethod = async (method: SetupMethod) => {
      setError(null);
      setLoading(true);
      setStep('setting-up');

      try {
        switch (method) {
          case 'email':
            // Enable email 2FA
            const { error: emailError } = await supabase
              .from('profiles')
              .update({
                two_factor_enabled: true,
                two_factor_method: 'email',
              })
              .eq('user_id', userId);

            if (emailError) throw emailError;
            
            setStep('success');
            toast.success('Email 2FA enabled successfully!');
            break;

          case 'totp':
            // Show TOTP setup dialog
            setShowTotpSetup(true);
            setLoading(false);
            break;

          case 'biometric':
            await setupBiometric();
            break;
        }
      } catch (err: any) {
        console.error('Setup error:', err);
        setError(err.message || 'Failed to set up security method');
        setStep('selecting');
      } finally {
        if (method !== 'totp') {
          setLoading(false);
        }
      }
    };

    const setupBiometric = async () => {
      try {
        // Check if platform authenticator is available
        if (!window.PublicKeyCredential) {
          throw new Error("Your browser doesn't support biometric authentication");
        }

        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
          throw new Error("No biometric authenticator found on this device");
        }

        // Get registration options from server
        const { data: optionsData, error: optionsError } = await supabase.functions.invoke('webauthn-register-options');

        if (optionsError || !optionsData?.options) {
          throw new Error(optionsError?.message || "Failed to get registration options");
        }

        // Prepare options
        const options = {
          ...optionsData.options,
          challenge: optionsData.challenge,
          user: {
            ...optionsData.options.user,
            id: optionsData.options.user.id,
          },
        };

        // Start WebAuthn registration
        const credential = await startRegistration({ optionsJSON: options });

        // Verify registration with server
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('webauthn-register-verify', {
          body: { credential, makeMandatory: false },
        });

        if (verifyError || !verifyData?.success) {
          throw new Error(verifyError?.message || "Failed to verify registration");
        }

        // Also enable 2FA for consistency
        await supabase
          .from('profiles')
          .update({
            two_factor_enabled: true,
          })
          .eq('user_id', userId);

        setStep('success');
        toast.success('Biometric authentication enabled successfully!');
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          throw new Error("Biometric authentication was cancelled. Please try again.");
        }
        throw err;
      }
    };

    const handleTotpSuccess = async () => {
      // Enable 2FA flag when TOTP is set up
      try {
        await supabase
          .from('profiles')
          .update({
            two_factor_enabled: true,
            two_factor_method: 'totp',
            totp_enabled: true,
          })
          .eq('user_id', userId);
      } catch (err) {
        console.error('Error updating 2FA status:', err);
      }
      
      setShowTotpSetup(false);
      setStep('success');
      toast.success('Google Authenticator enabled successfully!');
    };

    const handleComplete = () => {
      onSuccess();
      onOpenChange?.(false);
      resetState();
    };

    const methodConfig = {
      email: {
        icon: Mail,
        title: 'Email OTP',
        description: 'Receive a verification code via email each time you log in',
      },
      totp: {
        icon: Smartphone,
        title: 'Authenticator App',
        description: 'Use Google Authenticator or similar apps for codes',
      },
      biometric: {
        icon: Fingerprint,
        title: 'Biometric Login',
        description: 'Use Face ID, Touch ID, or Windows Hello',
      },
    };

    return (
      <>
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent 
            ref={ref}
            className="sm:max-w-lg" 
            onPointerDownOutside={(e) => preventClose && e.preventDefault()}
            onEscapeKeyDown={(e) => preventClose && e.preventDefault()}
            // Hide close button when preventClose is true
            {...(preventClose ? { 'data-hide-close': true } : {})}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Security Configuration Required
              </DialogTitle>
              <DialogDescription>
                Your organization requires additional security measures for your account
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {step === 'intro' && (
                <>
                  <Alert className="bg-amber-500/10 border-amber-500/30">
                    <Shield className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-amber-600 dark:text-amber-400">
                      Your organization has made multi-factor authentication mandatory. 
                      Please set up a security method to continue using this application.
                    </AlertDescription>
                  </Alert>

                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                      <Shield className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Secure Your Account</h3>
                    <p className="text-sm text-muted-foreground">
                      Adding a second factor of authentication helps protect your account 
                      from unauthorized access.
                    </p>
                  </div>

                  <Button onClick={handleStartSetup} className="w-full gap-2">
                    Get Started
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </>
              )}

              {step === 'verify-email' && (
                <>
                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                      <KeyRound className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Verify Your Identity</h3>
                    <p className="text-sm text-muted-foreground">
                      {otpSent 
                        ? `We've sent a verification code to ${userEmail}. Enter it below to proceed.`
                        : `We'll send a verification code to ${userEmail} to confirm your identity.`
                      }
                    </p>
                  </div>

                  {!otpSent ? (
                    <Button 
                      onClick={sendVerificationOtp} 
                      disabled={sendingOtp}
                      className="w-full gap-2"
                    >
                      {sendingOtp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending Code...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Send Verification Code
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center gap-4">
                        <InputOTP
                          maxLength={6}
                          value={otpCode}
                          onChange={setOtpCode}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>

                      <Button 
                        onClick={verifyOtp} 
                        disabled={loading || otpCode.length !== 6}
                        className="w-full gap-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Verify Code
                          </>
                        )}
                      </Button>

                      <div className="text-center">
                        <button
                          onClick={sendVerificationOtp}
                          disabled={sendingOtp}
                          className="text-sm text-primary hover:underline disabled:opacity-50"
                        >
                          {sendingOtp ? 'Sending...' : "Didn't receive the code? Resend"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 'selecting' && (
                <>
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Identity verified! Now choose your security method.
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground text-center">
                    Choose how you'd like to secure your account
                  </p>

                  <div className="space-y-3">
                    {getAvailableMethods().map((method) => {
                      const config = methodConfig[method];
                      const Icon = config.icon;
                      
                      return (
                        <Button
                          key={method}
                          type="button"
                          variant="outline"
                          className="w-full h-auto py-4 flex items-center gap-4 hover:border-primary hover:bg-primary/5"
                          onClick={() => handleSelectMethod(method)}
                          disabled={loading}
                        >
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <div className="text-left flex-1">
                            <div className="font-medium">{config.title}</div>
                            <div className="text-sm text-muted-foreground">{config.description}</div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 'setting-up' && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                    {selectedMethod && (() => {
                      const Icon = methodConfig[selectedMethod].icon;
                      return <Icon className="w-10 h-10 text-primary" />;
                    })()}
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-medium">Setting up {selectedMethod && methodConfig[selectedMethod].title}...</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedMethod === 'biometric' && "Follow your device's prompts to complete setup"}
                      {selectedMethod === 'email' && "Enabling email verification..."}
                      {selectedMethod === 'totp' && "Preparing authenticator setup..."}
                    </p>
                  </div>
                  {loading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Please wait...</span>
                    </div>
                  )}
                </div>
              )}

              {step === 'success' && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-medium text-green-500">Security Setup Complete!</p>
                    <p className="text-sm text-muted-foreground">
                      Your account is now protected with {selectedMethod && methodConfig[selectedMethod].title.toLowerCase()}.
                      You will use this method to log in from now on.
                    </p>
                  </div>
                  <Button onClick={handleComplete} className="w-full gap-2">
                    Continue to Application
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* TOTP Setup Dialog */}
        <TotpSetupDialog
          open={showTotpSetup}
          onOpenChange={(open) => {
            setShowTotpSetup(open);
            if (!open) {
              // If closed without completing, go back to selection
              setStep('selecting');
              setLoading(false);
            }
          }}
          userId={userId}
          onSuccess={handleTotpSuccess}
        />
      </>
    );
  }
);
