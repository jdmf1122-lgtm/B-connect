import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseKey =
  (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'placeholder-anon-key';

if (!((import.meta as any).env?.VITE_SUPABASE_URL && supabaseKey !== 'placeholder-anon-key')) {
  console.warn(
    '⚠️ [B-CONNECT] VITE_SUPABASE_URL or Supabase key is not defined. Running in offline/demo mode with local seed data.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
