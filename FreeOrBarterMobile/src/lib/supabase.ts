import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Try multiple ways to get environment variables
const supabaseUrl = 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  Constants.expoConfig?.extra?.supabaseUrl ||
  'https://xvdltodlekapbklymsvz.supabase.co';

const supabaseAnonKey = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGx0b2RsZWthcGJrbHltc3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyOTM1NjgsImV4cCI6MjA1NDg2OTU2OH0.XBHXWOUx_B5SAFagTYDk-2F1M8THGagtNOaazqkQ95k';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
<<<<<<< Current (Your changes)
      'X-Client-Info': 'freeorbarter-mobile-app'
    }
  }
=======
      'X-Client-Info': 'freeorbarter-mobile-app',
    },
  },
>>>>>>> Incoming (Background Agent changes)
});
