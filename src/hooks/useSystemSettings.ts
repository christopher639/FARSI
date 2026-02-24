import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";

interface SecuritySettings {
  mandatory: boolean;
  method: 'totp' | 'email' | 'any';
}

interface SystemSettings {
  security_2fa_enforcement: SecuritySettings;
}
type SettingValue = Record<string, unknown> | string | number | boolean | null;

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>({
    security_2fa_enforcement: { mandatory: false, method: 'totp' }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_key, setting_value");

      if (error) throw error;

      const settingsMap: Record<string, unknown> = {};
      data?.forEach((row) => {
        settingsMap[row.setting_key] = row.setting_value;
      });

      setSettings({
        security_2fa_enforcement: (settingsMap.security_2fa_enforcement as SecuritySettings) || { mandatory: false, method: 'totp' }
      });
    } catch (err: unknown) {
      console.error("Error fetching system settings:", err);
      setError(getErrorMessage(err, "Failed to fetch system settings"));
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: SettingValue) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("system_settings")
        .update({ 
          setting_value: value as unknown as import("@/integrations/supabase/types").Json,
          updated_by: user?.id 
        })
        .eq("setting_key", key);

      if (error) throw error;

      await fetchSettings();
      return { success: true };
    } catch (err: unknown) {
      console.error("Error updating system setting:", err);
      return { success: false, error: getErrorMessage(err, "Failed to update system setting") };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, error, updateSetting, refetch: fetchSettings };
}
