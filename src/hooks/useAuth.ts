import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error getting session:', error);
        setUser(null);
        // Clear any stale auth data and reload
        window.localStorage.removeItem('sb-xvdltodlekapbklymsvz-auth-token');
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        // Clear all auth data and redirect to home
        setUser(null);
        window.localStorage.removeItem('sb-xvdltodlekapbklymsvz-auth-token');
        window.location.href = '/';
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
      } else if (event === 'INITIAL_SESSION') {
        // Handle initial session
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // First clear the local state
      setUser(null);
      
      // Then clear local storage
      window.localStorage.removeItem('sb-xvdltodlekapbklymsvz-auth-token');
      
      // Call the signOut method
      await supabase.auth.signOut();
      
      // Redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if the API call fails, force a redirect to home
      window.location.href = '/';
    }
  };

  return {
    user,
    loading,
    signOut,
  };
}