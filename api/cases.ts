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

// shortcut: graceful offline/mock fallback when Supabase is unconfigured, upgrade to live cluster once env vars are provided
const supabaseClient = SUPABASE_URL && effectiveKey
  ? createClient(SUPABASE_URL, effectiveKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      if (!supabaseClient) {
        return res.status(200).json({ success: true, cases: [] });
      }
      const { data, error } = await supabaseClient
        .from('cases')
        .select('*')
        .order('dateCreated', { ascending: false });
      if (error) return res.status(500).json({ success: false, message: error.message });
      return res.status(200).json({ success: true, cases: data || [] });
    }

    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
      const caseData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const id = req.query?.id || caseData?.id;
      if (!id) {
        return res.status(400).json({ success: false, message: 'Missing case id' });
      }

      const dbPayload: Record<string, any> = { id };
      for (const key of Object.keys(caseData)) {
        if (SUPABASE_CASE_COLUMNS.has(key) && caseData[key] !== undefined) {
          dbPayload[key] = caseData[key];
        }
      }

      if (!supabaseClient) {
        return res.status(200).json({
          success: true,
          case: dbPayload,
          warning: 'Database client not configured; executed in offline/mock mode.'
        });
      }

      if (req.method === 'POST' && !caseData._isUpdate) {
        // Check if this ID already exists to avoid overwriting an older case
        const { data: existing } = await supabaseClient
          .from('cases')
          .select('id, title, dateCreated')
          .eq('id', dbPayload.id)
          .maybeSingle();

        if (existing && existing.title !== dbPayload.title) {
          const year = new Date().getFullYear();
          const { data: allIds } = await supabaseClient.from('cases').select('id');
          let maxNum = 0;
          (allIds || []).forEach((row: any) => {
            const m = row.id?.match(/BC-(\d{4})-(\d+)/);
            if (m && parseInt(m[1], 10) === year) {
              const n = parseInt(m[2], 10);
              if (n > maxNum) maxNum = n;
            }
          });
          const nextNum = maxNum + 1;
          dbPayload.id = `BC-${year}-${String(nextNum).padStart(3, '0')}`;
          dbPayload.incidentId = `INC-${year}-${String(nextNum).padStart(3, '0')}`;
          dbPayload.complaintId = `CMP-${year}-${String(nextNum).padStart(3, '0')}`;
        }
      }

      const queryResult = (req.method === 'PATCH' || caseData._isUpdate)
        ? await supabaseClient.from('cases').update(dbPayload).eq('id', id).select()
        : await supabaseClient.from('cases').upsert(dbPayload, { onConflict: 'id' }).select();

      const { data, error } = queryResult;

      if (error) return res.status(500).json({ success: false, message: error.message });
      return res.status(200).json({ success: true, case: data?.[0] || dbPayload });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id || (typeof req.body === 'object' ? req.body?.id : undefined);
      if (!id) return res.status(400).json({ success: false, message: 'Missing case id' });

      if (!supabaseClient) {
        return res.status(200).json({
          success: true,
          warning: 'Database client not configured; deletion acknowledged.'
        });
      }

      const { error } = await supabaseClient.from('cases').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, message: error.message });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
}
