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

// shortcut: fallback to direct public.users upsert when service role key is absent, upgrade to auth.admin provisioning with live service key
const supabaseClient = SUPABASE_URL && effectiveKey
  ? createClient(SUPABASE_URL, effectiveKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

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

  const newUserData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!newUserData || !newUserData.name) {
    return res.status(400).json({ success: false, message: 'Missing user registration details.' });
  }

  try {
    let authId: string | undefined;
    const cleanEmail = (
      newUserData.email?.trim() ||
      `${newUserData.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@resident.roxas.ph`
    ).toLowerCase();
    const rawPass = (newUserData.passcode || 'BConnect2026!').trim();
    const cleanPassword = rawPass.length >= 6 ? rawPass : `${rawPass}2026`;

    if (supabaseClient) {
      try {
        // 1. Check if already in public.users by email
        const { data: existingPub } = await supabaseClient
          .from('users')
          .select('id')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (existingPub?.id) {
          authId = existingPub.id;
        }
      } catch (err) {
        console.warn('Check public.users notice in register:', err);
      }

      // 2. Only invoke auth.admin APIs if service role key is strictly verified
      if (hasServiceRole) {
        try {
          if (authId) {
            await supabaseClient.auth.admin.updateUserById(authId, {
              password: cleanPassword,
              email_confirm: true
            }).catch(() => {});
          } else {
            const { data: authData, error: authErr } = await supabaseClient.auth.admin.createUser({
              email: cleanEmail,
              password: cleanPassword,
              email_confirm: true,
              user_metadata: {
                name: newUserData.name,
                role: newUserData.role || 'RESIDENT',
                agencyType: newUserData.agencyType || 'RESIDENT',
                agencyName: newUserData.agencyName || `Barangay ${newUserData.barangay || 'Bagumbayan'} Resident Citizen`,
                barangay: newUserData.barangay,
                position: newUserData.position || 'Verified Resident Citizen',
                badgeOrIdNumber: newUserData.badgeOrIdNumber
              }
            });

            if (authData?.user?.id) {
              authId = authData.user.id;
            } else if (authErr) {
              const { data: list } = await supabaseClient.auth.admin.listUsers();
              const existingAuth = list?.users?.find(
                (u: any) => (u.email || '').toLowerCase() === cleanEmail
              );
              if (existingAuth?.id) {
                authId = existingAuth.id;
                await supabaseClient.auth.admin.updateUserById(existingAuth.id, {
                  password: cleanPassword,
                  email_confirm: true
                }).catch(() => {});
              }
            }
          }
        } catch (authAdminErr) {
          console.warn('Auth admin registration bypassed or notice:', authAdminErr);
        }
      }
    }

    const userId = authId || newUserData.id || `USR-${(newUserData.agencyType || 'RES').slice(0, 3)}-${Date.now().toString().slice(-4)}`;
    const dbRow = {
      id: userId,
      name: newUserData.name,
      role: newUserData.role || 'RESIDENT',
      agencyType: newUserData.agencyType || 'RESIDENT',
      agencyName: newUserData.agencyName || `Barangay ${newUserData.barangay || 'Bagumbayan'} Resident Citizen`,
      barangay: newUserData.barangay || null,
      position: newUserData.position || 'Verified Resident Citizen',
      badgeOrIdNumber: newUserData.badgeOrIdNumber || null,
      email: cleanEmail,
      phone: newUserData.phone || null,
      address: newUserData.address || null,
      avatarUrl: newUserData.avatarUrl || '/bconnect_logo_transparent.png'
    };

    if (supabaseClient) {
      try {
        const { error: dbErr } = await supabaseClient
          .from('users')
          .upsert(dbRow, { onConflict: 'id' });
        if (dbErr) {
          console.warn('Supabase profile upsert notice:', dbErr.message);
        }
      } catch (upsertErr) {
        console.warn('Supabase profile upsert caught:', upsertErr);
      }
    }

    return res.status(200).json({
      success: true,
      user: { ...dbRow, passcode: rawPass }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Registration failed' });
  }
}
