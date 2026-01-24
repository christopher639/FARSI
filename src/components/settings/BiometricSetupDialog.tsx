import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Fingerprint, Loader2, CheckCircle, AlertCircle, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";

interface BiometricSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BiometricSetupDialog({ open, onOpenChange, onSuccess }: BiometricSetupDialogProps) {
  const [step, setStep] = useState<'intro' | 'scanning' | 'success' | 'error'>('intro');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [makeMandatory, setMakeMandatory] = useState(false);

  const checkBrowserSupport = (): boolean => {
    if (!window.PublicKeyCredential) {
      setError("Your browser doesn't support biometric authentication. Please use a modern browser like Chrome, Safari, or Edge.");
      return false;
    }
    return true;
  };

  const handleStartSetup = async () => {
    if (!checkBrowserSupport()) {
      setStep('error');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('scanning');

    try {
      // Check if platform authenticator is available
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        setError("No biometric authenticator found on this device. Please ensure Face ID, Touch ID, or Windows Hello is set up.");
        setStep('error');
        setLoading(false);
        return;
      }

      // Get registration options from server
      const { data: optionsData, error: optionsError } = await supabase.functions.invoke('webauthn-register-options');

      if (optionsError || !optionsData?.options) {
        throw new Error(optionsError?.message || "Failed to get registration options");
      }

      // Convert challenge to proper format
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
        body: { credential, makeMandatory },
      });

      if (verifyError || !verifyData?.success) {
        throw new Error(verifyError?.message || "Failed to verify registration");
      }

      setStep('success');
      toast.success("Biometric authentication enabled successfully!");
      
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
        setStep('intro');
      }, 2000);

    } catch (err: any) {
      console.error("Biometric setup error:", err);
      
      // Handle user cancellation
      if (err.name === 'NotAllowedError') {
        setError("Biometric authentication was cancelled. Please try again.");
      } else if (err.name === 'InvalidStateError') {
        setError("This device is already registered for biometric authentication.");
      } else {
        setError(err.message || "Failed to set up biometric authentication. Please try again.");
      }
      
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('intro');
    setError(null);
    setMakeMandatory(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-primary" />
            Set Up Biometric Login
          </DialogTitle>
          <DialogDescription>
            Use Face ID, Touch ID, or Windows Hello to sign in securely
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === 'intro' && (
            <>
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Fingerprint className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Enable biometric authentication to sign in quickly and securely using your device's built-in security features.
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="mandatory" className="font-medium">Make biometric mandatory</Label>
                    <p className="text-xs text-muted-foreground">
                      Only allow biometric login for your account
                    </p>
                  </div>
                  <Switch
                    id="mandatory"
                    checked={makeMandatory}
                    onCheckedChange={setMakeMandatory}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleStartSetup} className="flex-1 gap-2">
                  <Smartphone className="w-4 h-4" />
                  Start Setup
                </Button>
              </div>
            </>
          )}

          {step === 'scanning' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Fingerprint className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-medium">Follow your device's prompts</p>
                <p className="text-sm text-muted-foreground">
                  Use Face ID, Touch ID, or Windows Hello when prompted
                </p>
              </div>
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Waiting for verification...</span>
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
                <p className="font-medium text-green-500">Setup Complete!</p>
                <p className="text-sm text-muted-foreground">
                  You can now use biometric authentication to sign in
                </p>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              
              {error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => setStep('intro')} className="flex-1">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
