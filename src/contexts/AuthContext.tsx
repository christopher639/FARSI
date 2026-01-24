import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Session persistence key
const AUTH_INITIALIZED_KEY = 'farsi_auth_initialized';

type AppRole = 'admin' | 'analyst' | 'viewer';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  // undefined = still resolving / transient fetch error; null = confirmed no role
  userRole: AppRole | null | undefined;
  isAdmin: boolean;
  isAnalyst: boolean;
  isViewer: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Start undefined so routes don't show "Access Denied" before we finish role lookup.
  const [userRole, setUserRole] = useState<AppRole | null | undefined>(undefined);
  const isMountedRef = useRef(true);
  const isInitializedRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const roleRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Inactivity timeout (30 minutes)
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

  const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
    });

    try {
      return await Promise.race([Promise.resolve(promise), timeoutPromise]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

  const fetchUserRole = async (userId: string, opts?: { allowRetry?: boolean }) => {
    try {
      const roleQuery = supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      const { data, error } = await withTimeout(
        roleQuery,
        2500,
        'FETCH_ROLE'
      );

      if (error) {
        console.error('Error fetching user role:', error);
        // Treat errors/timeouts as "unknown" so we don't block valid users with a transient error.
        if (isMountedRef.current) setUserRole(undefined);

        if (opts?.allowRetry !== false) {
          if (roleRetryTimeoutRef.current) clearTimeout(roleRetryTimeoutRef.current);
          roleRetryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) fetchUserRole(userId, { allowRetry: false });
          }, 1000);
        }
        return;
      }

      if (isMountedRef.current) setUserRole((data?.role as AppRole) || null);
    } catch (error) {
      console.error('Error fetching user role:', error);
      if (isMountedRef.current) setUserRole(undefined);
      if (opts?.allowRetry !== false) {
        if (roleRetryTimeoutRef.current) clearTimeout(roleRetryTimeoutRef.current);
        roleRetryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) fetchUserRole(userId, { allowRetry: false });
        }, 1000);
      }
    }
  };

  const fetchAndSetRole = async (userId: string) => {
    if (isMountedRef.current) setLoading(true);
    await fetchUserRole(userId, { allowRetry: true });
    if (isMountedRef.current) setLoading(false);
  };

  // Update activity timestamp on user interactions
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check for inactivity and sign out if needed
  const checkInactivity = useCallback(async () => {
    if (!session) return;
    
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    if (timeSinceActivity > INACTIVITY_TIMEOUT) {
      console.log('User inactive for too long, signing out...');
      await signOut();
    }
  }, [session]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMountedRef.current) return;
        
        // Clear any pending timeout since we got a real auth state
        if (timeoutId) clearTimeout(timeoutId);
        
        // Skip token refresh events entirely - no state changes needed
        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          return;
        }
        
        // For already-initialized sessions, only update session/user if changed
        if (isInitializedRef.current && newSession?.user) {
          // Same user - just update session, keep role as-is
          if (user?.id === newSession.user.id) {
            setSession(newSession);
            setUser(newSession.user);
            return;
          }
        }
        
        // Handle sign-out
        if (!newSession) {
          setSession(null);
          setUser(null);
          setUserRole(null);
          if (isMountedRef.current) setLoading(false);
          return;
        }
        
        // Handle new sign-in or user change
        setSession(newSession);
        setUser(newSession.user);
        
        // Only fetch role if not already initialized with same user
        if (!isInitializedRef.current || user?.id !== newSession.user.id) {
          await fetchAndSetRole(newSession.user.id);
        } else if (isMountedRef.current) {
          setLoading(false);
        }
        
        isInitializedRef.current = true;
      }
    );

    // Initialize auth state with shorter timeout
    const initializeAuth = async () => {
      // Skip if already initialized
      if (isInitializedRef.current) {
        setLoading(false);
        return;
      }
      
      try {
        const { data: { session: currentSession }, error } = await withTimeout(
          supabase.auth.getSession(),
          2500,
          'GET_SESSION'
        );
        
        if (!isMountedRef.current) return;
        
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          isInitializedRef.current = true;
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchAndSetRole(currentSession.user.id);
        } else {
          setLoading(false);
        }
        
        isInitializedRef.current = true;
      } catch (error) {
        const err = error as Error;
        if (err?.message === 'GET_SESSION_TIMEOUT') {
          console.warn('Auth initialization timeout - proceeding without session');
        } else {
          console.error('Auth initialization error:', error);
        }
        if (isMountedRef.current) setLoading(false);
        isInitializedRef.current = true;
      }
    };

    initializeAuth();
    
    // Fallback: ensure loading stops after 3 seconds max
    timeoutId = setTimeout(() => {
      if (isMountedRef.current && !isInitializedRef.current) {
        console.warn('Auth initialization timeout - stopping loading spinner');
        setLoading(false);
        isInitializedRef.current = true;
      }
    }, 3000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);
      if (roleRetryTimeoutRef.current) clearTimeout(roleRetryTimeoutRef.current);
      subscription.unsubscribe();
    };
  }, []);

  // Set up activity tracking and inactivity check
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, updateActivity));
    
    // Check inactivity every minute
    const inactivityInterval = setInterval(checkInactivity, 60 * 1000);
    
    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(inactivityInterval);
    };
  }, [updateActivity, checkInactivity]);

  // Handle visibility change - don't re-trigger auth on tab focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Just update activity, don't re-auth
        updateActivity();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updateActivity]);

  const signIn = async (email: string, password: string) => {
    // IMPORTANT:
    // Don't signOut() here. It can conflict with the internal auth lock used by the SDK
    // and cause AbortError + a stuck "Authenticating" state.
    // Also don't fetch role here; onAuthStateChange already handles role fetch.
    if (isMountedRef.current) setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setUserRole(null);
        setLoading(false);
      }
      return { error };
    }

    // Send login alert email (fire and forget - don't block login)
    if (data?.user) {
      supabase.functions.invoke('send-login-alert', {
        body: {
          userId: data.user.id,
          email: data.user.email,
          userAgent: navigator.userAgent,
        },
      }).catch(err => console.error('Login alert error:', err));
    }

    // Auth state + role will be resolved by the onAuthStateChange listener.
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = useCallback(async () => {
    isInitializedRef.current = false;
    await supabase.auth.signOut();
    setUserRole(null);
    setUser(null);
    setSession(null);
  }, []);

  const value = {
    user,
    session,
    loading,
    userRole,
    isAdmin: userRole === 'admin',
    isAnalyst: userRole === 'analyst',
    isViewer: userRole === 'viewer',
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
