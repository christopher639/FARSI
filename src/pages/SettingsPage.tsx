import { Settings, User, Shield, Bell, Database, Key, Monitor, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const settingsSections = [
  { icon: User, label: "Profile", active: true },
  { icon: Shield, label: "Security" },
  { icon: Bell, label: "Notifications" },
  { icon: Database, label: "Data & Privacy" },
  { icon: Key, label: "API Access" },
  { icon: Monitor, label: "Display" },
  { icon: Globe, label: "Language" },
];

export default function SettingsPage() {
  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Settings Sidebar */}
      <div className="w-64 bg-card border border-panel-border rounded-lg p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </h2>
        <nav className="space-y-1">
          {settingsSections.map((section) => (
            <button
              key={section.label}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                section.active
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 bg-card border border-panel-border rounded-lg p-6 overflow-y-auto">
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-6">Profile Settings</h1>

          {/* Profile Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Operator Profile</h3>
                <p className="text-sm text-muted-foreground">Security Clearance: Level 4</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Change Avatar
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Display Name</Label>
                <Input id="name" defaultValue="Operator Alpha-7" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Secure Email</Label>
                <Input id="email" type="email" defaultValue="alpha7@farsi.gov.ke" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit Assignment</Label>
                <Input id="unit" defaultValue="Central Command - Nairobi" />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-medium">Preferences</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">Use dark theme for the interface</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Sound Alerts</p>
                  <p className="text-sm text-muted-foreground">Play sound for critical alerts</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Desktop Notifications</p>
                  <p className="text-sm text-muted-foreground">Show browser notifications</p>
                </div>
                <Switch />
              </div>
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancel</Button>
              <Button>Save Changes</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
