import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const THEME_STORAGE_KEY = 'farsi_theme_preference';

export function useTheme() {
  const { user } = useAuth();

  const applyTheme = useCallback((theme: string) => {
    document.documentElement.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.add(systemPrefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.classList.add(theme);
    }
    // Persist to localStorage for instant load next time
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, []);

  useEffect(() => {
    // 1. First, apply cached theme immediately to prevent flash
    const cachedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (cachedTheme) {
      applyTheme(cachedTheme);
    }

    // 2. Then fetch from DB to sync (only if user is logged in)
    const fetchAndApplyTheme = async () => {
      if (!user) {
        // If no cached theme and not logged in, default to light
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
        // Only apply if different from cache (to avoid unnecessary repaints)
        if (dbTheme !== cachedTheme) {
          applyTheme(dbTheme);
        }
      } catch (error) {
        console.error('Error fetching theme:', error);
        // Keep cached or default
        if (!cachedTheme) {
          applyTheme('light');
        }
      }
    };

    fetchAndApplyTheme();

    // Listen for system theme changes when using 'system' mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      const currentTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [user, applyTheme]);

  return { applyTheme };
}

// Export a function to update theme (used by SettingsPage)
export function applyThemeImmediate(theme: string) {
  document.documentElement.classList.remove('light', 'dark');
  if (theme === 'system') {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(systemPrefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.classList.add(theme);
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}
