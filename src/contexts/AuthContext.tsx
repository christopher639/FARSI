import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'analyst' | 'viewer';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: AppRole | null;
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
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const isMountedRef = useRef(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        if (isMountedRef.current) setUserRole(null);
        return;
      }

      if (isMountedRef.current) setUserRole(data?.role as AppRole || null);
    } catch (error) {
      console.error('Error fetching user role:', error);
      if (isMountedRef.current) setUserRole(null);
    }
  };

  const fetchAndSetRole = async (userId: string) => {
    if (isMountedRef.current) setLoading(true);
    await fetchUserRole(userId);
    if (isMountedRef.current) setLoading(false);
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMountedRef.current) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchAndSetRole(session.user.id);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (!isMountedRef.current) return;
        
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          await fetchAndSetRole(currentSession.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMountedRef.current) setLoading(false);
      }
    };

    initializeAuth();
    
    // Fallback: ensure loading stops after 10 seconds max
    timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        console.warn('Auth initialization timeout - stopping loading spinner');
        setLoading(false);
      }
    }, 10000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Clear any previous session before attempting new login
    await supabase.auth.signOut();
    
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // If login failed, ensure session is cleared
    if (error) {
      setUser(null);
      setSession(null);
      setUserRole(null);
      setLoading(false);
      return { error };
    }
    
    // If login successful, fetch the user's role
    if (data.user) {
      await fetchAndSetRole(data.user.id);
    } else {
      setLoading(false);
    }
    
    return { error };
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
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
