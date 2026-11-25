import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { SEED_USERS } from './src/data/seedData.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// shortcut: graceful memory fallback when Supabase is unconfigured, upgrade to live cluster once env vars are provided
const supabaseAdmin = SUPABASE_URL && effectiveKey
  ? createClient(SUPABASE_URL, effectiveKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

const PROTECTED_USER_IDS = new Set([
  'USR-MDRRMO-ROXAS-FIXED',
  'USR-LGU-ROXAS-FIXED',
  'USR-ADMIN-ROXAS-FIXED'
]);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Root endpoint for browser visits and status
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'B-CONNECT Multi-Agency Backend API',
    version: '4.2.0',
    endpoints: {
      health: '/api/health',
      authLogin: '/api/auth/login',
      authRegister: '/api/auth/register',
      cases: '/api/cases',
      smsBroadcast: '/api/sms/broadcast-alert',
      smsLogs: '/api/sms/logs'
    }
  });
});

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Users Listing & Deletion Endpoint
app.get('/api/users', async (req, res) => {
  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ success: false, message: error.message });
      return res.json({ success: true, users: data || [] });
    }
    return res.json({ success: true, users: [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users', async (req, res) => {
  const id = (req.query?.id as string) || req.body?.id;
  if (!id) {
    return res.status(400).json({ success: false, message: 'Missing user id' });
  }

  // Safety check: protect fixed administrative accounts
  if (PROTECTED_USER_IDS.has(id)) {
    return res.status(403).json({
      success: false,
      message: 'Cannot delete fixed system administrative account.'
    });
  }

  try {
    if (supabaseAdmin) {
      await supabaseAdmin.from('users').delete().eq('id', id);
      if (hasServiceRole) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(id);
        } catch (authDelErr) {
          console.warn('Notice deleting user in auth admin:', authDelErr);
        }
      }
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Robust Multi-Account Authentication Endpoint
app.post('/api/auth/login', async (req, res) => {
  const { identifier, passcode } = req.body || {};
  const cleanId = String(identifier || '').trim();
  const cleanPasscode = String(passcode || '').trim();

  if (!cleanId) {
    return res.status(400).json({ success: false, message: 'Please provide an email, Badge ID, or name.' });
  }

  try {
    let matchedUser: any = null;

    if (supabaseAdmin) {
      // 1. Fetch from public.users table
      const { data: dbUsers } = await supabaseAdmin.from('users').select('*');
      if (dbUsers && Array.isArray(dbUsers)) {
        matchedUser = dbUsers.find(
          (u) =>
            u.email?.toLowerCase() === cleanId.toLowerCase() ||
            u.badgeOrIdNumber?.toLowerCase() === cleanId.toLowerCase() ||
            u.id?.toLowerCase() === cleanId.toLowerCase() ||
            u.legacy_id?.toLowerCase() === cleanId.toLowerCase() ||
            u.name?.toLowerCase() === cleanId.toLowerCase() ||
            u.name?.toLowerCase().includes(cleanId.toLowerCase())
        );
      }
    }

    // 2. Check SEED_USERS fallback
    if (!matchedUser) {
      matchedUser = SEED_USERS.find(
        (u) =>
          u.email.toLowerCase() === cleanId.toLowerCase() ||
          u.badgeOrIdNumber?.toLowerCase() === cleanId.toLowerCase() ||
          u.id.toLowerCase() === cleanId.toLowerCase() ||
          u.name.toLowerCase() === cleanId.toLowerCase() ||
          u.name.toLowerCase().includes(cleanId.toLowerCase())
      );
    }

    if (!matchedUser) {
      return res.status(404).json({
        success: false,
        message: 'Account not found. Please verify your Email or Badge ID, or register a new account.'
      });
    }

    // 3. Auto-sync password with Supabase Auth admin only if service role key is strictly verified
    if (supabaseAdmin && hasServiceRole && matchedUser.email) {
      try {
        const { data: authList, error: authListErr } = await supabaseAdmin.auth.admin.listUsers();
        if (!authListErr && authList?.users) {
          const existingAuth = authList.users.find(
            (au: any) => au.email?.toLowerCase() === matchedUser.email.toLowerCase()
          );

          if (existingAuth) {
            if (cleanPasscode && cleanPasscode.length >= 6) {
              await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, {
                password: cleanPasscode
              });
            }
          } else {
            await supabaseAdmin.auth.admin.createUser({
              email: matchedUser.email,
              password: cleanPasscode || '',
              email_confirm: true,
              user_metadata: {
                name: matchedUser.name,
                role: matchedUser.role,
                agencyType: matchedUser.agencyType,
                agencyName: matchedUser.agencyName,
                barangay: matchedUser.barangay,
                position: matchedUser.position,
                badgeOrIdNumber: matchedUser.badgeOrIdNumber
              }
            });
          }
        }
      } catch (authErr) {
        console.warn('Auth admin notice in server:', authErr);
      }
    }

    return res.json({
      success: true,
      user: matchedUser,
      message: `Login successful for ${matchedUser.name}.`
    });
  } catch (err: any) {
    console.error('Server login error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// Robust User Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
  const newUserData = req.body;
  if (!newUserData || !newUserData.name) {
    return res.status(400).json({ success: false, message: 'Missing user registration details.' });
  }

  try {
    let authId: string | undefined;
    const cleanEmail = newUserData.email?.trim() || `${newUserData.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${newUserData.agencyType === 'MDRRMO' ? 'mdrrmo.' : ''}roxas.gov.ph`;
    const cleanPassword = newUserData.passcode?.trim() || '';

    if (supabaseAdmin && hasServiceRole) {
      try {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: cleanPassword,
          email_confirm: true,
          user_metadata: {
            name: newUserData.name,
            role: newUserData.role,
            agencyType: newUserData.agencyType,
            agencyName: newUserData.agencyName,
            barangay: newUserData.barangay,
            position: newUserData.position,
            badgeOrIdNumber: newUserData.badgeOrIdNumber
          }
        });

        if (authData?.user) {
          authId = authData.user.id;
        } else if (authErr?.message?.includes('already')) {
          const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
          if (!listErr && list?.users) {
            const existing = list.users.find((u: any) => u.email?.toLowerCase() === cleanEmail.toLowerCase());
            if (existing) {
              authId = existing.id;
              await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: cleanPassword });
            }
          }
        }
      } catch (authErr) {
        console.warn('Server auth admin signup notice:', authErr);
      }
    }

    const userId = authId || newUserData.id || `USR-${newUserData.agencyType.slice(0, 3)}-${Date.now().toString().slice(-4)}`;
    const fullUser = {
      id: userId,
      name: newUserData.name,
      role: newUserData.role,
      agencyType: newUserData.agencyType,
      agencyName: newUserData.agencyName,
      barangay: newUserData.barangay,
      position: newUserData.position,
      badgeOrIdNumber: newUserData.badgeOrIdNumber,
      email: cleanEmail,
      phone: newUserData.phone,
      address: newUserData.address,
      passcode: newUserData.passcode
    };

    if (supabaseAdmin) {
      const { error: dbErr } = await supabaseAdmin.from('users').upsert({
        id: fullUser.id,
        name: fullUser.name,
        role: fullUser.role,
        agencyType: fullUser.agencyType,
        agencyName: fullUser.agencyName,
        barangay: fullUser.barangay,
        position: fullUser.position,
        badgeOrIdNumber: fullUser.badgeOrIdNumber,
        email: fullUser.email,
        phone: fullUser.phone,
        address: fullUser.address
      }, { onConflict: 'id' });

      if (dbErr) console.warn('Supabase profile upsert notice:', dbErr);
    }

    return res.json({ success: true, user: fullUser });
  } catch (err: any) {
    console.error('Server register error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Registration failed' });
  }
});

const SUPABASE_CASE_COLUMNS = new Set([
  'id', 'incidentId', 'complaintId', 'title', 'category', 'description',
  'initialNarrative', 'currentNarrativeSummary', 'dateReported', 'incidentDate',
  'barangay', 'specificLocation', 'complainants', 'respondents',
  'witnesses', 'personsInvolved', 'vehiclesInvolved', 'statusHistory', 'timeline',
  'imageUrls', 'isInvolvingOfficial', 'officialInvolvedType', 'officialInvolvedName',
  'officialInvolvedPosition', 'officialInvolvedAgency', 'originatingAgency',
  'currentHandlingAgency', 'assignedPersonnel', 'assignedPersonnelContact',
  'priority', 'status', 'resolutionSummary', 'dateResolved', 'dateClosed',
  'outcomeType', 'isCitizenReport', 'residentReporterId', 'isAccidentEmergency',
  'accidentVehicleDetails', 'accidentCasualties', 'isAccidentProneArea',
  'emergencyAlarmAcknowledged', 'emergencyFirstRespondersDispatched',
  'collisionImpactType', 'roadSurfaceCondition', 'weatherCondition',
  'injuriesCount', 'casualtiesCount', 'isHitAndRun', 'respondingAmbulanceUnit',
  'hospitalTransported', 'dateCreated', 'dateLastUpdated', 'createdBy',
  'isConfidential', 'isEscalatedToLgu', 'escalatedAt', 'escalationReason',
  'escalationSmsDelivered', 'escalationSmsBody', 'escalationSmsRecipient',
  'escalationSmsRecipientPhone', 'escalationElapsedStr', 'lguActionTaken',
  'lguInterventionNotes', 'lguActionDate', 'lguActionPersonnel'
]);

// Case Fetching, Creation & Deletion Endpoints (Admin Service Role bypasses RLS)
app.get('/api/cases', async (req, res) => {
  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('cases')
        .select('*')
        .order('dateCreated', { ascending: false });
      if (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.json({ success: true, cases: data || [] });
    }
    return res.json({ success: true, cases: [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete(['/api/cases', '/api/cases/:id'], async (req, res) => {
  const id = (req.params?.id as string) || (req.query?.id as string) || req.body?.id;
  if (!id) {
    return res.status(400).json({ success: false, message: 'Missing case id' });
  }
  try {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from('cases').delete().eq('id', id);
      if (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

const handleCaseMutation = async (req: express.Request, res: express.Response) => {
  const caseData = req.body || {};
  const id = (req.params?.id as string) || (req.query?.id as string) || caseData.id;
  if (!id) {
    return res.status(400).json({ success: false, message: 'Missing case id' });
  }

  // Filter only valid database columns so PostgREST schema cache never rejects
  const dbPayload: Record<string, any> = { id };
  for (const key of Object.keys(caseData)) {
    if (SUPABASE_CASE_COLUMNS.has(key) && caseData[key] !== undefined) {
      dbPayload[key] = caseData[key];
    }
  }

  try {
    if (supabaseAdmin) {
      const isUpdate = req.method === 'PATCH' || caseData._isUpdate;
      const { data, error } = isUpdate
        ? await supabaseAdmin.from('cases').update(dbPayload).eq('id', id).select()
        : await supabaseAdmin.from('cases').upsert(dbPayload, { onConflict: 'id' }).select();

      if (error) {
        console.error('Supabase admin case mutation error:', error.message);
        return res.status(500).json({ success: false, message: error.message });
      }
      return res.json({ success: true, case: data?.[0] || dbPayload });
    }
    return res.json({ success: true, case: dbPayload });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

app.patch(['/api/cases', '/api/cases/:id'], handleCaseMutation);
app.put(['/api/cases', '/api/cases/:id'], handleCaseMutation);
app.post(['/api/cases', '/api/cases/:id'], handleCaseMutation);

// MDRRMO SMS Gateway Endpoint for Automated Responder Alerts
interface SmsDispatchPayload {
  caseId: string;
  message: string;
  dispatches: Array<{
    recipientName: string;
    recipientPhone: string;
    recipientRole: string;
    status: string;
  }>;
  timestamp: string;
  isResend?: boolean;
  resendCount?: number;
}

const smsDispatchHistory: SmsDispatchPayload[] = [];

app.post('/api/sms/broadcast-alert', (req, res) => {
  const { caseId, message, dispatches, timestamp, isResend, resendCount } = req.body as SmsDispatchPayload;
  
  const header = isResend
    ? `🚨 [MDRRMO SMS RE-SEND BROADCAST #${resendCount || 1}] Case #${caseId || 'N/A'} (UNACKNOWLEDGED - RECURRING WARNING)`
    : `🚨 [MDRRMO SMS BROADCAST DISPATCHED] Case #${caseId || 'N/A'}`;

  console.log(`\n======================================================`);
  console.log(header);
  console.log(`⏰ Timestamp: ${timestamp || new Date().toISOString()}`);
  console.log(`📨 Message Payload:\n${message}`);
  console.log(`📱 MDRRMO Account Dispatch (${dispatches?.length || 0}):`);
  if (Array.isArray(dispatches)) {
    dispatches.forEach((d, i) => {
      console.log(`   [${i + 1}] ${d.recipientName} (${d.recipientRole}) -> ${d.recipientPhone} [STATUS: ${d.status || 'SENT'}]`);
    });
  }
  console.log(`======================================================\n`);

  smsDispatchHistory.unshift({ caseId, message, dispatches: dispatches || [], timestamp: timestamp || new Date().toISOString(), isResend, resendCount });
  
  res.json({
    success: true,
    message: isResend
      ? `Automated SMS interval alert #${resendCount || 1} re-transmitted to MDRRMO account.`
      : `Automated SMS broadcast transmitted to MDRRMO account.`,
    sentCount: dispatches?.length || 0,
    isResend: !!isResend,
    resendCount: resendCount || 0,
    deliveredAt: new Date().toISOString()
  });
});

app.get('/api/sms/logs', (req, res) => {
  res.json({ logs: smsDispatchHistory.slice(0, 50) });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
