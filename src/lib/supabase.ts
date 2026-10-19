import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseUrl = (typeof envUrl === 'string' && envUrl.trim().length > 0)
  ? envUrl.trim()
  : 'https://placeholder.supabase.co';

export const supabaseAnonKey = (typeof envKey === 'string' && envKey.trim().length > 0)
  ? envKey.trim()
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';

export const isSupabaseConfigured = Boolean(
  typeof envUrl === 'string' &&
  typeof envKey === 'string' &&
  envUrl.trim().length > 0 &&
  envKey.trim().length > 0 &&
  !envUrl.includes('placeholder.supabase.co')
);

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
