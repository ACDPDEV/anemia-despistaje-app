# Archive Report: dashboard-shell

**Change**: dashboard-shell
**Archived**: 2026-10-04 → `openspec/changes/archive/2026-10-04-dashboard-shell/`
**Mode**: openspec (filesystem artifacts; no Engram observation IDs)
**Status**: Complete — SDD cycle closed (intentional-with-warnings: 2 static-evidence adjudications, documented below)

## Final State (AT CLOSE — authoritative)

Per orchestrator final-state facts, which outrank intermediate snapshots:

- **Gates**: `tsc --noEmit` exit 0, `pnpm build` exit 0, **79/79 tests green** as-found with `.env`
  (sync test fixed earlier; no env juggling).
- **Spec compliance**: 8/8 requirements, 14/14 scenarios COMPLIANT.
- **Adjudication**: 2 scenarios rest on documented static evidence only —
  (1) content `max-w-5xl` layout width (jsdom cannot measure layout; a class assertion
  would be banned CSS-coupling), (2) selector-only data invariant (negative invariant
  verified by diff review: no store hunks). Judgment Day explicitly invited to challenge.
- **Code freeze**: no code changed after verify.
- **Commit ownership**: worktree left uncommitted; orchestrator owns commit/push to `pacientes-socuec`.
- **Ledger**: all 3 units settled complete/passed. No schema/dependency change (sidebar via CLI only).

## Gates Evaluated

- **Native Review Receipt Gate**: `reviewGate` structurally absent from status — no review
  was ever started for this candidate. Per skill: absence is not a defect; archive proceeds
  under ordinary repository policy. `verify-report` native admission: valid true, pass.
- **Task Completion Gate**: PASS — persisted `tasks.md` shows 11/11 checked, zero `- [ ]`.
  No stale-checkbox reconciliation was needed.
- **CRITICAL check**: `verify-report` reports `critical_findings: 0`, `blockers: 0`. No block.

## Specs Synced (Step 2)

| Domain | Action | Details |
|--------|--------|---------|
| app-shell | Created | `openspec/specs/app-shell/spec.md` — 4 requirements (Sidebar Navigation, Single Navigation Source, Collapsible Sidebar, Content Layout), mechanical copy, `diff -r` empty |
| kpi-cards | Created | `openspec/specs/kpi-cards/spec.md` — 3 requirements (Section-Cards Pattern, Trend Captions, Selector-Only Data), mechanical copy, `diff -r` empty |
| dashboard | Updated | `openspec/specs/dashboard/spec.md` — MODIFIED Requirement "KPI Cards": captions added to both scenarios, new "Dashboard inside app shell" scenario appended; Hb Distribution Chart and Risk by Age Group preserved untouched. Delta change-note parenthetical ("Previously: ...") dropped as non-normative. Non-destructive merge (no removals). |

## Archive Contents

- proposal.md ✅
- specs/ (app-shell, dashboard delta, kpi-cards) ✅
- design.md ✅ (validated PASS)
- tasks.md ✅ (11/11 complete)
- apply-progress.md ✅ (Units 1–3 merged)
- verify-report.md ✅ (PASS WITH WARNINGS, native ADMITTED)
- archive-report.md ✅ (this file, additive)

## Source of Truth Updated

- `openspec/specs/app-shell/spec.md` (new)
- `openspec/specs/kpi-cards/spec.md` (new)
- `openspec/specs/dashboard/spec.md` (KPI Cards requirement updated)

## Artifacts Read (traceability)

- `openspec/changes/dashboard-shell/proposal.md` (listed; content unchanged by archive)
- `openspec/changes/dashboard-shell/specs/app-shell/spec.md`
- `openspec/changes/dashboard-shell/specs/dashboard/spec.md`
- `openspec/changes/dashboard-shell/specs/kpi-cards/spec.md`
- `openspec/changes/dashboard-shell/design.md` (validated PASS, per launch context)
- `openspec/changes/dashboard-shell/tasks.md` (full read: 11/11 `[x]`)
- `openspec/changes/dashboard-shell/verify-report.md` (full read: verdict pass, 0 critical, 0 blockers)
- `openspec/changes/dashboard-shell/apply-progress.md` (per launch context: Units 1–3 merged)
- `openspec/specs/dashboard/spec.md` (pre-merge read + post-merge edit)
- `openspec/config.yaml` (`rules.archive`: warn before merging destructive deltas — merge was non-destructive, no warning triggered)

## Risks / Open Items

- 2 static-evidence adjudications (layout width, selector-only invariant) remain open to
  Judgment Day challenge by design; documented in verify-report and §Final State.
- Commit/push to `pacientes-socuec` is orchestrator-owned and still pending at archive time.
- Tablet collapse default deferred to field feedback (SUGGESTION, non-blocking).
