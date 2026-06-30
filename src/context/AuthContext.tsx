import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile, resetUsageIfNeeded, PlanId } from '../lib/plans';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Keep a ref so refreshProfile is always stable and never stale
  const userRef = useRef<User | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const normalizeProfile = useCallback((raw: UserProfile): UserProfile => {
    const currentPlan = raw.role === 'admin'
      ? 'admin_unlimited'
      : ((raw.current_plan ?? 'free_trial') as PlanId);

    return {
      ...raw,
      role: raw.role ?? 'user',
      current_plan: currentPlan,
      billing_cycle: raw.billing_cycle ?? 'monthly',
      subscription_status: raw.subscription_status ?? (currentPlan === 'free_trial' ? 'trialing' : 'active'),
      is_active: raw.is_active ?? true,
      must_change_password: raw.must_change_password ?? false,
      leads_used_this_month: raw.leads_used_this_month ?? 0,
      audits_used_this_month: raw.audits_used_this_month ?? 0,
      messages_used_this_month: raw.messages_used_this_month ?? 0,
      trial_started_at: raw.trial_started_at ?? new Date().toISOString(),
      trial_ends_at: raw.trial_ends_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      usage_cycle_started_at: raw.usage_cycle_started_at ?? new Date().toISOString(),
      created_at: raw.created_at ?? new Date().toISOString(),
      updated_at: raw.updated_at ?? new Date().toISOString(),
    };
  }, []);

  const createDefaultProfile = useCallback(async (authUser: User): Promise<UserProfile> => {
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const defaultProfile = {
      id: authUser.id,
      email: authUser.email ?? '',
      full_name: (authUser.user_metadata?.full_name as string | undefined) ?? '',
      role: 'user' as const,
      current_plan: 'free_trial' as const,
      billing_cycle: 'monthly' as const,
      subscription_status: 'trialing',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      leads_used_this_month: 0,
      audits_used_this_month: 0,
      messages_used_this_month: 0,
      usage_cycle_started_at: now.toISOString(),
      is_active: true,
      must_change_password: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { data, error } = await withTimeout(
      supabase
        .from('user_profiles')
        .upsert(defaultProfile, { onConflict: 'id', ignoreDuplicates: true })
        .select('*')
        .maybeSingle(),
      7000,
      'Profile creation timed out.'
    );

    if (error) throw error;
    return normalizeProfile((data ?? defaultProfile) as UserProfile);
  }, [normalizeProfile]);

  const loadProfile = useCallback(async (authUser: User) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle(),
        7000,
        'Profile loading timed out.'
      );

      if (error) throw error;

      const loadedProfile = data
        ? normalizeProfile(data as UserProfile)
        : await createDefaultProfile(authUser);

      const updated = await resetUsageIfNeeded(loadedProfile);
      setProfile(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load your profile.';
      setProfile(null);
      setProfileError(message);
    } finally {
      setProfileLoading(false);
    }
  }, [createDefaultProfile, normalizeProfile]);

  const refreshProfile = useCallback(async () => {
    if (userRef.current) await loadProfile(userRef.current);
  }, [loadProfile]); // stable — never stale because it reads from ref

  useEffect(() => {
    // Failsafe: if profile load takes too long, unblock the spinner anyway
    const failsafe = setTimeout(() => setLoading(false), 8000);

    // getSession handles token refresh reliably — use it for the initial state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user).finally(() => {
          clearTimeout(failsafe);
          setLoading(false);
        });
      } else {
        clearTimeout(failsafe);
        setLoading(false);
      }
    }).catch(() => {
      clearTimeout(failsafe);
      setLoading(false);
    });

    // onAuthStateChange handles all subsequent events (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return; // already handled by getSession above
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user);
      } else {
        setProfile(null);
        setProfileError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Check if user is active
    if (data.user) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('is_active')
        .eq('id', data.user.id)
        .maybeSingle();

      if (prof && !(prof as { is_active: boolean }).is_active) {
        await supabase.auth.signOut();
        return { error: 'Your account is inactive. Please contact support.' };
      }
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName?: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName ?? '' } },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setProfileError(null);
      setLoading(false);
      setProfileLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, profileLoading, profileError, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
