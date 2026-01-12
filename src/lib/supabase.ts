// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
}

// #region agent log
fetch('http://10.0.0.207:7243/ingest/e915d2c6-5cbb-488d-ad0b-a0a2cff148e2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'debug-session',
    runId: 'run4',
    hypothesisId: 'CFG',
    location: 'src/lib/supabase.ts:init',
    message: 'supabase client init',
    data: { supabaseUrl, anonKeyPresent: Boolean(supabaseAnonKey) },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'freeorbarter-app'
    }
  }
});