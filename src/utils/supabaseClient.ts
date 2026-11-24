import { createClient } from '@supabase/supabase-js';

declare const __BCONNECT_SUPABASE_URL__: string | undefined;
declare const __BCONNECT_SUPABASE_SERVICE_KEY__: string | undefined;
declare const __BCONNECT_SUPABASE_ANON_KEY__: string | undefined;

const resolvedUrl =
  (typeof __BCONNECT_SUPABASE_URL__ !== 'undefined' && __BCONNECT_SUPABASE_URL__) ||
  import.meta.env.VITE_SUPABASE_URL ||
  'https://placeholder-project.supabase.co';

const resolvedServiceOrAnonKey =
  (typeof __BCONNECT_SUPABASE_SERVICE_KEY__ !== 'undefined' && __BCONNECT_SUPABASE_SERVICE_KEY__) ||
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  (typeof __BCONNECT_SUPABASE_ANON_KEY__ !== 'undefined' && __BCONNECT_SUPABASE_ANON_KEY__) ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'placeholder-anon-key';

export const supabase = createClient(resolvedUrl, resolvedServiceOrAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: true
  }
});
