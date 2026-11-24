import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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

    if (supabaseAdmin) {
      // 1. Check if already in public.users by email
      const { data: existingPub } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingPub?.id) {
        authId = existingPub.id;
        await supabaseAdmin.auth.admin.updateUserById(authId, {
          password: cleanPassword,
          email_confirm: true
        }).catch(() => {});
      } else {
        // 2. Create in auth.users via admin API
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
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
          const { data: list } = await supabaseAdmin.auth.admin.listUsers();
          const existingAuth = list?.users?.find(
            (u: any) => (u.email || '').toLowerCase() === cleanEmail
          );
          if (existingAuth?.id) {
            authId = existingAuth.id;
            await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, {
              password: cleanPassword,
              email_confirm: true
            }).catch(() => {});
          }
        }
      }
    }

    const userId = authId || newUserData.id;
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

    if (supabaseAdmin && authId) {
      const { error: dbErr } = await supabaseAdmin
        .from('users')
        .upsert(dbRow, { onConflict: 'id' });
      if (dbErr) {
        console.warn('Supabase profile upsert notice:', dbErr);
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
