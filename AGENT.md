# B-CONNECT — Agent Rules & Governance Protocol

## Before any task

Read [SPEC.md](SPEC.md), [PROGRESS.md](PROGRESS.md), and [DESIGN.md](DESIGN.md) in full. If instructions conflict with any chat prompt, the files win — flag the conflict immediately and pause.

---

## Core Purpose

**B-CONNECT** is the integrated emergency incident reporting, dispatch, and municipal oversight platform for the **Municipality of Roxas, Oriental Mindoro**, covering all 20 Barangays.

The system connects four official user roles:
1. **Resident Citizens (`RESIDENT`)**: File verified vehicular crash, accident, and community incident reports with photo uploads, and track real-time docket milestones in *My Reports*.
2. **MDRRMO (`MDRRMO_ADMIN` / `MDRRMO`)**: Municipal Disaster Risk Reduction & Management Office operating the real-time emergency dispatch queue, siren alarms, triage, and geospatial graph analytics.
3. **LGU Executive (`LGU_ADMINISTRATOR` / `LGU`)**: Municipal Administrator and Mayor's Executive Staff monitoring statutory escalation timeouts, issuing executive directives, and tracking DILG transparency metrics.
4. **System Administrator (`ADMIN`)**: Municipal IT and Node Administrator configuring escalation timeout policies, carrier SMS dispatch templates, and managing system audit trails.

---

## Active Phase: Phase 3 — Fork Reconciliation, Reporting Persistence & Dedup Safety (WP-14)

Phase 1 (WP-01 to WP-08) and Phase 2 (WP-09 to WP-13) are complete and verified (`tsc --noEmit` 0 errors, clean `vite build`).

The active phase reconciles `jdmf1122-lgtm/barangay` (`fork/main`) into `main` once `lgtm` stops pushing commits, fixes report persistence/visibility against Supabase `chyayvzwsqihedopjqqh`, and prevents false-positive deduplication or destructive polling deletes ([WP-14](SPEC.md)).

---

## Hard Rules

- **Work Package Scope**: Implement exactly **one work package per session** (from [SPEC.md](SPEC.md) and [PROGRESS.md](PROGRESS.md)). Stop cleanly at its boundary. Never modify out-of-scope modules autonomously.
- **Approved Tech Stack**:
  - **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion 12, Lucide React, Leaflet.
  - **Backend**: Express + Node.js (`server.ts` with TypeScript execution via TSX) and Vercel serverless routes (`api/*`).
  - **Database & Realtime**: Supabase (PostgreSQL, Supabase Auth, Realtime Channels, Storage).
  - **Styling Architecture**: Semantic tokens declared in [src/tokens.css](src/tokens.css) and reset in [src/base.css](src/base.css) via [DESIGN.md](DESIGN.md).
- **Hallmark Floor Invariants (Non-Waivable)**:
  - **Zero Literal Colors**: Every color must resolve to a token from `tokens.css` (`bg-paper`, `text-ink`, `border-rule`, `bg-accent`, `text-error`, etc.).
  - **Never `transition: all`**: Always specify explicit transitions (`transition-colors`, `transition-opacity`, `transition-transform`).
  - **Accessible Focus**: Every interactive button, input, tab, and select must carry instant `:focus-visible:ring-2 focus-visible:ring-focus`.
  - **Motion Discipline**: Support `prefers-reduced-motion: reduce`.
  - **No Slop**: No card-inside-a-card, no blurred orbs, no emoji in select options, no glued arrows.
  - **Tabular Figures**: Every numeric statistic, case docket number, timestamp, and countdown must use `font-variant-numeric: tabular-nums` or `num` utility.
- **System & Domain Invariants**:
  - **Preserve Wiring & State**: Never drop or alter form handlers, context hooks (`useCases`, `useAuth`, `useUI`, `useNotifications`), Supabase realtime subscriptions, or Leaflet map layers.
  - **Official Fixed Credentials**: Maintain fixed credential availability (`mdrrmoroxas@gmail.com` / `mdrrmo2026`, `lguroxas@gmail.com` / `lguroxas2026`) and instant demo persona access.
  - **Dual-Mode Offline Fallback**: Always maintain offline/demo state fallbacks so evaluators and municipal personnel can operate without live backend dependencies.
- **Submission-Time Deduplication Only**: Never delete rows from Supabase inside `CaseContext` polling (`fetchData`); deduplicate only at submission time with strict content/location overlap checks.
- **No Parallel Insert Races**: Keep `createCase` sequential (`supabase` → `23505` retry → `/api/cases` fallback) and reconcile any server-assigned case ID back into state.

---

## Definition of Done for a Work Package

1. `npm run build` (`vite build`) bundles cleanly with 0 compilation errors.
2. `npm run lint` (`tsc --noEmit`) passes with 0 TypeScript errors.
3. All interactive handlers, forms, and test IDs within target files are fully preserved and accounted for.
4. Deliverables specified in [SPEC.md](SPEC.md) for the work package are fully implemented and verified.
5. [PROGRESS.md](PROGRESS.md) is updated with deliverable summaries and checked-off checklists (`[x]`).
6. Git status is clean and reflects only files belonging to the assigned work package.

---

## Do Not

- Touch or modify components outside the assigned work package scope.
- Hardcode Supabase service role keys in client bundles.
- Drop or rename existing component props, test IDs, or Supabase realtime channels.
- Mark any deliverable complete without verifiable build and typecheck evidence.
- Auto-delete database cases inside `CaseContext` polling loops (`deduplicateCaseList` + `DELETE`).
