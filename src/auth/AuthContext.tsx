import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_STORAGE_KEY = 'zdstudio.demo_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(DEMO_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (mounted) {
            setSession(parsed);
            setLoading(false);
          }
          return;
        } catch (e) {}
      }
      if (mounted) {
        setSession(null);
        setLoading(false);
      }
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        if (!isSupabaseConfigured) {
          const demoUser = {
            id: 'demo-user-123',
            app_metadata: {},
            user_metadata: { full_name: email.split('@')[0] || 'Demo User' },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            email: email,
          } as unknown as User;
          const demoSession = {
            access_token: 'demo-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'demo-refresh',
            user: demoUser,
          } as unknown as Session;
          localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoSession));
          setSession(demoSession);
          return { error: null };
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      async signUp(email, password, fullName) {
        if (!isSupabaseConfigured) {
          const demoUser = {
            id: 'demo-user-' + Date.now(),
            app_metadata: {},
            user_metadata: { full_name: fullName },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            email: email,
          } as unknown as User;
          const demoSession = {
            access_token: 'demo-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'demo-refresh',
            user: demoUser,
          } as unknown as Session;
          localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoSession));
          setSession(demoSession);
          return { error: null };
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        return { error: error?.message ?? null };
      },
      async signOut() {
        if (!isSupabaseConfigured) {
          localStorage.removeItem(DEMO_STORAGE_KEY);
          setSession(null);
          return;
        }
        await supabase.auth.signOut();
      },
      async resetPassword(email) {
        if (!isSupabaseConfigured) return { error: null };
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        return { error: error?.message ?? null };
      },
      async updatePassword(newPassword) {
        if (!isSupabaseConfigured) return { error: null };
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return { error: error?.message ?? null };
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
