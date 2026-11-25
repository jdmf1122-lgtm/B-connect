import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Case, AuditLog, ROXAS_BARANGAYS } from '../types';
import { supabase } from '../utils/supabaseClient';
import { SEED_CASES, SEED_AUDIT_LOGS } from '../data/seedData';

export const sanitizeCaseBarangay = (rawCase: any): Case => {
  let b = rawCase.barangay;
  if (!ROXAS_BARANGAYS.includes(b as any)) {
    const match = ROXAS_BARANGAYS.find((brgy) => brgy.toLowerCase() === (b || '').trim().toLowerCase());
    b = match || 'San Aquilino';
  }

  let derivedTime = rawCase.incidentTime;
  if (!derivedTime && rawCase.dateReported) {
    try {
      const d = new Date(rawCase.dateReported);
      if (!isNaN(d.getTime())) {
        derivedTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {}
  }

  const parseArray = (val: any) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  };

  return {
    ...rawCase,
    emergencyAlarmAcknowledged: Boolean(rawCase.emergencyAlarmAcknowledged),
    emergencyFirstRespondersDispatched: Boolean(rawCase.emergencyFirstRespondersDispatched),
    isCitizenReport: rawCase.isCitizenReport !== undefined ? Boolean(rawCase.isCitizenReport) : true,
    isEscalatedToLgu: Boolean(rawCase.isEscalatedToLgu),
    escalationSmsDelivered: Boolean(rawCase.escalationSmsDelivered),
    barangay: b,
    incidentTime: derivedTime,
    timeline: parseArray(rawCase.timeline),
    imageUrls: parseArray(rawCase.imageUrls),
    complainants: parseArray(rawCase.complainants),
    respondents: parseArray(rawCase.respondents),
    witnesses: parseArray(rawCase.witnesses),
    vehiclesInvolved: parseArray(rawCase.vehiclesInvolved),
    personsInvolved: parseArray(rawCase.personsInvolved).map((p: any) => ({
      ...p,
      barangay: ROXAS_BARANGAYS.includes(p.barangay as any) ? p.barangay : b
    })),
    statusHistory: parseArray(rawCase.statusHistory)
  };
};

export interface CaseState {
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  auditLogs: AuditLog[];
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditLog[]>>;
  selectedCaseId: string | null;
  setSelectedCaseId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const CaseContext = createContext<CaseState | undefined>(undefined);

export const CaseProvider: React.FC<{ children: ReactNode; isAuthenticated: boolean }> = ({ children, isAuthenticated }) => {
  const [cases, setCases] = useState<Case[]>(() => {
    try {
      const cached = localStorage.getItem('bconnect_cases_cache_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => sanitizeCaseBarangay(c));
        }
      }
    } catch (e) {}
    return SEED_CASES;
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(SEED_AUDIT_LOGS);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('bconnect_cases_cache_v2', JSON.stringify(cases));
    } catch (e) {}
  }, [cases]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let fetchedCases: any[] | null = null;
        try {
          const resp = await fetch('/api/cases');
          if (resp.ok) {
            const json = await resp.json();
            if (Array.isArray(json.cases)) {
              fetchedCases = json.cases;
            }
          }
        } catch (e) {}

        const [casesRes, logsRes] = await Promise.all([
          !fetchedCases
            ? supabase.from('cases').select('*').order('dateCreated', { ascending: false })
            : Promise.resolve({ data: fetchedCases }),
          supabase.from('audit_logs').select('*').order('timestamp', { ascending: false })
        ]);

        if (!fetchedCases && casesRes.data && Array.isArray(casesRes.data)) {
          fetchedCases = casesRes.data;
        }

        if (fetchedCases && Array.isArray(fetchedCases)) {
          const remoteCases = fetchedCases.map((c: any) => sanitizeCaseBarangay(c));
          const remoteIds = new Set(remoteCases.map((c) => c.id));

          setCases((prev) => {
            if (remoteCases.length === 0 && prev.length > 0) return prev;
            const mergedMap = new Map<string, Case>();
            const prevMap = new Map<string, Case>();
            (prev || []).forEach((c) => {
              if (c?.id) prevMap.set(c.id, c);
            });

            // 1. Add all remote cases, protecting local optimistic edits that are newer
            remoteCases.forEach((remoteCase) => {
              const localCase = prevMap.get(remoteCase.id);
              if (localCase) {
                const localTime = new Date(localCase.dateLastUpdated || localCase.dateCreated || 0).getTime();
                const remoteTime = new Date(remoteCase.dateLastUpdated || remoteCase.dateCreated || 0).getTime();
                if (localTime > remoteTime) {
                  mergedMap.set(remoteCase.id, { ...remoteCase, ...localCase });
                  return;
                }
              }
              mergedMap.set(remoteCase.id, remoteCase);
            });

            // 2. Retain local cases pending remote persistence (created within last 60s or if offline)
            const now = Date.now();
            (prev || []).forEach((localCase) => {
              if (localCase?.id && !remoteIds.has(localCase.id)) {
                const createdTime = new Date(localCase.dateCreated || localCase.dateReported || 0).getTime();
                if (now - createdTime < 60000 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
                  mergedMap.set(localCase.id, localCase);
                }
              }
            });

            return Array.from(mergedMap.values()).sort((a, b) =>
              new Date(b.dateCreated || b.dateReported || 0).getTime() -
              new Date(a.dateCreated || a.dateReported || 0).getTime()
            );
          });
        }
        if (logsRes.data && Array.isArray(logsRes.data) && logsRes.data.length > 0) {
          setAuditLogs(logsRes.data as AuditLog[]);
        }
      } catch (err) {
        console.error('Error fetching cases/logs from Supabase:', err);
      }
    };

    fetchData();

    // 1. Cross-tab BroadcastChannel for 0ms same-machine sync
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('bconnect_cases_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'NEW_CASE' && event.data.payload) {
            const incoming = sanitizeCaseBarangay(event.data.payload);
            setCases((prev) => {
              if (prev.some((c) => c.id === incoming.id)) return prev;
              return [incoming, ...prev];
            });
          } else if (event.data?.type === 'UPDATE_CASE' && event.data.payload) {
            const updated = sanitizeCaseBarangay(event.data.payload);
            setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          } else if (event.data?.type === 'DELETE_CASE' && event.data.payload?.id) {
            setCases((prev) => prev.filter((c) => c.id !== event.data.payload.id));
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel notice:', e);
      }
    }

    // 2. Supabase Realtime channel for cross-network and cross-device sync
    const realtimeChannel = supabase
      .channel('cases_realtime_sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cases' }, (payload) => {
        if (payload.new) {
          const incoming = sanitizeCaseBarangay(payload.new);
          setCases((prev) => {
            if (prev.some((c) => c.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cases' }, (payload) => {
        if (payload.new) {
          const updated = sanitizeCaseBarangay(payload.new);
          setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'cases' }, (payload) => {
        if (payload.old?.id) {
          setCases((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      })
      .on('broadcast', { event: 'case_event' }, ({ payload }) => {
        if (payload?.type === 'NEW_CASE' && payload.data) {
          const incoming = sanitizeCaseBarangay(payload.data);
          setCases((prev) => {
            if (prev.some((c) => c.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
        } else if (payload?.type === 'UPDATE_CASE' && payload.data) {
          const updated = sanitizeCaseBarangay(payload.data);
          setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        } else if (payload?.type === 'DELETE_CASE' && (payload.data?.id || payload.data)) {
          const delId = payload.data?.id || payload.data;
          setCases((prev) => prev.filter((c) => c.id !== delId));
        }
      })
      .subscribe();


    // 3. Periodic fallback poll every 4 seconds
    const intervalTimer = setInterval(() => {
      fetchData();
    }, 4000);

    return () => {
      if (bc) bc.close();
      supabase.removeChannel(realtimeChannel);
      clearInterval(intervalTimer);
    };
  }, [isAuthenticated]);

  return (
    <CaseContext.Provider value={{
      cases,
      setCases,
      auditLogs,
      setAuditLogs,
      selectedCaseId,
      setSelectedCaseId
    }}>
      {children}
    </CaseContext.Provider>
  );
};
