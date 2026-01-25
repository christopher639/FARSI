import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { applyThemeImmediate } from "@/hooks/useTheme";
import { Settings, User, Shield, Bell, Database, Key, Monitor, Globe, Loader2, Save, Camera, Moon, Sun, Smartphone, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { TotpSetupDialog } from "@/components/settings/TotpSetupDialog";
import { BiometricSetupDialog } from "@/components/settings/BiometricSetupDialog";
import { SecurityConfirmDialog } from "@/components/settings/SecurityConfirmDialog";

const settingsSections = [
  { icon: User, label: "Profile", id: "profile" },
  { icon: Shield, label: "Security", id: "security" },
  { icon: Bell, label: "Notifications", id: "notifications" },
  { icon: Monitor, label: "Appearance", id: "appearance" },
  { icon: Database, label: "Data & Privacy", id: "data" },
  { icon: Key, label: "API Access", id: "api" },
  { icon: Globe, label: "Language", id: "language" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState({
    full_name: "",
    username: "",
    email: "",
    department: "",
    phone: "",
    clearance_level: "",
    badge_number: "",
    avatar_url: "",
    two_factor_enabled: false,
    two_factor_method: "email" as "email" | "totp" | "both" | "none",
    totp_enabled: false,
    biometric_enabled: false,
    biometric_mandatory: false,
    theme_preference: "dark",
  });

  const [preferences, setPreferences] = useState({
    soundAlerts: true,
    desktopNotifications: false,
  });

  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  
  // Security confirmation states
  const [showSecurityConfirm, setShowSecurityConfirm] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'totp' | 'biometric' | 'email'>('email');
  const [pendingSecurityAction, setPendingSecurityAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          full_name: data.full_name || "",
          username: data.username || "",
          email: data.email || user.email || "",
          department: data.department || "",
          phone: data.phone || "",
          clearance_level: data.clearance_level || "unclassified",
          badge_number: data.badge_number || "",
          avatar_url: data.avatar_url || "",
          two_factor_enabled: data.two_factor_enabled || false,
          two_factor_method: (data as any).two_factor_method || "email",
          totp_enabled: (data as any).totp_enabled || false,
          biometric_enabled: (data as any).biometric_enabled || false,
          biometric_mandatory: (data as any).biometric_mandatory || false,
          theme_preference: data.theme_preference || "dark",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          username: profile.username,
          department: profile.department,
          phone: profile.phone,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success('Avatar updated successfully');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Helper to require security confirmation before action
  const requireSecurityConfirmation = (
    type: 'totp' | 'biometric' | 'email',
    action: () => void,
    title: string,
    description: string
  ) => {
    setConfirmationType(type);
    setPendingSecurityAction(() => action);
    setConfirmTitle(title);
    setConfirmDescription(description);
    setShowSecurityConfirm(true);
  };

  const handleSecurityConfirmSuccess = () => {
    if (pendingSecurityAction) {
      pendingSecurityAction();
      setPendingSecurityAction(null);
    }
  };

  // Internal function to actually toggle 2FA (called after confirmation)
  const executeToggle2FA = async (enabled: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          two_factor_enabled: enabled,
          two_factor_method: enabled ? profile.two_factor_method : 'none'
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile({ ...profile, two_factor_enabled: enabled });
      toast.success(`Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      console.error('Error updating 2FA:', error);
      toast.error('Failed to update 2FA settings');
    }
  };

  const handleToggle2FA = (enabled: boolean) => {
    if (!user) return;

    // If disabling 2FA, require confirmation
    if (!enabled && profile.two_factor_enabled) {
      // Determine which method to use for confirmation
      let confirmType: 'totp' | 'biometric' | 'email' = 'email';
      if (profile.totp_enabled) {
        confirmType = 'totp';
      } else if (profile.biometric_enabled) {
        confirmType = 'biometric';
      }
      
      requireSecurityConfirmation(
        confirmType,
        () => executeToggle2FA(false),
        "Disable Two-Factor Authentication",
        "You are about to disable 2FA. Please verify your identity to confirm this security change."
      );
      return;
    }
    
    // If enabling, no confirmation needed
    executeToggle2FA(enabled);
  };

  // Internal function to actually change 2FA method (called after confirmation)
  const executeChange2FAMethod = async (method: "email" | "totp" | "both") => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ two_factor_method: method })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile({ ...profile, two_factor_method: method });
      const methodLabels = {
        email: 'Email OTP',
        totp: 'Google Authenticator',
        both: 'Both (3-Factor Authentication)'
      };
      toast.success(`2FA method changed to ${methodLabels[method]}`);
    } catch (error: any) {
      console.error('Error updating 2FA method:', error);
      toast.error('Failed to update 2FA method');
    }
  };

  const handle2FAMethodChange = (method: "email" | "totp" | "both") => {
    if (!user) return;

    if ((method === 'totp' || method === 'both') && !profile.totp_enabled) {
      // Need to set up TOTP first
      setShowTotpSetup(true);
      return;
    }

    // Changing method requires confirmation with current method
    let confirmType: 'totp' | 'biometric' | 'email' = 'email';
    if (profile.two_factor_method === 'totp' || profile.two_factor_method === 'both') {
      confirmType = 'totp';
    }
    
    requireSecurityConfirmation(
      confirmType,
      () => executeChange2FAMethod(method),
      "Change Authentication Method",
      "You are about to change your 2FA method. Please verify with your current method."
    );
  };

  const handleTotpSetupSuccess = () => {
    setProfile({ 
      ...profile, 
      totp_enabled: true, 
      two_factor_enabled: true,
      two_factor_method: 'totp' 
    });
  };

  // Internal function to actually disable TOTP (called after confirmation)
  const executeDisableTotp = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          totp_enabled: false,
          totp_secret: null,
          two_factor_method: 'email'
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile({ 
        ...profile, 
        totp_enabled: false,
        two_factor_method: 'email'
      });
      toast.success('Google Authenticator has been disabled');
    } catch (error: any) {
      console.error('Error disabling TOTP:', error);
      toast.error('Failed to disable Google Authenticator');
    }
  };

  const handleDisableTotp = () => {
    if (!user) return;
    
    requireSecurityConfirmation(
      'totp',
      executeDisableTotp,
      "Disable Google Authenticator",
      "Enter your current authenticator code to confirm disabling this security method."
    );
  };

  const handleBiometricSetupSuccess = () => {
    setProfile({ 
      ...profile, 
      biometric_enabled: true,
    });
    fetchProfile(); // Refresh to get latest biometric settings
  };

  // Internal function to actually disable biometric (called after confirmation)
  const executeDisableBiometric = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          biometric_enabled: false,
          biometric_credential_id: null,
          biometric_public_key: null,
          biometric_mandatory: false,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile({ 
        ...profile, 
        biometric_enabled: false,
        biometric_mandatory: false,
      });
      toast.success('Biometric authentication has been disabled');
    } catch (error: any) {
      console.error('Error disabling biometric:', error);
      toast.error('Failed to disable biometric authentication');
    }
  };

  const handleDisableBiometric = () => {
    if (!user) return;
    
    requireSecurityConfirmation(
      'biometric',
      executeDisableBiometric,
      "Disable Biometric Login",
      "Use your biometric credential to confirm disabling this security method."
    );
  };

  const handleThemeChange = async (theme: string) => {
    if (!user) return;

    // Apply theme immediately to prevent flash
    applyThemeImmediate(theme);
    setProfile({ ...profile, theme_preference: theme });

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: theme })
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success(`Theme changed to ${theme}`);
    } catch (error: any) {
      console.error('Error updating theme:', error);
      toast.error('Failed to update theme');
    }
  };

  const clearanceLevelLabel = (level: string) => {
    return level.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      {/* Settings Sidebar */}
      <div className="w-full md:w-64 bg-card border border-panel-border rounded-lg p-4 h-fit">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </h2>
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
          {settingsSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                activeSection === section.id
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <section.icon className="w-4 h-4 flex-shrink-0" />
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 bg-card border border-panel-border rounded-lg p-4 sm:p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="max-w-2xl">
            {activeSection === "profile" && (
              <>
                <h1 className="text-xl font-bold mb-6">Profile Settings</h1>

                {/* Profile Section */}
                <div className="space-y-6">
                  {/* Avatar Upload */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="relative group">
                      <Avatar className="w-20 h-20 border-2 border-primary/30">
                        <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xl">
                          {getInitials(profile.full_name || profile.email || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                          <Camera className="w-6 h-6 text-white" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    <div>
                      <h3 className="font-medium">{profile.full_name || "Operator"}</h3>
                      <p className="text-sm text-muted-foreground">
                        @{profile.username || "no-username"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Security Clearance: {clearanceLevelLabel(profile.clearance_level)}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        Badge: {profile.badge_number || "Not assigned"}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Display Name</Label>
                      <Input 
                        id="name" 
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        value={profile.username}
                        onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                        placeholder="Choose a username"
                        className="bg-background/50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={profile.email}
                        disabled
                        className="bg-background/50 opacity-60"
                      />
                      <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="department">Department</Label>
                        <Input 
                          id="department" 
                          value={profile.department}
                          onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                          className="bg-background/50"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input 
                          id="phone" 
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={fetchProfile}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {activeSection === "security" && (
              <>
                <h1 className="text-xl font-bold mb-6">Security Settings</h1>
                <div className="space-y-6">
                  {/* 2FA Toggle */}
                  <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-panel-border">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                    </div>
                    <Switch 
                      checked={profile.two_factor_enabled}
                      onCheckedChange={handleToggle2FA}
                    />
                  </div>

                  {/* 2FA Method Selection */}
                  {profile.two_factor_enabled && (
                    <div className="space-y-4 p-4 bg-background/50 rounded-lg border border-panel-border">
                      <h3 className="font-medium">Authentication Method</h3>
                      <RadioGroup 
                        value={profile.two_factor_method} 
                        onValueChange={(v) => handle2FAMethodChange(v as "email" | "totp" | "both")}
                        className="space-y-3"
                      >
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-panel-border hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value="email" id="email-otp" />
                          <Label htmlFor="email-otp" className="flex-1 cursor-pointer">
                            <div className="font-medium">Email OTP</div>
                            <div className="text-sm text-muted-foreground">
                              Receive a 6-digit code via email
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-panel-border hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value="totp" id="totp" />
                          <Label htmlFor="totp" className="flex-1 cursor-pointer">
                            <div className="font-medium flex items-center gap-2">
                              <Smartphone className="w-4 h-4" />
                              Google Authenticator
                              {profile.totp_enabled && (
                                <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                                  Configured
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Use a time-based code from your authenticator app
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
                          <RadioGroupItem value="both" id="both" />
                          <Label htmlFor="both" className="flex-1 cursor-pointer">
                            <div className="font-medium flex items-center gap-2">
                              <Shield className="w-4 h-4 text-primary" />
                              Both (3-Factor Authentication)
                              {profile.totp_enabled && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                  Maximum Security
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Email OTP + Authenticator App for highest security
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>

                      {/* TOTP Disable Button - Setup is done through method selection */}
                      {profile.totp_enabled && (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            onClick={handleDisableTotp}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            Disable Google Authenticator
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Biometric Authentication */}
                  <div className="space-y-4 p-4 bg-background/50 rounded-lg border border-panel-border">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Fingerprint className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Biometric Login</p>
                        <p className="text-sm text-muted-foreground">
                          Use Face ID, Touch ID, or Windows Hello to sign in
                        </p>
                      </div>
                      {profile.biometric_enabled && (
                        <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                          Configured
                        </span>
                      )}
                    </div>

                    {profile.biometric_enabled && profile.biometric_mandatory && (
                      <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                        <p className="text-sm text-primary font-medium">
                          Biometric is set as your mandatory login method
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!profile.biometric_enabled ? (
                        <Button 
                          variant="outline" 
                          onClick={() => setShowBiometricSetup(true)}
                          className="gap-2"
                        >
                          <Fingerprint className="w-4 h-4" />
                          Set Up Biometric Login
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          onClick={handleDisableBiometric}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          Disable Biometric Login
                        </Button>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Password Change */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Password</h3>
                    <p className="text-sm text-muted-foreground">
                      To change your password, use the password reset feature.
                    </p>
                    <Button variant="outline" asChild>
                      <a href="/forgot-password">Change Password</a>
                    </Button>
                  </div>
                </div>

                {/* TOTP Setup Dialog */}
                <TotpSetupDialog
                  open={showTotpSetup}
                  onOpenChange={setShowTotpSetup}
                  userId={user?.id || ""}
                  onSuccess={handleTotpSetupSuccess}
                />

                {/* Biometric Setup Dialog */}
                <BiometricSetupDialog
                  open={showBiometricSetup}
                  onOpenChange={setShowBiometricSetup}
                  onSuccess={handleBiometricSetupSuccess}
                />

                {/* Security Confirmation Dialog */}
                <SecurityConfirmDialog
                  open={showSecurityConfirm}
                  onOpenChange={setShowSecurityConfirm}
                  type={confirmationType}
                  onConfirm={handleSecurityConfirmSuccess}
                  title={confirmTitle}
                  description={confirmDescription}
                  userEmail={profile.email}
                  userId={user?.id || ""}
                />
              </>
            )}

            {activeSection === "appearance" && (
              <>
                <h1 className="text-xl font-bold mb-6">Appearance Settings</h1>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Theme</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { id: 'light', label: 'Light', icon: Sun },
                        { id: 'dark', label: 'Dark', icon: Moon },
                        { id: 'system', label: 'System', icon: Monitor },
                      ].map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => handleThemeChange(theme.id)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                            profile.theme_preference === theme.id
                              ? 'border-primary bg-primary/10'
                              : 'border-panel-border hover:border-primary/50'
                          }`}
                        >
                          <theme.icon className={`w-6 h-6 ${
                            profile.theme_preference === theme.id ? 'text-primary' : 'text-muted-foreground'
                          }`} />
                          <span className="text-sm">{theme.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Project Branding */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Project Branding</h3>
                    <div className="flex items-center gap-4 p-4 bg-background/50 rounded-lg border border-panel-border">
                      <img 
                        src="/android-chrome-192x192.png" 
                        alt="FARSI Logo" 
                        className="w-16 h-16 rounded-xl"
                      />
                      <div>
                        <p className="font-semibold text-lg">FARSI</p>
                        <p className="text-sm text-muted-foreground">
                          Forensic Analysis Real-Time Security Intelligence
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === "notifications" && (
              <>
                <h1 className="text-xl font-bold mb-6">Notification Settings</h1>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-panel-border">
                    <div>
                      <p className="font-medium">Sound Alerts</p>
                      <p className="text-sm text-muted-foreground">Play sound for critical alerts</p>
                    </div>
                    <Switch 
                      checked={preferences.soundAlerts}
                      onCheckedChange={(checked) => setPreferences({ ...preferences, soundAlerts: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-panel-border">
                    <div>
                      <p className="font-medium">Desktop Notifications</p>
                      <p className="text-sm text-muted-foreground">Show browser notifications</p>
                    </div>
                    <Switch 
                      checked={preferences.desktopNotifications}
                      onCheckedChange={(checked) => setPreferences({ ...preferences, desktopNotifications: checked })}
                    />
                  </div>
                </div>
              </>
            )}

            {(activeSection === "data" || activeSection === "api" || activeSection === "language") && (
              <div className="text-center py-12 text-muted-foreground">
                <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{settingsSections.find(s => s.id === activeSection)?.label} settings coming soon</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
