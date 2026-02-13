import { AuthApiError } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PASSWORD_RESET_REDIRECT } from '../lib/config';
import { User } from '../types';

const isInvalidRefreshTokenError = (error: unknown): error is AuthApiError => {
  return (
    error instanceof AuthApiError &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('invalid refresh token')
  );
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const clearInvalidSession = async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (signOutError) {
        console.warn('Failed to clear stale Supabase session', signOutError);
      } finally {
        if (isMounted) {
          setUser(null);
        }
      }
    };

    const bootstrap = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearInvalidSession();
        } else {
          console.error('Failed to restore auth session', error);
        }
        setLoading(false);
        return;
      }

      if (session?.user) {
        setUser({
          ...session.user,
          full_name: session.user.user_metadata?.full_name ?? '',
        } as User);
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
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

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, username: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...(captchaToken ? { captchaToken } : {}),
        data: {
          username: username.toLowerCase(),
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: PASSWORD_RESET_REDIRECT,
    });
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
