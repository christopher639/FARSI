import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Settings, User, Shield, Bell, Database, Key, Monitor, Globe, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const settingsSections = [
  { icon: User, label: "Profile", id: "profile" },
  { icon: Shield, label: "Security", id: "security" },
  { icon: Bell, label: "Notifications", id: "notifications" },
  { icon: Database, label: "Data & Privacy", id: "data" },
  { icon: Key, label: "API Access", id: "api" },
  { icon: Monitor, label: "Display", id: "display" },
  { icon: Globe, label: "Language", id: "language" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    department: "",
    phone: "",
    clearance_level: "",
    badge_number: "",
  });

  const [preferences, setPreferences] = useState({
    darkMode: true,
    soundAlerts: true,
    desktopNotifications: false,
  });

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
          email: data.email || user.email || "",
          department: data.department || "",
          phone: data.phone || "",
          clearance_level: data.clearance_level || "unclassified",
          badge_number: data.badge_number || "",
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

  const clearanceLevelLabel = (level: string) => {
    return level.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{profile.full_name || "Operator"}</h3>
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

            {activeSection === "notifications" && (
              <>
                <h1 className="text-xl font-bold mb-6">Notification Settings</h1>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Sound Alerts</p>
                      <p className="text-sm text-muted-foreground">Play sound for critical alerts</p>
                    </div>
                    <Switch 
                      checked={preferences.soundAlerts}
                      onCheckedChange={(checked) => setPreferences({ ...preferences, soundAlerts: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Desktop Notifications</p>
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

            {activeSection === "display" && (
              <>
                <h1 className="text-xl font-bold mb-6">Display Settings</h1>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Dark Mode</p>
                      <p className="text-sm text-muted-foreground">Use dark theme for the interface</p>
                    </div>
                    <Switch 
                      checked={preferences.darkMode}
                      onCheckedChange={(checked) => setPreferences({ ...preferences, darkMode: checked })}
                    />
                  </div>
                </div>
              </>
            )}

            {(activeSection === "security" || activeSection === "data" || activeSection === "api" || activeSection === "language") && (
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
