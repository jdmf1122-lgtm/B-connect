import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, ROXAS_BARANGAYS } from '../types';
import { supabase } from '../utils/supabaseClient';
import { SEED_USERS } from '../data/seedData';

export interface AuthState {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  currentUser: User;
  users: User[];
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentUserState: React.Dispatch<React.SetStateAction<User>>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

export const DEFAULT_BLANK_USER: User = {
  id: '',
  name: '',
  role: 'RESIDENT',
  agencyType: 'RESIDENT',
  agencyName: '',
  position: '',
  badgeOrIdNumber: '',
  email: ''
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUserState] = useState<User>(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('bconnect_clean_slate_v2')) {
      try {
        localStorage.removeItem('bconnect_roxas_cases_v7');
        localStorage.removeItem('bconnect_roxas_logs_v7');
        localStorage.removeItem('bconnect_roxas_notifs_v7');
        localStorage.removeItem('bconnect_roxas_user_v11');
        localStorage.removeItem('bconnect_roxas_users_v11');
        localStorage.removeItem('bconnect_passcodes_vault');
        localStorage.setItem('bconnect_roxas_auth_status_v11', 'false');
        localStorage.setItem('bconnect_clean_slate_v2', 'true');
      } catch (e) {}
      return DEFAULT_BLANK_USER;
    }

    const savedUserStr = localStorage.getItem('bconnect_roxas_user_v11');
    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        if (parsed?.id) {
          if (!parsed.avatarUrl) {
            if (parsed.agencyType === 'MDRRMO') parsed.avatarUrl = '/mdrrmo_logo.png';
            else if (parsed.agencyType === 'LGU') parsed.avatarUrl = '/lgu_logo.png';
          }
          return parsed;
        }
      } catch (e) { }
    }
    return SEED_USERS[0] || DEFAULT_BLANK_USER;
  });
  const [users, setUsers] = useState<User[]>(() => {
    const userMap = new Map<string, User>();
    SEED_USERS.forEach((u) => userMap.set(u.email.toLowerCase(), u));

    const savedUsersStr = localStorage.getItem('bconnect_roxas_users_v11');
    if (savedUsersStr) {
      try {
        const parsed = JSON.parse(savedUsersStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((u: User) => {
            if (u?.email) {
              const emailKey = u.email.toLowerCase();
              userMap.set(emailKey, {
                ...(userMap.get(emailKey) || {}),
                ...u,
                avatarUrl: u.avatarUrl || (u.agencyType === 'MDRRMO' ? '/mdrrmo_logo.png' : u.agencyType === 'LGU' ? '/lgu_logo.png' : undefined)
              });
            }
          });
        }
      } catch (e) { }
    }

    // Initialize default passcodes in vault for fixed accounts
    try {
      const vault = JSON.parse(localStorage.getItem('bconnect_passcodes_vault') || '{}');
      let changed = false;
      if (!vault['mdrrmoroxas@gmail.com']) {
        vault['mdrrmoroxas@gmail.com'] = 'mdrrmo2026';
        vault['mdrrmoroxas'] = 'mdrrmo2026';
        changed = true;
      }
      if (!vault['lguroxas@gmail.com']) {
        vault['lguroxas@gmail.com'] = 'lguroxas2026';
        vault['lguroxas'] = 'lguroxas2026';
        changed = true;
      }
      if (changed) {
        localStorage.setItem('bconnect_passcodes_vault', JSON.stringify(vault));
      }
    } catch (e) {}

    return Array.from(userMap.values());
  });

  useEffect(() => {
    const resolveOrProvisionSessionUser = async (authUser: any): Promise<User | null> => {
      if (!authUser) return null;

      let { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!profile && authUser.email) {
        const { data: emailProfile } = await supabase
          .from('users')
          .select('*')
          .ilike('email', authUser.email)
          .maybeSingle();
        profile = emailProfile;
      }

      // Auto-provision Resident profile if user signed in via real Google OAuth for the first time
      if (!profile && authUser.email) {
        const meta = authUser.user_metadata || {};
        const rawPending = meta.barangay || localStorage.getItem('bconnect_pending_google_barangay') || 'Bagumbayan';
        const pendingBrgy = ROXAS_BARANGAYS.find((b) => b.toLowerCase() === String(rawPending).trim().toLowerCase()) || 'Bagumbayan';
        const displayName =
          meta.full_name ||
          meta.name ||
          authUser.email.split('@')[0].replace(/[._-]/g, ' ');
        const autoProfile: User = {
          id: authUser.id,
          name: displayName,
          role: 'RESIDENT',
          agencyType: 'RESIDENT',
          agencyName: `Barangay ${pendingBrgy} Resident Citizen`,
          barangay: pendingBrgy,
          position: 'Verified Resident Citizen',
          badgeOrIdNumber: `RES-${pendingBrgy.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
          email: authUser.email,
          avatarUrl: meta.avatar_url || meta.picture || '/bconnect_logo_transparent.png'
        };
        const { avatarUrl: _a, ...dbRow } = autoProfile as any;
        await supabase.from('users').upsert(dbRow, { onConflict: 'id' });
        profile = autoProfile;

        setUsers((prev) => {
          const filtered = (prev || []).filter((u) => u.id !== autoProfile.id && u.email !== autoProfile.email);
          const updated = [...filtered, autoProfile];
          localStorage.setItem('bconnect_roxas_users_v11', JSON.stringify(updated));
          return updated;
        });

        try {
          localStorage.removeItem('bconnect_pending_google_barangay');
        } catch {}
      }

      if (profile) {
        const profileUser = profile as User;
        const meta = authUser.user_metadata || {};
        if (!profileUser.avatarUrl) {
          if (profileUser.agencyType === 'MDRRMO') profileUser.avatarUrl = '/mdrrmo_logo.png';
          else if (profileUser.agencyType === 'LGU') profileUser.avatarUrl = '/lgu_logo.png';
          else profileUser.avatarUrl = meta.avatar_url || meta.picture || '/bconnect_logo_transparent.png';
        }
        if (!profileUser.barangay && profileUser.role === 'RESIDENT') {
          const rawPending = meta.barangay || localStorage.getItem('bconnect_pending_google_barangay') || 'Bagumbayan';
          profileUser.barangay = ROXAS_BARANGAYS.find((b) => b.toLowerCase() === String(rawPending).trim().toLowerCase()) || 'Bagumbayan';
        }
        return profileUser;
      }
      return null;
    };

    const checkSession = async () => {
      setIsAuthLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const profileUser = await resolveOrProvisionSessionUser(session.user);
          if (profileUser) {
            setCurrentUserState(profileUser);
            setIsAuthenticated(true);
            localStorage.setItem('bconnect_roxas_user_v11', JSON.stringify(profileUser));
            localStorage.setItem('bconnect_roxas_auth_status_v11', 'true');
          }
        } else {
          const savedAuth = localStorage.getItem('bconnect_roxas_auth_status_v11');
          const savedUserStr = localStorage.getItem('bconnect_roxas_user_v11');
          if (savedAuth === 'true' && savedUserStr) {
            try {
              const parsed = JSON.parse(savedUserStr);
              if (parsed?.id) {
                if (!parsed.avatarUrl) {
                  if (parsed.agencyType === 'MDRRMO') parsed.avatarUrl = '/mdrrmo_logo.png';
                  else if (parsed.agencyType === 'LGU') parsed.avatarUrl = '/lgu_logo.png';
                }
                setCurrentUserState(parsed);
                setIsAuthenticated(true);
              }
            } catch (e) { }
          }
        }
      } catch (err) {
        console.warn('Session check error, fallback to local:', err);
      } finally {
        setIsAuthLoading(false);
      }
    };

    const fetchUsers = async () => {
      try {
        let dbUsers: any[] | null = null;
        try {
          const apiRes = await fetch('/api/users');
          if (apiRes.ok) {
            const json = await apiRes.json();
            if (Array.isArray(json.users) && json.users.length > 0) {
              dbUsers = json.users;
            }
          }
        } catch {}

        if (!dbUsers) {
          const { data } = await supabase.from('users').select('*');
          dbUsers = data;
        }

        const userMap = new Map<string, User>();
        // 1. Add SEED_USERS so official government accounts are always present
        SEED_USERS.forEach((u) => userMap.set(u.email.toLowerCase(), u));

        // 2. Add cached users (which may preserve local passcodes)
        const cachedUsersStr = localStorage.getItem('bconnect_roxas_users_v11');
        if (cachedUsersStr) {
          try {
            const cached = JSON.parse(cachedUsersStr);
            if (Array.isArray(cached)) {
              cached.forEach((u: any) => {
                if (u?.email) {
                  const existing = userMap.get(u.email.toLowerCase());
                  userMap.set(u.email.toLowerCase(), { ...existing, ...u });
                }
              });
            }
          } catch (e) {}
        }

        // 3. Add remote dbUsers from Supabase
        if (dbUsers && Array.isArray(dbUsers) && dbUsers.length > 0) {
          dbUsers.forEach((u: any) => {
            if (u?.email) {
              const existing = userMap.get(u.email.toLowerCase());
              userMap.set(u.email.toLowerCase(), { ...existing, ...u });
            }
          });
        }

        const merged = Array.from(userMap.values());
        setUsers(merged);
        localStorage.setItem('bconnect_roxas_users_v11', JSON.stringify(merged));
      } catch (e) {
        console.warn('Fetch users notice:', e);
      }
    };

    checkSession();
    fetchUsers();

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('bconnect_users_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'USER_REGISTERED' && event.data.payload) {
            setUsers((prev) => {
              const filtered = prev.filter((u) => u.id !== event.data.payload.id && u.email !== event.data.payload.email);
              const updated = [...filtered, event.data.payload];
              localStorage.setItem('bconnect_roxas_users_v11', JSON.stringify(updated));
              return updated;
            });
          }
        };
      } catch (e) {}
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profileUser = await resolveOrProvisionSessionUser(session.user);
        if (profileUser) {
          setCurrentUserState(profileUser);
          setIsAuthenticated(true);
          localStorage.setItem('bconnect_roxas_user_v11', JSON.stringify(profileUser));
          localStorage.setItem('bconnect_roxas_auth_status_v11', 'true');
        }
      } else if (event === 'SIGNED_OUT') {
        // Prevent spurious auto-logout on refresh unless explicit logout occurred
        const savedAuth = localStorage.getItem('bconnect_roxas_auth_status_v11');
        if (savedAuth === 'false') {
          setIsAuthenticated(false);
          localStorage.removeItem('bconnect_roxas_user_v11');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isAuthLoading,
      currentUser,
      users,
      setIsAuthenticated,
      setCurrentUserState,
      setUsers
    }}>
      {children}
    </AuthContext.Provider>
  );
};
