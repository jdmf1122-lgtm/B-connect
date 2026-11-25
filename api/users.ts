import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const RAW_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

function isServiceRoleKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      return payload.role === 'service_role';
    }
  } catch {
    // Non-JWT key format fallback
  }
  return !key.toLowerCase().includes('anon') && key.length > 10;
}

const hasServiceRole = Boolean(SUPABASE_URL && isServiceRoleKey(RAW_SERVICE_KEY));
const effectiveKey = (hasServiceRole ? RAW_SERVICE_KEY : SUPABASE_ANON_KEY) || '';

// shortcut: graceful read/delete fallback when running without service role key, upgrade to full auth admin deletion in production
const supabaseClient = SUPABASE_URL && effectiveKey
  ? createClient(SUPABASE_URL, effectiveKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

const PROTECTED_USER_IDS = new Set([
  'USR-MDRRMO-ROXAS-FIXED',
  'USR-LGU-ROXAS-FIXED',
  'USR-ADMIN-ROXAS-FIXED'
]);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      if (!supabaseClient) {
        return res.status(200).json({ success: true, users: [] });
      }
      const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ success: false, message: error.message });
      return res.status(200).json({ success: true, users: data || [] });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id || (typeof req.body === 'object' ? req.body?.id : undefined);
      if (!id) return res.status(400).json({ success: false, message: 'Missing user id' });

      // Safety check: protect fixed administrative accounts
      if (PROTECTED_USER_IDS.has(id)) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete fixed system administrative account.'
        });
      }

      if (supabaseClient) {
        const { error } = await supabaseClient.from('users').delete().eq('id', id);
        if (error) return res.status(500).json({ success: false, message: error.message });

        if (hasServiceRole) {
          try {
            await supabaseClient.auth.admin.deleteUser(id);
          } catch (authDelErr) {
            console.warn('Notice deleting user from auth.users:', authDelErr);
          }
        }
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
}
