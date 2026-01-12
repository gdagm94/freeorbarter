// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Use only explicit env values; no fallback to placeholder/local
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)');
}

// Debug logs to verify connection on startup
console.log('--- Supabase Config ---');
console.log('Target URL:', supabaseUrl);
console.log('Key Status:', supabaseAnonKey && supabaseAnonKey.length > 0 ? 'Present' : 'Missing');

// #region agent log
fetch('http://10.0.0.207:7243/ingest/e915d2c6-5cbb-488d-ad0b-a0a2cff148e2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'debug-session',
    runId: 'run4',
    hypothesisId: 'CFG',
    location: 'FreeOrBarterMobile/src/lib/supabase.ts:init',
    message: 'supabase client init',
    data: { supabaseUrl, anonKeyPresent: Boolean(supabaseAnonKey) },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: AsyncStorage,
  },
  db: {
    schema: 'public',
  },
  // Realtime configuration for chat/notifications
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'freeorbarter-mobile-app'
    }
  }
});