import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (session?.user) {
        setUser({ ...session.user, full_name: (session.user.user_metadata?.full_name ?? "") } as User);
      }
      setLoading(false);
    };

    bootstrap();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          ...session.user,
          full_name: (session.user.user_metadata?.full_name ?? ''),
        } as User);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    supabase.auth.startAutoRefresh?.();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      supabase.auth.stopAutoRefresh?.();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
