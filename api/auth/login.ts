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

// shortcut: use anon key for public.users read when service key is absent, upgrade to service role for auth.admin sync
const supabaseClient = SUPABASE_URL && effectiveKey
  ? createClient(SUPABASE_URL, effectiveKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

const FIXED_USERS = [
  {
    id: 'USR-MDRRMO-ROXAS-FIXED',
    name: 'MDRRMO Roxas Operations & Command Center',
    role: 'MDRRMO_ADMIN',
    agencyType: 'MDRRMO',
    agencyName: 'MDRRMO Roxas Emergency Operations Center',
    position: 'MDRRMO Operations Head / Municipal Disaster Risk Officer',
    badgeOrIdNumber: 'MDRRMO-ROXAS-01',
    email: 'mdrrmoroxas@gmail.com',
    passcode: 'mdrrmo2026',
    avatarUrl: '/mdrrmo_logo.png'
  },
  {
    id: 'USR-LGU-ROXAS-FIXED',
    name: 'Municipal Government of Roxas (LGU Admin)',
    role: 'LGU_ADMINISTRATOR',
    agencyType: 'LGU',
    agencyName: 'Municipal Government of Roxas (LGU Admin)',
    position: 'Municipal Administrator / Executive Desk',
    badgeOrIdNumber: 'LGU-ROXAS-ADMIN',
    email: 'lguroxas@gmail.com',
    passcode: 'lguroxas2026',
    avatarUrl: '/lgu_logo.png'
  }
];

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const cleanId = String(body?.identifier || '').trim();
  const cleanPasscode = String(body?.passcode || '').trim();

  if (!cleanId) {
    return res.status(400).json({ success: false, message: 'Please provide an email, Badge ID, or name.' });
  }

  try {
    let matchedUser: any = null;
    const q = cleanId.toLowerCase();

    if (supabaseClient) {
      try {
        const { data: dbUsers, error: dbErr } = await supabaseClient.from('users').select('*');
        if (!dbErr && dbUsers && Array.isArray(dbUsers)) {
          matchedUser = dbUsers.find(
            (u) =>
              u.email?.toLowerCase() === q ||
              u.badgeOrIdNumber?.toLowerCase() === q ||
              u.id?.toLowerCase() === q ||
              u.legacy_id?.toLowerCase() === q ||
              u.name?.toLowerCase() === q ||
              (q.length >= 3 && u.name?.toLowerCase().includes(q))
          );
        }
      } catch (dbErr) {
        console.warn('Database user search notice:', dbErr);
      }

      // If not found in public.users, check auth.users directly ONLY when service role key is strictly verified
      if (!matchedUser && hasServiceRole) {
        try {
          const { data: authList, error: authErr } = await supabaseClient.auth.admin.listUsers();
          if (!authErr && authList?.users) {
            const foundAuth = authList.users.find(
              (au: any) =>
                au.email?.toLowerCase() === q ||
                au.user_metadata?.name?.toLowerCase() === q ||
                (q.length >= 3 && au.user_metadata?.name?.toLowerCase().includes(q))
            );
            if (foundAuth && foundAuth.email) {
              const m = foundAuth.user_metadata || {};
              const syncedRow = {
                id: foundAuth.id,
                email: foundAuth.email,
                name: m.name || m.full_name || foundAuth.email.split('@')[0],
                role: m.role || 'RESIDENT',
                agencyType: m.agencyType || 'RESIDENT',
                agencyName: m.agencyName || `Barangay ${m.barangay || 'Bagumbayan'} Resident Citizen`,
                barangay: m.barangay || 'Bagumbayan',
                position: m.position || 'Verified Resident Citizen',
                badgeOrIdNumber: m.badgeOrIdNumber || 'RES-ROX-2026',
                avatarUrl: m.avatarUrl || m.avatar_url || '/bconnect_logo_transparent.png'
              };
              await supabaseClient.from('users').upsert(syncedRow, { onConflict: 'id' });
              matchedUser = syncedRow;
            }
          }
        } catch (authErr) {
          console.warn('Auth admin listUsers bypassed:', authErr);
        }
      }
    }

    if (!matchedUser) {
      matchedUser = FIXED_USERS.find(
        (u) =>
          u.email.toLowerCase() === q ||
          u.badgeOrIdNumber.toLowerCase() === q ||
          u.id.toLowerCase() === q ||
          u.name.toLowerCase() === q ||
          (q.length >= 3 && u.name.toLowerCase().includes(q))
      );
    }

    if (!matchedUser) {
      return res.status(404).json({
        success: false,
        message: 'Account not found. Please verify your Email or Name, or register a new account.'
      });
    }

    return res.status(200).json({
      success: true,
      user: matchedUser,
      message: `Login successful for ${matchedUser.name}.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
}
