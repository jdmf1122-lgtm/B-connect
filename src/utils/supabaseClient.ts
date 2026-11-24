import { createClient } from '@supabase/supabase-js';

declare const __BCONNECT_SUPABASE_URL__: string | undefined;
declare const __BCONNECT_SUPABASE_ANON_KEY__: string | undefined;

const resolvedUrl =
  (typeof __BCONNECT_SUPABASE_URL__ !== 'undefined' && __BCONNECT_SUPABASE_URL__) ||
  import.meta.env.VITE_SUPABASE_URL ||
  'https://placeholder-project.supabase.co';

const resolvedAnonKey =
  (typeof __BCONNECT_SUPABASE_ANON_KEY__ !== 'undefined' && __BCONNECT_SUPABASE_ANON_KEY__) ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'placeholder-anon-key';

export const supabase = createClient(resolvedUrl, resolvedAnonKey);
