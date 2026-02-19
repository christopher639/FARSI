import { useCallback, useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyThemeImmediate, THEME_STORAGE_KEY } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const themeSequence = ["dark", "light", "system"] as const;
type ThemePreference = (typeof themeSequence)[number];

const themeLabels: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

const themeIcons: Record<ThemePreference, ComponentType<SVGProps<SVGSVGElement>>> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

const normalizeTheme = (value: string | null): ThemePreference => {
  if (value && themeSequence.includes(value as ThemePreference)) {
    return value as ThemePreference;
  }
  return "system";
};

const isBrowser = typeof window !== "undefined";

export function ThemeToggle() {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>("system");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isBrowser) return;
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    setCurrentTheme(normalizeTheme(stored));

    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: string }>)?.detail;
      if (detail?.theme) {
        setCurrentTheme(normalizeTheme(detail.theme));
      }
    };

    window.addEventListener("farsi-theme-change", handleThemeChange as EventListener);
    return () => {
      window.removeEventListener("farsi-theme-change", handleThemeChange as EventListener);
    };
  }, []);

  const handleToggle = useCallback(async () => {
    const currentIndex = themeSequence.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themeSequence.length;
    const nextTheme = themeSequence[nextIndex];
    applyThemeImmediate(nextTheme);
    setCurrentTheme(nextTheme);

    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ theme_preference: nextTheme })
        .eq("user_id", user.id);
      if (error) {
        throw error;
      }
    } catch (err) {
      console.error("Failed to persist theme preference:", err);
    } finally {
      setSaving(false);
    }
  }, [currentTheme, user]);

  const Icon = themeIcons[currentTheme];
  const nextTheme = themeSequence[(themeSequence.indexOf(currentTheme) + 1) % themeSequence.length];
  const nextLabel = themeLabels[nextTheme];

  return (
    <button
      type="button"
      aria-label={`Switch to ${nextLabel} theme`}
      title={`Current theme: ${themeLabels[currentTheme]}. Click to switch to ${nextLabel}.`}
      onClick={handleToggle}
      disabled={saving}
      className="relative w-10 h-10 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Icon className="w-4 h-4" />
      {saving && (
        <span className="absolute inset-0 rounded-lg border border-primary/70 animate-pulse" />
      )}
    </button>
  );
}
