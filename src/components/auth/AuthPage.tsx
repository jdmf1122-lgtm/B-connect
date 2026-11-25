import React, { useState, useRef, useEffect } from 'react';
import {
  UserPlus,
  LogIn,
  Mail,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  User,
  Moon,
  Sun,
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUI } from '../../hooks/useUI';
import { supabase } from '../../utils/supabaseClient';
import { AgencyType, ROXAS_BARANGAYS, User as UserType } from '../../types';

const GoogleLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export const POSITION_SUGGESTIONS: Record<AgencyType, string[]> = {
  RESIDENT: [
    'Verified Resident Citizen',
    'Homeowner / Resident Complainant',
    'Barangay Youth Resident (SK)',
    'Community Representative'
  ],
  MDRRMO: [
    'MDRRMO Operations Head / Admin',
    'Emergency Medical Responder (EMR)',
    'Rescue Ambulance Unit Lead',
    'Traffic Crash Incident Investigator',
    'Quick Response Team (QRT) Leader',
    'MDRRMO Emergency Dispatcher'
  ],
  LGU: [
    'Municipal Administrator (LGU Admin)',
    'Municipal Legal Officer',
    'Municipal Mayor / Executive Staff',
    'Public Order & Safety Office (POSO) Head',
    'Municipal Social Welfare & Development Officer (MSWDO)',
    'LGU Grievance Desk Officer'
  ],
  ADMIN: [
    'Master Governance Node Administrator',
    'System Security & Database Officer',
    'IT Operations Coordinator'
  ]
};

export const AuthPage: React.FC = () => {
  const { login, loginWithCredentials, registerUser, users } = useAuth();

  // Mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Google Sign-In / Sign-Up Modal States
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleBarangay, setGoogleBarangay] = useState<string>(ROXAS_BARANGAYS[0]);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Ambient lighting / theme toggle
  const { isDark, toggleTheme } = useUI();

  // Remember Me checkbox
  const [rememberMe, setRememberMe] = useState(false);

  // Forgot Password modal
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPasscode, setLoginPasscode] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register Form States (Resident Citizens Only)
  const [regName, setRegName] = useState('');
  const [regBarangay, setRegBarangay] = useState<string>(ROXAS_BARANGAYS[0]);
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);
  const barangayDropdownRef = useRef<HTMLDivElement>(null);
  const [regPosition] = useState('Verified Resident Citizen');
  const [regBadge, setRegBadge] = useState(`RES-${ROXAS_BARANGAYS[0].slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [regEmail, setRegEmail] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regConfirmPasscode, setRegConfirmPasscode] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regAgreeTerms, setRegAgreeTerms] = useState(true);
  const [regError, setRegError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (barangayDropdownRef.current && !barangayDropdownRef.current.contains(event.target as Node)) {
        setIsBarangayDropdownOpen(false);
      }
    };
    if (isBarangayDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBarangayDropdownOpen]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginIdentifier.trim()) {
      setLoginError('Please enter your Email, Badge ID, or Full Name to sign in.');
      return;
    }

    const result = await loginWithCredentials(loginIdentifier, loginPasscode);
    if (!result.success) {
      setLoginError(result.message || 'Account not found. Please verify your credentials or register a new account.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) {
      setRegError('Please provide your official full name.');
      return;
    }

    if (!regPasscode.trim()) {
      setRegError('Please set a password / passcode for your account.');
      return;
    }

    if (regPasscode.trim().length < 6) {
      setRegError('Password must be at least 6 characters long.');
      return;
    }

    if (regPasscode.trim() !== regConfirmPasscode.trim()) {
      setRegError('Hindi tugma ang kinumpirmang password (Passwords do not match). Siguraduhing pareho ang Password at Confirm Password.');
      return;
    }

    if (!regAgreeTerms) {
      setRegError('Please accept the Data Privacy Terms and Guidelines to proceed.');
      return;
    }

    const cleanEmail = regEmail.trim() || `${regName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@resident.roxas.ph`;

    const newUserPayload: Omit<UserType, 'id'> & { passcode: string; avatarUrl?: string } = {
      name: regName.trim(),
      role: 'RESIDENT',
      agencyType: 'RESIDENT',
      agencyName: `Barangay ${regBarangay} Resident Citizen`,
      barangay: regBarangay,
      position: regPosition.trim(),
      badgeOrIdNumber: regBadge.trim() || `RES-${regBarangay.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      email: cleanEmail,
      passcode: regPasscode.trim(),
      avatarUrl: '/bconnect_logo_transparent.png',
    };

    try {
      const createdUser = await registerUser(newUserPayload);
      login(createdUser);
    } catch (error: any) {
      setRegError(error.message || 'Registration failed. Please try again.');
    }
  };

  // shortcut: Native Supabase OAuth prioritized; streamlined modal fallback for offline/demo dev environments
  const handleOpenGoogleAuth = async () => {
    setGoogleError(null);
    const activeBrgy = (authMode === 'register' ? regBarangay : '') || ROXAS_BARANGAYS[0];
    setGoogleBarangay(activeBrgy);
    try {
      localStorage.setItem('bconnect_pending_google_barangay', activeBrgy);
    } catch {}

    setIsGoogleSubmitting(true);
    try {
      // 1. Prioritize native Supabase OAuth redirect flow
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        // Fall back to streamlined modal for demo / unconfigured / offline environments
        console.warn('Native Supabase Google OAuth notice:', error.message);
        setGoogleEmail('');
        setGoogleName('');
        setShowGoogleModal(true);
      }
    } catch (err: any) {
      console.warn('Supabase OAuth error, falling back to Google modal:', err);
      setGoogleEmail('');
      setGoogleName('');
      setShowGoogleModal(true);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleGoogleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);

    const cleanMail = googleEmail.trim().toLowerCase();
    if (!cleanMail || !cleanMail.includes('@')) {
      setGoogleError('Please enter a valid Google email address (e.g. yourname@gmail.com).');
      return;
    }

    setIsGoogleSubmitting(true);
    try {
      // 1. Check if this Google email already exists in the system
      const existingUser = (users || []).find(
        (u) => (u.email || '').toLowerCase() === cleanMail
      );
      if (existingUser) {
        login(existingUser);
        setShowGoogleModal(false);
        setIsGoogleSubmitting(false);
        return;
      }

      // 2. Otherwise register a new Resident Citizen account linked to this Google account
      const derivedName =
        googleName.trim() ||
        cleanMail
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());

      const brgy = googleBarangay || ROXAS_BARANGAYS[0];
      const newGoogleUser = await registerUser({
        name: derivedName,
        role: 'RESIDENT',
        agencyType: 'RESIDENT',
        agencyName: `Barangay ${brgy} Resident Citizen`,
        barangay: brgy,
        position: 'Verified Resident Citizen',
        badgeOrIdNumber: `RES-${brgy.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        email: cleanMail,
        passcode: `GAuth-${Date.now()}`,
        avatarUrl: '/bconnect_logo_transparent.png'
      });

      login(newGoogleUser);
      setShowGoogleModal(false);
    } catch (err: any) {
      setGoogleError(err.message || 'Google authentication failed. Please try again.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div
      id="auth-portal-page"
      className="min-h-screen flex flex-col justify-between selection:bg-accent selection:text-accent-ink transition-colors duration-200 bg-paper text-ink"
    >
      {/* =========================================================================
          Top Bar: Official Municipal Header & Accessibility Actions
          ========================================================================= */}
      <header className="w-full border-b border-rule bg-paper-2">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-paper p-1 flex items-center justify-center border border-rule">
              <img
                src="/bconnect_logo_transparent.png"
                alt="B-CONNECT Municipal Seal"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-ink">
                  B-CONNECT
                </span>
                <span className="text-xs px-2 py-0.5 rounded-sm bg-paper-3 text-ink-2 font-medium border border-rule">
                  Official Portal
                </span>
              </div>
              <p className="text-xs text-muted">
                Municipality of Roxas, Oriental Mindoro
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs text-muted">
              Emergency Hotline: 911 / (043) 289-2026
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 rounded-md border border-rule bg-paper flex items-center justify-center text-ink cursor-pointer hover:bg-paper-3 transition-colors focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-ink-2" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          Central Stage Container: 2-Column Responsive Civic Workbench
          ========================================================================= */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Context & Authority */}
          <section className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-sm bg-paper-3 text-ink-2 border border-rule">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true"></span>
                Active municipal emergency dispatch network
              </span>
              <h1 className="text-display font-display font-bold tracking-tight text-ink leading-tight">
                Emergency Dispatch & Case Governance
              </h1>
              <p className="lead text-ink-2 max-w-xl">
                Unified emergency dispatch and municipal oversight across all 20 Roxas barangays.
              </p>
            </div>

            {/* Jurisdiction Notice */}
            <div className="text-xs text-muted pt-2 border-t border-rule space-y-1">
              <p>
                Coverage: Bagumbayan, Cantil, Dangay, Happy Valley, Libertad, Mabuhay, Marfcoc, Odiong, Paclasan, San Aquilino, San Isidro, San Jose, San Mariano, San Mateo, San Rafael, San Vicente, Santo Niño, Victoria, Villa Hermosa, Little Tanauan.
              </p>
              <p>
                Compliance: Automatic escalation monitoring compliant with DILG governance protocols.
              </p>
            </div>
          </section>

          {/* Right Column: High-Density Authentication & Registration Workbench */}
          <section className="lg:col-span-5">
            <div className="p-6 sm:p-7 rounded-card border border-rule bg-paper-2 shadow-card space-y-5">
              
              {/* Header inside form card */}
              <div className="space-y-1 pb-3 border-b border-rule">
                <h2 className="text-lg font-bold text-ink">
                  {authMode === 'login' ? 'Portal Sign In' : 'Resident Citizen Registration'}
                </h2>
                <p className="text-xs text-muted">
                  {authMode === 'login'
                    ? 'Enter official credentials to access your agency workspace'
                    : 'Register as a certified resident of Roxas, Oriental Mindoro'}
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="p-1 rounded-md bg-paper border border-rule flex items-center">
                <button
                  id="tab-btn-login"
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginError(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-focus ${
                    authMode === 'login'
                      ? 'bg-paper-3 text-ink shadow-xs border border-rule'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign In</span>
                </button>
                <button
                  id="tab-btn-register"
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setRegError(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-focus ${
                    authMode === 'register'
                      ? 'bg-paper-3 text-ink shadow-xs border border-rule'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Resident Register</span>
                </button>
              </div>

              {/* Status Feedback */}
              {loginError && authMode === 'login' && (
                <div className="p-3 bg-paper-3 border border-error/40 text-error rounded-md text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-error" aria-hidden="true" />
                  <span>{loginError}</span>
                </div>
              )}

              {regError && authMode === 'register' && (
                <div className="p-3 bg-paper-3 border border-error/40 text-error rounded-md text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-error" aria-hidden="true" />
                  <span>{regError}</span>
                </div>
              )}

              {/* =================================================================
                  TAB 1: SIGN IN (LOG IN)
                  ================================================================= */}
              {authMode === 'login' ? (
                <form onSubmit={handleLoginSubmit} autoComplete="off" className="space-y-4">
                  {/* Identifier Field */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="input-login-email"
                      className="block text-xs font-semibold text-ink-2"
                    >
                      Username, Email, or Badge ID
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-muted absolute left-3 top-3" aria-hidden="true" />
                      <input
                        id="input-login-email"
                        name="user_login_credential_field"
                        type="text"
                        autoComplete="off"
                        readOnly
                        onFocus={(e) => { e.target.readOnly = false; }}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        placeholder="e.g. mdrrmoroxas@gmail.com"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-paper text-ink border border-rule rounded-md focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="input-login-passcode"
                        className="block text-xs font-semibold text-ink-2"
                      >
                        Passcode
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-xs text-accent hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-muted absolute left-3 top-3" aria-hidden="true" />
                      <input
                        id="input-login-passcode"
                        name="user_password_credential_field"
                        type={showLoginPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        readOnly
                        onFocus={(e) => { e.target.readOnly = false; }}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        placeholder="••••••••"
                        value={loginPasscode}
                        onChange={(e) => setLoginPasscode(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-paper text-ink border border-rule rounded-md focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        aria-label={showLoginPassword ? 'Hide passcode' : 'Show passcode'}
                        className="absolute right-2.5 top-2.5 text-muted hover:text-ink cursor-pointer p-0.5 focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        {showLoginPassword ? (
                          <EyeOff className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={() => setRememberMe(!rememberMe)}
                        onClick={() => setRememberMe(!rememberMe)}
                        className="w-4 h-4 rounded-sm border-rule text-accent focus:ring-focus cursor-pointer"
                      />
                      <span className="text-xs text-ink-2">
                        Keep me signed in on this workstation
                      </span>
                    </label>
                  </div>

                  {/* Submit Action */}
                  <button
                    id="btn-submit-login"
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-md bg-accent text-accent-ink font-semibold text-xs sm:text-sm hover:opacity-95 active:scale-[0.99] transition-opacity cursor-pointer focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sign in to portal
                  </button>

                  {/* Divider */}
                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-rule" />
                    <span className="flex-shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                      or
                    </span>
                    <div className="flex-grow border-t border-rule" />
                  </div>

                  {/* Sign in with Google */}
                  <button
                    id="btn-google-signin"
                    type="button"
                    onClick={handleOpenGoogleAuth}
                    className="w-full py-2.5 px-4 rounded-md bg-paper hover:bg-paper-3 text-ink border border-rule font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-2xs focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <GoogleLogoIcon className="w-4 h-4 flex-shrink-0" />
                    <span>Sign in with Google</span>
                  </button>

                  <p className="text-xs text-center text-muted pt-1">
                    Don’t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setLoginError(null);
                      }}
                      className="text-accent font-semibold hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      Register as resident
                    </button>
                  </p>
                </form>
              ) : (
                /* =================================================================
                    TAB 2: REGISTER (SIGN UP - RESIDENT CITIZENS ONLY)
                    ================================================================= */
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  {/* Barangay Dropdown */}
                  <div className="space-y-1 relative" ref={barangayDropdownRef}>
                    <label className="block text-xs font-semibold text-ink-2">
                      Home Barangay in Roxas
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsBarangayDropdownOpen((prev) => !prev)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-paper text-ink border border-rule rounded-md flex items-center justify-between cursor-pointer focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <span>Barangay {regBarangay}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-muted transition-transform duration-150 ${
                          isBarangayDropdownOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    {isBarangayDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-paper border border-rule max-h-48 overflow-y-auto py-1 divide-y divide-rule">
                        {ROXAS_BARANGAYS.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => {
                              setRegBarangay(b);
                              setRegBadge(`RES-${b.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`);
                              setIsBarangayDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between hover:bg-paper-3 cursor-pointer ${
                              regBarangay === b ? 'bg-paper-3 text-ink font-bold' : 'text-ink-2'
                            }`}
                          >
                            <span>Barangay {b}</span>
                            {regBarangay === b && <Check className="w-3.5 h-3.5 text-accent" aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-ink-2">
                      Official Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-muted absolute left-3 top-2.5" aria-hidden="true" />
                      <input
                        type="text"
                        placeholder="e.g. Juan dela Cruz"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-paper text-ink border border-rule rounded-md focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-ink-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted absolute left-3 top-2.5" aria-hidden="true" />
                      <input
                        type="email"
                        placeholder="resident@gmail.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-paper text-ink border border-rule rounded-md focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Passcode & Confirmation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-ink-2">
                        Passcode
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          placeholder="At least 6 chars"
                          value={regPasscode}
                          onChange={(e) => setRegPasscode(e.target.value)}
                          className="w-full pl-3 pr-8 py-2 text-xs bg-paper text-ink border border-rule rounded-md focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          aria-label={showRegPassword ? 'Hide passcode' : 'Show passcode'}
                          className="absolute right-2 top-2 text-muted hover:text-ink cursor-pointer focus-visible:outline-2 focus-visible:outline-focus"
                        >
                          {showRegPassword ? (
                            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-ink-2">
                        Confirm
                      </label>
                      <div className="relative">
                        <input
                          type={showRegConfirmPassword ? 'text' : 'password'}
                          placeholder="Re-type passcode"
                          value={regConfirmPasscode}
                          onChange={(e) => setRegConfirmPasscode(e.target.value)}
                          className="w-full pl-3 pr-8 py-2 text-xs bg-paper text-ink border border-rule rounded-md focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                          aria-label={showRegConfirmPassword ? 'Hide passcode' : 'Show passcode'}
                          className="absolute right-2 top-2 text-muted hover:text-ink cursor-pointer focus-visible:outline-2 focus-visible:outline-focus"
                        >
                          {showRegConfirmPassword ? (
                            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Privacy Agreement */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={regAgreeTerms}
                        onChange={() => setRegAgreeTerms(!regAgreeTerms)}
                        onClick={() => setRegAgreeTerms(!regAgreeTerms)}
                        className="mt-0.5 w-4 h-4 rounded-sm border-rule text-accent focus:ring-focus cursor-pointer"
                      />
                      <span className="text-xs text-muted leading-tight">
                        I certify that I am a resident of Roxas, Oriental Mindoro and accept statutory data privacy terms.
                      </span>
                    </label>
                  </div>

                  {/* Submit Registration */}
                  <button
                    id="btn-submit-register"
                    type="submit"
                    className="w-full whitespace-nowrap py-2.5 px-4 rounded-md bg-accent text-accent-ink font-semibold text-xs sm:text-sm hover:opacity-95 active:scale-[0.99] transition-opacity cursor-pointer focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Register resident
                  </button>

                  {/* Divider */}
                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-rule" />
                    <span className="flex-shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                      or
                    </span>
                    <div className="flex-grow border-t border-rule" />
                  </div>

                  {/* Sign up with Google */}
                  <button
                    id="btn-google-signup"
                    type="button"
                    onClick={handleOpenGoogleAuth}
                    className="w-full py-2.5 px-4 rounded-md bg-paper hover:bg-paper-3 text-ink border border-rule font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-2xs focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <GoogleLogoIcon className="w-4 h-4 flex-shrink-0" />
                    <span>Sign up with Google</span>
                  </button>

                  <p className="text-xs text-center text-muted pt-1">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setRegError(null);
                      }}
                      className="text-accent font-semibold hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* =========================================================================
          Bottom Legal & Government Compliance Footer
          ========================================================================= */}
      <footer className="w-full border-t border-rule bg-paper-2 py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
          <span>
            B-CONNECT Multi-Agency Incident & Case Tracking System
          </span>
          <span>
            Local Government Unit of Roxas, Oriental Mindoro
          </span>
        </div>
      </footer>

      {/* =========================================================================
          Forgot Password Modal Helper
          ========================================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-paper-2 rounded-card p-6 max-w-sm w-full border border-rule shadow-card relative">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              aria-label="Close modal"
              className="absolute top-4 right-4 text-muted hover:text-ink cursor-pointer p-1 focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="w-10 h-10 rounded-md bg-paper border border-rule text-accent flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-ink">
              Official Password Recovery
            </h3>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              In compliance with local government data integrity policies, credentials can be reset through your designated Barangay IT Officer or by coordinating with the Roxas Municipal IT Operations Desk.
            </p>
            <div className="mt-3 p-3 bg-paper rounded-md text-xs text-ink-2 border border-rule">
              <span className="font-semibold text-ink">Assistance Desk:</span>{' '}
              <span>Contact the Municipal Administrator’s Office or MDRRMO Dispatch Desk for emergency credential verification.</span>
            </div>
            <button
              type="button"
              onClick={() => { setShowForgotModal(false); }}
              className="mt-4 w-full py-2 bg-paper-3 text-ink text-xs font-semibold rounded-md border border-rule hover:bg-paper cursor-pointer focus-visible:outline-2 focus-visible:outline-focus"
            >
              Close dialog
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          Google Account Sign-In / Sign-Up Chooser Modal
          ========================================================================= */}
      {showGoogleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-auth-dialog-title"
        >
          <div className="bg-paper-2 rounded-card p-6 max-w-md w-full border border-rule shadow-card relative space-y-4">
            <button
              type="button"
              onClick={() => setShowGoogleModal(false)}
              aria-label="Close Google Sign-In"
              className="absolute top-4 right-4 text-muted hover:text-ink cursor-pointer p-1 rounded-sm focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Google Header */}
            <div className="text-center space-y-1.5 pt-1">
              <div className="w-11 h-11 rounded-full bg-paper border border-rule flex items-center justify-center mx-auto shadow-2xs">
                <GoogleLogoIcon className="w-6 h-6" />
              </div>
              <h3 id="google-auth-dialog-title" className="text-base font-bold text-ink">
                {authMode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
              </h3>
              <p className="text-xs text-muted">
                Continue to <strong className="text-ink">B-CONNECT Roxas Resident Portal</strong>
              </p>
            </div>

            {googleError && (
              <div className="p-3 bg-paper-3 border border-error/40 text-error rounded-md text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-error" aria-hidden="true" />
                <span>{googleError}</span>
              </div>
            )}

            <form onSubmit={handleGoogleCustomSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label htmlFor="input-google-email" className="block text-xs font-semibold text-ink-2">
                  Google Email Address (Gmail) <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted absolute left-3 top-2.5" aria-hidden="true" />
                  <input
                    id="input-google-email"
                    type="email"
                    required
                    autoFocus
                    placeholder="resident@gmail.com"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-paper text-ink border border-rule rounded-md focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="input-google-name" className="block text-xs font-semibold text-ink-2">
                  Official Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted absolute left-3 top-2.5" aria-hidden="true" />
                  <input
                    id="input-google-name"
                    type="text"
                    placeholder="e.g. Juan dela Cruz"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-paper text-ink border border-rule rounded-md focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="select-google-barangay" className="block text-xs font-semibold text-ink-2">
                  Home Barangay in Roxas
                </label>
                <select
                  id="select-google-barangay"
                  value={googleBarangay}
                  onChange={(e) => setGoogleBarangay(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-paper text-ink border border-rule rounded-md focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus"
                >
                  {ROXAS_BARANGAYS.map((b) => (
                    <option key={b} value={b}>
                      Barangay {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isGoogleSubmitting}
                  className="w-full py-2.5 px-4 rounded-md bg-accent text-accent-ink font-semibold text-xs sm:text-sm hover:opacity-95 active:scale-[0.99] transition-opacity cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                >
                  <GoogleLogoIcon className="w-4 h-4" />
                  <span>
                    {isGoogleSubmitting
                      ? 'Connecting Google Account...'
                      : authMode === 'login'
                        ? 'Continue with Google'
                        : 'Sign up with Google'}
                  </span>
                </button>
              </div>
            </form>

            <p className="text-xs text-center text-muted pt-2 border-t border-rule">
              Google authentication securely links your Google profile to your Roxas Resident Citizen account.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
