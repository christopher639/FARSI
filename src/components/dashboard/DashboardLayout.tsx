import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { supabase } from "@/integrations/supabase/client";
import { MandatorySecuritySetupDialog } from "@/components/settings/MandatorySecuritySetupDialog";

export function DashboardLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = useSystemSettings();
  const [showMandatorySetup, setShowMandatorySetup] = useState(false);
  const [mandatoryMethod, setMandatoryMethod] = useState<string>('any');
  const [checkingMFA, setCheckingMFA] = useState(true);
  
  // Apply theme on dashboard load
  useTheme();

  // Close sidebar on mobile when navigating
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Check if user needs to set up mandatory MFA
  useEffect(() => {
    const checkMandatoryMFA = async () => {
      if (!user || settingsLoading) return;

      try {
        const mandatory2FA = settings.security_2fa_enforcement?.mandatory;
        const mandatoryMethodSetting = settings.security_2fa_enforcement?.method || 'any';

        if (!mandatory2FA) {
          setCheckingMFA(false);
          return;
        }

        // Check user's current security settings
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('two_factor_enabled, totp_enabled, biometric_enabled')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('Error checking profile for MFA:', profileError);
          setCheckingMFA(false);
          return;
        }

        const has2FAEnabled = profileData?.two_factor_enabled === true;
        const hasTotpEnabled = profileData?.totp_enabled === true;
        const hasBiometricEnabled = profileData?.biometric_enabled === true;

        // Check if user has any form of MFA set up
        const hasMFAConfigured = has2FAEnabled || hasTotpEnabled || hasBiometricEnabled;

        if (!hasMFAConfigured) {
          setMandatoryMethod(mandatoryMethodSetting);
          setShowMandatorySetup(true);
        }

        setCheckingMFA(false);
      } catch (err) {
        console.error('Error checking mandatory MFA:', err);
        setCheckingMFA(false);
      }
    };

    checkMandatoryMFA();
  }, [user, settings, settingsLoading]);

  const handleMFASetupSuccess = () => {
    setShowMandatorySetup(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
        onClose={isMobile ? () => setSidebarOpen(false) : undefined}
      />
      
      {/* Overlay for mobile when sidebar is open */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <main
        className={cn(
          "pt-16 min-h-screen transition-all duration-300 ease-in-out",
          // Desktop: shift content based on sidebar state
          // Mobile: no padding, sidebar overlays
          isMobile ? "pl-0" : (sidebarOpen ? "pl-64" : "pl-16")
        )}
      >
        <div className="p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Mandatory Security Setup Modal - Uncloseable until configured */}
      <MandatorySecuritySetupDialog
        open={showMandatorySetup}
        onSuccess={handleMFASetupSuccess}
        userId={user?.id || ''}
        userEmail={user?.email || ''}
        mandatoryMethod={mandatoryMethod}
        preventClose={true}
      />
    </div>
  );
}
