import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Settings, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { toast } from "sonner";

export default function SystemSettingsPage() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { settings, loading, updateSetting } = useSystemSettings();
  
  const [mandatory2FA, setMandatory2FA] = useState(false);
  const [method2FA, setMethod2FA] = useState<'totp' | 'email' | 'any'>('totp');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (settings.security_2fa_enforcement) {
      setMandatory2FA(settings.security_2fa_enforcement.mandatory);
      setMethod2FA(settings.security_2fa_enforcement.method);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateSetting("security_2fa_enforcement", {
      mandatory: mandatory2FA,
      method: method2FA
    });
    
    if (result.success) {
      toast.success("Security settings updated successfully");
    } else {
      toast.error("Failed to update settings: " + result.error);
    }
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">System Settings</h1>
            <p className="text-muted-foreground">Configure global security policies</p>
          </div>
        </div>

        {/* Security Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Two-Factor Authentication Policy
            </CardTitle>
            <CardDescription>
              Configure mandatory 2FA requirements for all users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mandatory 2FA Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="mandatory-2fa" className="text-base">
                  Enforce Mandatory 2FA
                </Label>
                <p className="text-sm text-muted-foreground">
                  Require all users to set up two-factor authentication
                </p>
              </div>
              <Switch
                id="mandatory-2fa"
                checked={mandatory2FA}
                onCheckedChange={setMandatory2FA}
              />
            </div>

            {/* 2FA Method Selection */}
            {mandatory2FA && (
              <div className="space-y-2">
                <Label>Required 2FA Method</Label>
                <Select value={method2FA} onValueChange={(v: any) => setMethod2FA(v)}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totp">Google Authenticator Only</SelectItem>
                    <SelectItem value="email">Email OTP Only</SelectItem>
                    <SelectItem value="any">Any Method</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {method2FA === 'totp' && "Users must set up Google Authenticator"}
                  {method2FA === 'email' && "Users will receive OTP codes via email"}
                  {method2FA === 'any' && "Users can choose their preferred method"}
                </p>
              </div>
            )}

            {/* Warning Alert */}
            {mandatory2FA && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Users without 2FA configured will be blocked from accessing their accounts 
                  until they complete the setup process.
                </AlertDescription>
              </Alert>
            )}

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
  );
}
