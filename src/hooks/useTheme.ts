import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const THEME_STORAGE_KEY = 'farsi_theme_preference';
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const updateDocumentTheme = (theme: string) => {
  if (!isBrowser) return;
  document.documentElement.classList.remove('light', 'dark');
  if (theme === 'system') {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(systemPrefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.classList.add(theme);
  }
};

const persistThemePreference = (theme: string) => {
  if (!isBrowser) return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent('farsi-theme-change', { detail: { theme } }));
};

const applyThemeValue = (theme: string) => {
  updateDocumentTheme(theme);
  persistThemePreference(theme);
};

export function useTheme() {
  const { user } = useAuth();

  const applyTheme = useCallback((theme: string) => {
    applyThemeValue(theme);
  }, []);

  useEffect(() => {
    // 1. First, apply cached theme immediately to prevent flash
    const cachedTheme = isBrowser ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (cachedTheme) {
      applyTheme(cachedTheme);
    }

    // 2. Then fetch from DB to sync (only if user is logged in)
    const fetchAndApplyTheme = async () => {
      if (!user) {
        if (!cachedTheme) {
          applyTheme('light');
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('theme_preference')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        const dbTheme = data?.theme_preference || 'light';
        if (dbTheme !== cachedTheme) {
          applyTheme(dbTheme);
        }
      } catch (error) {
        console.error('Error fetching theme:', error);
        if (!cachedTheme) {
          applyTheme('light');
        }
      }
    };

    fetchAndApplyTheme();

    // Listen for system theme changes when using 'system' mode
    if (isBrowser) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = () => {
        const currentTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (currentTheme === 'system') {
          applyTheme('system');
        }
      };
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }
  }, [user, applyTheme]);

  return { applyTheme };
}

// Export a function to update theme (used by SettingsPage)
export function applyThemeImmediate(theme: string) {
  applyThemeValue(theme);
}
