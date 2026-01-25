import React, { useState, forwardRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TotpSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
}

export const TotpSetupDialog = forwardRef<HTMLDivElement, TotpSetupDialogProps>(
  function TotpSetupDialog({ open, onOpenChange, userId, onSuccess }, ref) {
    const [step, setStep] = useState<'generate' | 'verify'>('generate');
    const [loading, setLoading] = useState(false);
    const [secret, setSecret] = useState("");
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    const generateSecret = async () => {
      setLoading(true);
      setError("");
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("You must be logged in");
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-totp-secret`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
          }
        );

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to generate secret");
        }

        setSecret(data.secret);
        setQrCodeUrl(data.qrCodeUrl);
        setStep('verify');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const verifyCode = async () => {
      if (verificationCode.length !== 6) {
        setError("Please enter a 6-digit code");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-totp`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              code: verificationCode,
              enableAfterVerify: true,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Verification failed");
        }

        toast.success("Google Authenticator enabled successfully!");
        onSuccess();
        handleClose();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const copySecret = () => {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Secret copied to clipboard");
    };

    const handleClose = () => {
      setStep('generate');
      setSecret("");
      setQrCodeUrl("");
      setVerificationCode("");
      setError("");
      onOpenChange(false);
    };

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent ref={ref} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Set Up Google Authenticator
            </DialogTitle>
            <DialogDescription>
              {step === 'generate' 
                ? "Generate a secret key to link your authenticator app."
                : "Scan the QR code and enter the verification code."
              }
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'generate' ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Click the button below to generate a unique secret for your account. 
                You'll then scan a QR code with your Google Authenticator app.
              </p>
              <Button onClick={generateSecret} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Secret Key"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-lg">
                  <img 
                    src={qrCodeUrl} 
                    alt="TOTP QR Code" 
                    className="w-48 h-48"
                  />
                </div>
              </div>

              {/* Manual Entry Option */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Can't scan? Enter this key manually:
                </Label>
                <div className="flex gap-2">
                  <Input 
                    value={secret} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={copySecret}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Verification Input */}
              <div className="space-y-2">
                <Label htmlFor="totp-code">Enter the 6-digit code from your app</Label>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setStep('generate')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={verifyCode} 
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Enable"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);
