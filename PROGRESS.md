# B-CONNECT — Progress Ledger: Phase 3 Fork Reconciliation & Reporting Visibility

Tracking Phase 3 (WP-14) on top of completed Phase 1 (WP-01–WP-08) and Phase 2 (WP-09–WP-13), governed by [SPEC.md](SPEC.md) and [AGENT.md](AGENT.md).

---

## Archival Summary: Phase 1 & Phase 2 — 100% Complete
- **WP-01 to WP-08 (Hallmark Redesign & Hardening)**: COMPLETED (34/34 files clean under Hallmark sloplint audit, 0 FAILs, 0 WARNs).
- **WP-09 to WP-13 (Mutation Proxying, RLS Hardening, API Resilience, Mobile Nav, Google OAuth)**: COMPLETED.

---

## Phase 3 Baseline & Active Blockers

- **Production Build (`npm run build`)**: Passing cleanly on `main` (`dist/` verified).
- **TypeScript Compiler (`tsc --noEmit`)**: Passing cleanly on `main` (**0 errors**).
- **Active Focus (WP-14)**:
  1. **Fork Merge & Reconciliation Complete**: Merged `fork/main` (`404235a`..`c2ad547`) into `main`, removed `c2ad547` polling `DELETE` loop in `CaseContext.tsx`, merged Tagalog/Taglish `SYNONYMS` + `normalizeWordRoot` with `hasContentOrLocationOverlap` guard in `duplicateReportDetector.ts`, adapted `ResidentPortalView.tsx` submission modal to `tokens.css`, and restored `.gitignore` ignores.
  2. **Production Alignment Verified**: User applied [supabase_rls_and_columns_fix.sql](supabase_rls_and_columns_fix.sql) on `chyayvzwsqihedopjqqh`; live probe of `https://b-connect-roxas.vercel.app/` verified `chyayvzwsqihedopjqqh.supabase.co` in bundle and `200` responses from `/api/cases` (15 cases) and `/api/users` (17 users).

---

## Phase 3 Work Package Roadmap

| Priority | ID | Work Package | Status | Target Deliverables | Verification Target |
| :---: | :---: | :--- | :---: | :--- | :--- |
| **1** | **WP-14** | **Fork Reconciliation, Reporting Persistence & Dedup Safety**<br>- Merged `fork/main` (`404235a`..`c2ad547`) into `main` with local fixes preserved (`CaseContext` fallback without polling `DELETE`, `useCases` sequential insert/ID sync, `duplicateReportDetector` Tagalog/Taglish + overlap guard, token-aligned `ResidentPortalView` modal, `.gitignore` restored).<br>- SQL fix applied on `chyayvzwsqihedopjqqh`; live Vercel deployment verified against `chyayvzwsqihedopjqqh`. | **COMPLETED** | `supabase_rls_and_columns_fix.sql`<br>`supabase_schema.sql`<br>`src/context/CaseContext.tsx`<br>`src/hooks/useCases.ts`<br>`src/utils/duplicateReportDetector.ts`<br>`src/components/resident/ResidentPortalView.tsx`<br>`.gitignore` | `tsc --noEmit`, `vite build`, dedup assertions, live Vercel/Supabase probe |

---

## Detailed Work Package Status

### WP-09: End-to-End Case Mutation Proxying
- **Status:** [x] COMPLETED
- **Tasks**:
  - [x] Add `PATCH` / `PUT` handler to `server.ts` for `/api/cases` and `/api/cases/:id`.
  - [x] Add `PATCH` / `PUT` handler to `api/cases.ts` for Vercel serverless runtime.
  - [x] Update `updateCaseStatus` in `src/hooks/useCases.ts` to dispatch to `/api/cases`.
  - [x] Update `assignPersonnel` in `src/hooks/useCases.ts` to dispatch to `/api/cases`.
  - [x] Update `logInvestigationNarrative` in `src/hooks/useCases.ts` to dispatch to `/api/cases`.
  - [x] Update `deleteCase` in `src/hooks/useCases.ts` to dispatch to `/api/cases`.
- **Verification Evidence**:
  - `server.ts`: Added `app.patch` and `app.put` for `/api/cases` and `/api/cases/:id` with `SUPABASE_CASE_COLUMNS` column sanitization and `supabaseAdmin.from('cases').upsert()`. Added `app.delete` for `['/api/cases', '/api/cases/:id']` handling `req.params.id || req.query.id || req.body.id`.
  - `api/cases.ts`: Added `PUT` and `PATCH` support with `req.query?.id || caseData?.id` extraction, schema sanitization, and PostgREST update.
  - `src/hooks/useCases.ts`: Added `persistCaseUpdate` helper providing dual direct Supabase and `/api/cases` proxy dispatch. Routed `updateCaseStatus`, `assignPersonnel`, `logInvestigationNarrative`, `addCaseTimelineEvent`, `markIncidentAsSeenAndResponded`, `escalateIncidentToLgu`, and `recordLguInterventionAction` through backend proxy. Updated `deleteCase` with relative proxy and URL dispatch.
  - `npm run lint` (`tsc --noEmit`) and `npm run build` passing cleanly with 0 errors.

---

### WP-10: Database RLS Hardening & Case Visibility
- **Status:** [x] COMPLETED
- **Tasks**:
  - [x] Update RLS policies in `supabase_schema.sql` to explicitly grant access for anonymous reporting and municipal dispatch consoles.
  - [x] Harden `CaseContext.tsx` fetch logic against race conditions or empty cache overrides.
  - [x] Test cross-browser sync for MDRRMO and LGU case feeds across all 20 Roxas barangays.
- **Verification Evidence**:
  - `supabase_schema.sql`: Updated RLS policies to dual-mode (`anon, authenticated`) for `cases` (SELECT, INSERT, UPDATE, DELETE), `users` (SELECT, INSERT, UPDATE), `audit_logs` (SELECT, INSERT), and `notifications` (SELECT, INSERT, UPDATE, DELETE). Configured public upload/update policies on `storage.objects` for the `report-images` bucket. Added performance indexes (`idx_cases_barangay`, `idx_cases_status`, `idx_cases_date_created`, `idx_cases_is_escalated`). Enabled `REPLICA IDENTITY FULL` and `supabase_realtime` publication for `cases`, `notifications`, and `audit_logs`.
  - `src/context/CaseContext.tsx`: Hardened `sanitizeCaseBarangay` with case-insensitive matching across `ROXAS_BARANGAYS` and safe array normalization for all JSONB arrays (`timeline`, `imageUrls`, `personsInvolved`, `statusHistory`, etc.). Added optimistic update protection preventing stale remote polls from overwriting newer local modifications (`localTime > remoteTime`). Preserved in-flight optimistic reports within a 60-second window or when offline. Removed destructive `delete()` call from `bc.onmessage` duplicate handler.
  - `src/hooks/useCases.ts`: Routed duplicate auto-consolidation through `persistCaseUpdate` for dual client and backend proxy persistence.
  - `npm run lint` (`tsc --noEmit`) and `npm run build` passing with 0 errors.

---

### WP-11: Serverless & Backend API Key Resilience
- **Status:** [x] COMPLETED
- **Tasks**:
  - [x] Validate `SUPABASE_SERVICE_ROLE_KEY` in `api/auth/login.ts` and return clean status 400/503 if missing rather than throwing in `admin.listUsers()`.
  - [x] Add safety check in `api/users.ts` before executing admin user deletions.
  - [x] Validate error handling in `api/cases.ts` for unconfigured environments.
- **Verification Evidence**:
  - `api/auth/login.ts`: Removed fallback from `SUPABASE_SERVICE_ROLE_KEY` to `VITE_SUPABASE_ANON_KEY`. Added strict `isServiceRoleKey()` JWT payload role validator (`role === 'service_role'`). Guarded `supabaseClient.auth.admin.listUsers()` with `hasServiceRole` and `try...catch` so missing service keys never throw 500 exceptions. Preserved `FIXED_USERS` demo logins (`mdrrmoroxas@gmail.com`, `lguroxas@gmail.com`) when database is unconfigured.
  - `api/auth/register.ts`: Removed anon key fallback for service key. Guarded `supabaseClient.auth.admin` methods with `hasServiceRole` and wrapped in `try...catch`. Ensured resident registration persists to `public.users` via client or returns offline fallback profile with status 200 without 500 crashes.
  - `api/users.ts`: Replaced 500 rejection with clean 200 `[]` fallback on GET when database is unconfigured. Added `PROTECTED_USER_IDS` safety guard in DELETE rejecting deletions of fixed system accounts (`USR-MDRRMO-ROXAS-FIXED`, `USR-LGU-ROXAS-FIXED`, `USR-ADMIN-ROXAS-FIXED`) with status 403 Forbidden. Guarded `auth.admin.deleteUser()` with `hasServiceRole`.
  - `api/cases.ts`: Replaced 500 rejection with graceful offline/mock fallback for unconfigured environments (GET returns 200 `[]`, POST/PATCH/PUT returns 200 with sanitized payload, DELETE returns 200).
  - `server.ts`: Implemented matching `isServiceRoleKey` validation, `hasServiceRole` guards on `auth.admin` operations in `/api/auth/login`, `/api/auth/register`, and protected user ID checks on `DELETE /api/users`.
  - Verified 8/8 automated test cases in `test_wp11.ts`: fixed logins (200), missing accounts (404), unconfigured registrations (200), unconfigured user listings (200), protected user deletion protection (403), unconfigured case listing (200), and case creation (200).
  - `npm run lint` (`tsc --noEmit`) and `npm run build` passing with 0 errors.

---

### WP-12: Mobile Navigation Shell Restoration
- **Status:** [x] COMPLETED
- **Tasks**:
  - [x] Restore `btn-toggle-mobile-sidebar` in `src/components/common/Header.tsx` for `MDRRMO`, `LGU`, and `ADMIN` roles.
  - [x] Ensure mobile sidebar toggle state links properly with `isMobileMenuOpen` from `useUI()`.
  - [x] Validate touch target sizes (minimum 44px) and focus indicators.
- **Verification Evidence**:
  - `src/components/common/Header.tsx`: Restored `btn-toggle-mobile-sidebar` for non-resident agency roles (`MDRRMO`, `LGU`, `ADMIN`) on mobile viewports (`lg:hidden`). Wired `onToggleSidebar` prop and `setIsMobileMenuOpen` toggle from `useUI()`. Configured accessible ARIA attributes (`aria-label`, `aria-expanded`, `aria-controls="bconnect-sidebar-mobile"`) and meeting 44x44px touch targets.
  - `src/components/common/Sidebar.tsx`: Hardened mobile drawer accessibility with `role="dialog"`, `aria-modal="true"`, and `aria-label="Mobile Navigation Drawer"`. Added `Escape` key dismiss listener and body background scroll locking while drawer is open. Enforced minimum 44px touch targets (`min-h-[44px]`) on close button and navigation links.
  - `src/components/common/MobileBottomNav.tsx`: Aligned `ADMIN` role alongside `LGU` to render executive/administrative bottom navigation tabs (`dashboard`, `transparency`, `annual_narrative`, and menu drawer toggle). Added accessible ARIA controls and 44px touch targets to mobile drawer toggle buttons.
  - Verified static assertions: 8/8 assertions passed.
  - `npm run lint` (`tsc --noEmit`) and `npm run build` passing cleanly with 0 errors.

---

### WP-13: Google Sign-In Streamlining
- **Status:** [x] COMPLETED
- **Tasks**:
  - [x] Unify Google Auth in `src/components/auth/AuthPage.tsx` to favor `supabase.auth.signInWithOAuth({ provider: 'google' })`.
  - [x] Clean up redundant popup client code and state variables where not needed.
  - [x] Verify profile auto-provisioning in `src/context/AuthContext.tsx`.
- **Verification Evidence**:
  - `src/components/auth/AuthPage.tsx`: Consolidated Google Auth onto native `supabase.auth.signInWithOAuth({ provider: 'google', options: { ... } })`. Removed redundant Google Identity Services (GSI) popup logic (70+ lines of raw token requests and client ID inputs) and replaced it with a streamlined, Hallmark-compliant modal fallback for offline/demo verification. Added accessible dialog landmarks (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) and proper focus rings.
  - `src/context/AuthContext.tsx`: Hardened `resolveOrProvisionSessionUser` to auto-provision new Google users with normalized `ROXAS_BARANGAYS` validation, docket ID generation (`RES-${brgy}-...`), and database upsert to `public.users`. Added fallback barangay resolution for existing resident profiles.
  - `index.html`: Removed dead external GSI script dependency (`accounts.google.com/gsi/client`), reducing network bloat and external script attack surface.
  - `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) passing cleanly with 0 errors.

---

### WP-14: Fork Reconciliation, Reporting Persistence & Dedup Safety
- **Status:** [x] COMPLETED
- **Verification & Deliverables**:
  - [x] Created [supabase_rls_and_columns_fix.sql](supabase_rls_and_columns_fix.sql) for `chyayvzwsqihedopjqqh` (grants + `TO anon, authenticated` policies + 12 LGU escalation columns + storage/realtime + PostgREST schema reload); applied by user on `chyayvzwsqihedopjqqh`.
  - [x] Fixed `idx_cases_is_escalated` ordering in `supabase_schema.sql` (placed after `ALTER TABLE ... ADD COLUMN`).
  - [x] Merged `fork/main` (`404235a`, `683db38`, `c2ad547`) into `main`.
  - [x] Reconciled `CaseContext.tsx`: kept empty `/api/cases` (`[]`) fallback to `supabase.from('cases')` and removed `c2ad547`'s destructive `deduplicateCaseList` auto-`DELETE` loop inside `fetchData`.
  - [x] Fixed `useCases.ts` `createCase` & `persistCaseUpdate` to avoid parallel insert races and sync reassigned server IDs back to state/timeline.
  - [x] Reconciled `duplicateReportDetector.ts`: kept `c2ad547`'s Tagalog/Taglish `SYNONYMS` + `normalizeWordRoot` + `isResolvedOrClosed` protection while preserving municipal boilerplate exclusion (`sitio`) and `hasContentOrLocationOverlap` guard.
  - [x] Kept `ResidentPortalView.tsx` `showReportSubmittedModal` (`683db38`) and aligned backdrop/badge/button styles with `tokens.css` (`bg-ink/50`, `text-accent`, `border-rule`, `focus-visible:ring-focus`, `role="dialog"`).
  - [x] Restored `.agents/`, `.claude/`, and `skills-lock.json` ignores in `.gitignore`.
  - [x] Verified `npm run lint`, `npm run build`, dedup assertions (`unrelatedScore: 0.27` → `false`, `dupScore: 0.9` → `true`), and live production probes against `https://b-connect-roxas.vercel.app/` (`chyayvzwsqihedopjqqh.supabase.co`, `/api/cases` 200, `/api/users` 200).
