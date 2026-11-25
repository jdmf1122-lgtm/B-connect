# B-CONNECT — Specification: Database Persistence, RLS Hardening, Case Sync & Auth Streamline

**Target System:** B-CONNECT — Municipal Incident Reporting, Dispatch & Governance System  
**Jurisdiction:** Municipality of Roxas, Oriental Mindoro, Philippines  
**Phase:** Phase 2 (WP-09 through WP-13)  
**Previous Phase Status:** COMPLETED (WP-01 through WP-08 Hallmark Redesign: 100% complete, 0 sloplint errors, clean production build)  
**System Contracts:** [AGENT.md](AGENT.md) · [DESIGN.md](DESIGN.md) · [supabase_schema.sql](supabase_schema.sql)

---

## 1. Executive Summary & Problem Scope

Following the integration of upstream fork changes (serverless `/api` routes, Google OAuth, resident profile management, and un-truncated dashboards), a rigorous ponytail code review identified the following critical areas requiring stabilization and hardening:

1. **Case Updates Fail under Supabase RLS**: While case creation is mirrored to `/api/cases`, operational case updates (`updateCaseStatus`, `assignPersonnel`, `logInvestigationNarrative`, `deleteCase`) in [useCases.ts](src/hooks/useCases.ts) only call direct Supabase client methods with the `anon` key. When users operate with local PIN credentials without an active Supabase Auth session, updates fail silently against RLS policies (`FOR UPDATE TO authenticated`).
2. **Missing Cases at MDRRMO / LGU Consoles**: Previous case invisibility was caused by:
   - Hardcoded `.slice(0, 8)` in dashboard tables (now removed).
   - Supabase RLS blocking `anon` SELECT queries.
   - Auto-deduplication logic previously deleting real cases.
   - Lack of end-to-end proxying for all case mutations.
3. **Admin API Crashes on Missing Service Role Key**: In [api/auth/login.ts](api/auth/login.ts) and [api/users.ts](api/users.ts), missing `SUPABASE_SERVICE_ROLE_KEY` falls back to `VITE_SUPABASE_ANON_KEY`, causing runtime exceptions when calling admin-only Supabase methods (`supabaseAdmin.auth.admin.listUsers()`).
4. **Mobile Navigation Regression**: [Header.tsx](src/components/common/Header.tsx) removed the mobile hamburger button, preventing agency officers on mobile from accessing secondary administration views.
5. **Dual Google Sign-In Complexity**: [AuthPage.tsx](src/components/auth/AuthPage.tsx) maintains two divergent Google login implementations (direct Google Identity Services popup client and Supabase OAuth), creating maintenance overhead.

---

## 2. Work Package Decomposition

### WP-09: End-to-End Case Mutation Proxying (Backend & Hook Sync)
- **Primary Files**:
  - `server.ts`
  - `api/cases.ts`
  - `src/hooks/useCases.ts`
- **Objectives**:
  1. Add `PATCH` and `PUT` endpoints to `server.ts` and `api/cases.ts` handling case updates, status changes, personnel assignments, and resolution notes using `supabaseAdmin`.
  2. Update `server.ts` to support both `/api/cases/:id` and `/api/cases?id=:id` for deletions and updates.
  3. Update [src/hooks/useCases.ts](src/hooks/useCases.ts) functions (`updateCaseStatus`, `assignPersonnel`, `logInvestigationNarrative`, `deleteCase`) to dispatch requests through `/api/cases` in addition to the direct client calls.
- **Success Criteria**:
  - Case status changes, assignments, and notes persist to PostgreSQL even when logged in via PIN without Supabase Auth JWT.

---

### WP-10: Database RLS Hardening & Case Visibility Diagnostics
- **Primary Files**:
  - `supabase_schema.sql`
  - `src/context/CaseContext.tsx`
- **Objectives**:
  1. Update [supabase_schema.sql](supabase_schema.sql) with clear, dual-mode RLS policies (`anon` + `authenticated`) for `public.cases` so municipal workstations querying directly via anon key receive all relevant municipal cases.
  2. Ensure [src/context/CaseContext.tsx](src/context/CaseContext.tsx) correctly merges remote database cases with local state without discarding or overwriting records on intermittent fetch errors.
  3. Verify cross-device case propagation for all 20 Roxas barangays.
- **Success Criteria**:
  - Incidents filed from resident portal appear reliably in MDRRMO and LGU queues across separate browser sessions and devices.

---

### WP-11: Serverless & Backend API Resilience
- **Primary Files**:
  - `api/auth/login.ts`
  - `api/auth/register.ts`
  - `api/users.ts`
  - `api/cases.ts`
  - `server.ts`
- **Objectives**:
  1. Add strict validation for `SUPABASE_SERVICE_ROLE_KEY` across all serverless handlers.
  2. Guard `supabaseAdmin.auth.admin` calls: if service role key is absent, avoid calling admin-only APIs that throw fatal errors, and return structured error responses instead of crashing with HTTP 500.
  3. Maintain seamless local development fallback when running `npm run dev` with Express `server.ts`.
- **Success Criteria**:
  - Serverless functions handle missing or malformed environment variables without 500 crashes.

---

### WP-12: Mobile Navigation Shell Restoration
- **Primary Files**:
  - `src/components/common/Header.tsx`
  - `src/components/common/Sidebar.tsx`
  - `src/components/common/MobileBottomNav.tsx`
- **Objectives**:
  1. Reintroduce the mobile hamburger menu toggle button in [Header.tsx](src/components/common/Header.tsx) for agency personnel (`MDRRMO`, `LGU`, `ADMIN`).
  2. Ensure the drawer overlay opens smoothly, respects `prefers-reduced-motion`, and complies with Hallmark density standards.
  3. Maintain resident-focused bottom navigation while granting officers full access to operational views on mobile.
- **Success Criteria**:
  - Agency officers on mobile viewports can navigate to all assigned views (Case List, Map, Analytics, Reports, Admin).

---

### WP-13: Google Sign-In Streamlining & Supabase Provider Integration
- **Primary Files**:
  - `src/components/auth/AuthPage.tsx`
  - `src/context/AuthContext.tsx`
  - `index.html`
- **Objectives**:
  1. Consolidate Google OAuth logic: prioritize native Supabase OAuth (`supabase.auth.signInWithOAuth({ provider: 'google' })`).
  2. Simplify the Google Sign-In modal in [AuthPage.tsx](src/components/auth/AuthPage.tsx) to eliminate redundant code and reduce bundle footprint.
  3. Ensure user profile auto-provisioning in [AuthContext.tsx](src/context/AuthContext.tsx) cleanly assigns new Google users to their chosen Roxas barangay.
- **Success Criteria**:
  - Google Sign-In flow is unified, predictable, and fully integrated with Supabase Auth.

---

## 3. Verification Protocol

1. **Type Safety**: `npm run lint` (`tsc --noEmit`) passes with 0 errors.
2. **Production Build**: `npm run build` compiles cleanly within budget.
3. **Runtime Verification**: Case lifecycle (Create -> Dispatch -> Update Status -> Resolve -> Persist) verified across page refreshes and multi-session contexts.
