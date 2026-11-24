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
  'isConfidential'
]);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ success: false, message: 'Supabase admin client not configured' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('cases')
        .select('*')
        .order('dateCreated', { ascending: false });
      if (error) return res.status(500).json({ success: false, message: error.message });
      return res.status(200).json({ success: true, cases: data || [] });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const caseData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!caseData || !caseData.id) {
        return res.status(400).json({ success: false, message: 'Missing case id' });
      }

      const dbPayload: Record<string, any> = {};
      for (const key of Object.keys(caseData)) {
        if (SUPABASE_CASE_COLUMNS.has(key) && caseData[key] !== undefined) {
          dbPayload[key] = caseData[key];
        }
      }

      if (req.method === 'POST' && !caseData._isUpdate) {
        // Check if this ID already exists to avoid overwriting an older case
        const { data: existing } = await supabaseAdmin
          .from('cases')
          .select('id, title, dateCreated')
          .eq('id', dbPayload.id)
          .maybeSingle();

        if (existing && existing.title !== dbPayload.title) {
          const year = new Date().getFullYear();
          const { data: allIds } = await supabaseAdmin.from('cases').select('id');
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

      const { data, error } = await supabaseAdmin
        .from('cases')
        .upsert(dbPayload, { onConflict: 'id' })
        .select();

      if (error) return res.status(500).json({ success: false, message: error.message });
      return res.status(200).json({ success: true, case: data?.[0] || dbPayload });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id || (typeof req.body === 'object' ? req.body?.id : undefined);
      if (!id) return res.status(400).json({ success: false, message: 'Missing case id' });
      const { error } = await supabaseAdmin.from('cases').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, message: error.message });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
}
