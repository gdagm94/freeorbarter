import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user as User);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user as User);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
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

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = makeRedirectUri({ scheme: 'freeorbarter' });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('OAuth setup error:', error);
        return { error: new Error(`Failed to start Google sign in: ${error.message}`) };
      }

      if (!data.url) {
        return { error: new Error('No OAuth URL received from Supabase') };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      
      if (result.type === 'cancel') {
        return { error: new Error('User cancelled the sign in process') };
      }
      
      if (result.type === 'dismiss') {
        return { error: new Error('Sign in was dismissed') };
      }
      
      if (result.type === 'success' && result.url) {
        try {
          // Extract the URL fragment that contains the access token
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          
          if (!accessToken || !refreshToken) {
            return { error: new Error('No authentication tokens received from Google') };
          }
          
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            console.error('Session setup error:', sessionError);
            return { error: new Error(`Failed to create session: ${sessionError.message}`) };
          }
          
          return { error: null };
        } catch (urlError) {
          console.error('URL parsing error:', urlError);
          return { error: new Error('Failed to process authentication response') };
        }
      }

      return { error: new Error('Unexpected response from OAuth flow') };
    } catch (error) {
      console.error('Google OAuth error:', error);
      if (error instanceof Error) {
        return { error };
      }
      return { error: new Error('An unexpected error occurred during Google sign in') };
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    signInWithGoogle,
  };
}
