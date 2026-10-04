# Apply Progress: form-polish

**Change**: form-polish
**Mode**: Standard (Strict TDD N/A — behavior frozen, frozen-suite evidence instead)
**Date**: 2026-10-03
**Branch**: main @ 51772dc (slice-3-sync equivalent; slice branch not present, worked on main)
**Work unit**: Single unit — Field idiom swap, frozen suite green (single PR, ~120-200 line budget, risk Low)

## Completed Tasks

- [x] 1.1 Run `pnpm dlx shadcn@latest add field -y` non-interactively; diff-review created `src/components/ui/field.tsx`
- [x] 1.2 Confirm `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription` exports; verify `@/` alias matches `ui/button.tsx`
- [x] 2.1 Replace `form.space-y-4` with `<FieldGroup>`; div+label+input blocks with `<Field>` + `<FieldLabel htmlFor>` + `<Input>`
- [x] 2.2 Swap tokens: error `p.text-red-600` → `text-destructive` (kept `role="alert"`); submit `button.bg-blue-600` → `<Button type="submit">`; dismiss → `<Button variant="outline" size="sm">`
- [x] 2.3 Set `data-invalid` on `Field` + `aria-invalid` on `Input` only when error set; kept ids, Spanish copy, `<p>` elements unchanged
- [x] 3.1 Class-gate grep: no `space-y-*`, `text-red-600`, `bg-blue-600` in `RegisterForm.tsx`
- [x] 3.2 Run frozen suite unchanged: full `pnpm test` + `tsc --noEmit` green; recorded as frozen-suite evidence

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/components/ui/field.tsx` | Created (via CLI) | FieldGroup/Field/FieldLabel/FieldDescription/FieldError primitives (236 lines, standard shadcn output) |
| `src/components/ui/label.tsx` | Created (via CLI dep) | Label primitive required by field.tsx (17 lines, no new npm deps) |
| `src/components/ui/separator.tsx` | Modified (via CLI) | Single added line: `"use client"` (harmless; project is non-RSC Vite) |
| `src/components/RegisterForm.tsx` | Modified | JSX-only swap (~45+/43-); zero logic/copy/behavior changes |

### Extra files/deps from CLI (reviewed)

- `label.tsx`: new, required import of `field.tsx`; trivial Label wrapper over `<label>`, spreads `htmlFor` through — approved.
- `separator.tsx`: +1 line (`"use client"`); no behavior change in Vite SPA — approved.
- `package.json` / lockfile: unchanged — no new dependencies pulled.

## Frozen-Suite Evidence (Strict TDD N/A)

Behavior frozen by design; no RED cycle applicable. Existing tests untouched (`git diff` shows no test file changes).

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm test` → 10 files, 79/79 passed (incl. `RegisterForm.test.tsx` 4/4 as-is) |
| Runtime harness command/scenario and exact result | `pnpm exec tsc --noEmit` → exit 0, no errors; class-gate `rg "space-[xy]-\|text-red-600\|bg-blue-600" src/components/RegisterForm.tsx` → no matches |
| Rollback boundary | `git checkout -- src/components/RegisterForm.tsx src/components/ui/separator.tsx` + delete `src/components/ui/field.tsx` + `src/components/ui/label.tsx`; rerun `pnpm test` |

## Deviations from Design

- Success (`text-green-700`) and duplicate-hint (`text-amber-700`) `<p>` elements kept verbatim: theme (`src/index.css`) defines no success/warning semantic tokens (only `--destructive`), so per design's open question ("resolve at apply time from CSS variables") the minimal-change path was taken. Gate only forbids `space-y-*`/`text-red-600`/`bg-blue-600`.
- Duplicate-hint wrapper already used `flex items-center gap-2` (compliant, unchanged).

## Issues Found

- First CLI run stalled on an interactive `separator.tsx` overwrite prompt despite `-y`; re-ran with `--overwrite` and it completed (`field.tsx` created). No other issues.

## Remaining Tasks

None — 7/7 tasks complete. Ready for verify.
