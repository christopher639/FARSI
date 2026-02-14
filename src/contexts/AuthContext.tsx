import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'analyst' | 'viewer';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

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
  // Track current user ID to prevent redundant role fetches
  const currentUserIdRef = useRef<string | null>(null);
  // Track if role has been fetched for current user
  const roleLoadedRef = useRef(false);
  
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
    // Skip if role already loaded for this user
    if (currentUserIdRef.current === userId && roleLoadedRef.current) {
      return;
    }
    
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
        // Only set undefined if we haven't loaded role for this user yet
        if (isMountedRef.current && !roleLoadedRef.current) {
          setUserRole(undefined);
        }

        if (opts?.allowRetry !== false && !roleLoadedRef.current) {
          if (roleRetryTimeoutRef.current) clearTimeout(roleRetryTimeoutRef.current);
          roleRetryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) fetchUserRole(userId, { allowRetry: false });
          }, 1000);
        }
        return;
      }

      if (isMountedRef.current) {
        setUserRole((data?.role as AppRole) || null);
        roleLoadedRef.current = true;
        currentUserIdRef.current = userId;
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      if (isMountedRef.current && !roleLoadedRef.current) {
        setUserRole(undefined);
      }
      if (opts?.allowRetry !== false && !roleLoadedRef.current) {
        if (roleRetryTimeoutRef.current) clearTimeout(roleRetryTimeoutRef.current);
        roleRetryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) fetchUserRole(userId, { allowRetry: false });
        }, 1000);
      }
    }
  };

  const fetchAndSetRole = async (userId: string) => {
    // Don't set loading if role is already loaded for this user
    if (currentUserIdRef.current === userId && roleLoadedRef.current) {
      if (isMountedRef.current) setLoading(false);
      return;
    }
    
    if (isMountedRef.current) setLoading(true);
    await fetchUserRole(userId, { allowRetry: true });
    if (isMountedRef.current) setLoading(false);
  };

  // Update activity timestamp on user interactions
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const signOut = useCallback(async () => {
    isInitializedRef.current = false;
    roleLoadedRef.current = false;
    currentUserIdRef.current = null;
    await supabase.auth.signOut();
    setUserRole(null);
    setUser(null);
    setSession(null);
  }, []);

  // Check for inactivity and sign out if needed
  const checkInactivity = useCallback(async () => {
    if (!session) return;
    
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    if (timeSinceActivity > INACTIVITY_TIMEOUT_MS) {
      console.log('User inactive for too long, signing out...');
      await signOut();
    }
  }, [session, signOut]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMountedRef.current) return;
        
        // Clear any pending timeout since we got a real auth state
        if (timeoutId) clearTimeout(timeoutId);
        
        // Skip token refresh events entirely - no state changes needed
        if (event === 'TOKEN_REFRESHED') {
          // Silently update session without triggering loading states
          setSession(newSession);
          return;
        }
        
        // For already-initialized sessions with same user, just update session
        if (isInitializedRef.current && newSession?.user) {
          if (currentUserIdRef.current === newSession.user.id && roleLoadedRef.current) {
            // Same user, role already loaded - just update session/user quietly
            setSession(newSession);
            setUser(newSession.user);
            // Ensure loading is false
            setLoading(false);
            return;
          }
        }
        
        // Handle sign-out
        if (!newSession) {
          setSession(null);
          setUser(null);
          setUserRole(null);
          roleLoadedRef.current = false;
          currentUserIdRef.current = null;
          if (isMountedRef.current) setLoading(false);
          return;
        }
        
        // Handle new sign-in or user change
        setSession(newSession);
        setUser(newSession.user);
        
        // Only fetch role if it's a different user or role not loaded yet
        if (currentUserIdRef.current !== newSession.user.id || !roleLoadedRef.current) {
          roleLoadedRef.current = false;
          await fetchAndSetRole(newSession.user.id);
        } else {
          setLoading(false);
        }
        
        isInitializedRef.current = true;
      }
    );

    // Initialize auth state with shorter timeout
    const initializeAuth = async () => {
      // Skip if already initialized with a user
      if (isInitializedRef.current && currentUserIdRef.current && roleLoadedRef.current) {
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
          // Check if role already loaded for this user
          if (currentUserIdRef.current === currentSession.user.id && roleLoadedRef.current) {
            setLoading(false);
          } else {
            await fetchAndSetRole(currentSession.user.id);
          }
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
      if (isMountedRef.current && loading) {
        console.warn('Auth initialization timeout - stopping loading spinner');
        setLoading(false);
        isInitializedRef.current = true;
      }
    }, 3000);

    return () => {
      isMountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
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

  // Handle visibility change - just update activity, don't re-auth
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only update activity timestamp - no auth operations
        updateActivity();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updateActivity]);

  const signIn = async (email: string, password: string) => {
    // Reset role tracking for new sign-in
    roleLoadedRef.current = false;
    currentUserIdRef.current = null;
    
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
