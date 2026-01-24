import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Eye, EyeOff, Lock, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email address' }).max(255),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).max(128),
});

type LoginStep = 'credentials' | 'otp';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginStep>('credentials');
  const [otpCode, setOtpCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);

    // First, verify credentials
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    if (!data.user) {
      setLoading(false);
      setError('Authentication failed');
      return;
    }

    // Sign out immediately - we need OTP verification first
    await supabase.auth.signOut();

    // Send OTP to user's email
    try {
      const response = await supabase.functions.invoke('send-otp', {
        body: { email, userId: data.user.id },
      });

      if (response.error) {
        setLoading(false);
        setError('Failed to send verification code. Please try again.');
        return;
      }

      setPendingUserId(data.user.id);
      setStep('otp');
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError('Failed to send verification code. Please try again.');
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);

    try {
      // Verify OTP
      const response = await supabase.functions.invoke('verify-otp', {
        body: { userId: pendingUserId, code: otpCode },
      });

      if (response.error || !response.data?.verified) {
        setLoading(false);
        setError('Invalid or expired verification code');
        return;
      }

      // OTP verified - now complete the actual sign in
      const { error: finalSignInError } = await signIn(email, password);
      setLoading(false);

      if (finalSignInError) {
        setError(finalSignInError.message);
      } else {
        navigate('/');
      }
    } catch (err) {
      setLoading(false);
      setError('Verification failed. Please try again.');
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setOtpCode('');
    setError(null);
    setPendingUserId(null);
  };

  const resendOtp = async () => {
    if (!pendingUserId) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke('send-otp', {
        body: { email, userId: pendingUserId },
      });

      if (response.error) {
        setError('Failed to resend code. Please try again.');
      } else {
        setError(null);
      }
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <Card className="w-full max-w-md relative z-10 bg-card/80 backdrop-blur-xl border-primary/20">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <img 
                src="/android-chrome-192x192.png" 
                alt="FARSI Logo" 
                className="w-20 h-20 rounded-xl"
              />
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-glow">FARSI Platform</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              {step === 'credentials' 
                ? 'Forensic Analysis Real-Time Security Intelligence'
                : 'Two-Factor Authentication Required'}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="agent@farsi.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-background/50 border-primary/20 focus:border-primary"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background/50 border-primary/20 focus:border-primary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Continue
                  </div>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
                  <KeyRound className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  We've sent a 6-digit verification code to
                </p>
                <p className="text-sm font-medium text-foreground">{email}</p>
              </div>
              
              <div className="flex justify-center">
                <InputOTP
                  value={otpCode}
                  onChange={setOtpCode}
                  maxLength={6}
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
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Verify & Login
                  </div>
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                  className="text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  Resend Code
                </button>
              </div>
            </form>
          )}
          
          <div className="mt-6 pt-4 border-t border-border/50">
            <p className="text-xs text-center text-muted-foreground">
              Authorized personnel only. All access is monitored and logged.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
