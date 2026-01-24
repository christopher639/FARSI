import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useTheme() {
  const { user } = useAuth();

  useEffect(() => {
    const applyTheme = (theme: string) => {
      document.documentElement.classList.remove('light', 'dark');
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.add(systemPrefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.classList.add(theme);
      }
    };

    const fetchAndApplyTheme = async () => {
      if (!user) {
        // Default to dark if not logged in
        applyTheme('dark');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('theme_preference')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        const theme = data?.theme_preference || 'dark';
        applyTheme(theme);
      } catch (error) {
        console.error('Error fetching theme:', error);
        applyTheme('dark');
      }
    };

    fetchAndApplyTheme();

    // Listen for system theme changes when using 'system' mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      // Re-fetch preference to check if system mode is active
      fetchAndApplyTheme();
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [user]);
}
