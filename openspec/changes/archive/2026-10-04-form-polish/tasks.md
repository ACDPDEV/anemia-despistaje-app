# Tasks: form-polish

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120-200 (RegisterForm ~60 + field.tsx via CLI) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Field idiom swap, frozen suite green | PR 1 (single) | `pnpm test src/components/RegisterForm.test.tsx` + `tsc --noEmit` | Manual render: labels linked, alert announced, dismiss works | `git checkout -- src/components/RegisterForm.tsx`; delete `ui/field.tsx` if new |

## Phase 1: Prerequisite (CLI field)

- [x] 1.1 Run `pnpm dlx shadcn@latest add field -y` non-interactively; diff-review created `src/components/ui/field.tsx`
- [x] 1.2 Confirm `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription` exports; verify `@/` alias matches `ui/button.tsx`

## Phase 2: JSX swap (`src/components/RegisterForm.tsx` only)

- [x] 2.1 Replace `form.space-y-4` with `<FieldGroup>`; div+label+input blocks with `<Field>` + `<FieldLabel htmlFor>` + `<Input>`
- [x] 2.2 Swap tokens: error `p.text-red-600` → `text-destructive` (keep `role="alert"`); submit `button.bg-blue-600` → `<Button type="submit">`; dismiss → `<Button variant="outline" size="sm">`
- [x] 2.3 Set `data-invalid` on `Field` + `aria-invalid` on `Input` only when error set; keep ids, Spanish copy, `<p>` elements unchanged

## Phase 3: Verification (frozen suite, no RED)

- [x] 3.1 Class-gate grep: no `space-y-*`, `text-red-600`, `bg-blue-600` in `RegisterForm.tsx`
- [x] 3.2 Run frozen suite unchanged: full `pnpm test` + `tsc --noEmit` green; record as frozen-suite evidence (strict_tdd RED N/A, behavior frozen)
