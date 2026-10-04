# Design: form-polish

## Technical Approach

JSX-only migration of `RegisterForm.tsx` to shadcn Field idiom. No logic, validation, store, or Spanish copy changes. Prerequisite: `pnpm dlx shadcn@latest add field -y`, diff-reviewed, to provide `ui/field.tsx` (`FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`). Then swap layout/controls/tokens per mapping below, preserving ids, labels, `role=alert`, and button names so frozen tests pass.

Data flow unchanged:

    RegisterForm state ──→ validation ──→ padronStore.add / error
              │──→ duplicateWarning (warning-only, dismissible)

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| FieldGroup+Field+Input+Button | Requires CLI add; exact shadcn idiom, kills `space-y-*`/raw colors | **Chosen** |
| Token-only swap, keep divs | No CLI dep; leaves `space-y-4` rule violation | Rejected |
| Alert/Badge for success/duplicate hints | Richer semantics; risks breaking `getByText`/element queries | Rejected — keep `<p>` elements, change classes only |
| Dismiss as outline Button vs raw button | Minor churn; removes custom border classes | **Chosen**: `variant="outline" size="sm"` |

Validation wiring: `data-invalid` on `Field`, `aria-invalid` on `Input` only when `error` set — visual only, no flow change. Success diagnosis element untouched except token class if needed.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/ui/field.tsx` | Create (via CLI) | FieldGroup/Field/FieldLabel primitives |
| `src/components/RegisterForm.tsx` | Modify | JSX swap only (~60 lines); imports + classes; zero logic |
| `src/components/RegisterForm.test.tsx` | Unchanged (frozen) | Gate: must pass as-is |

## Class Mapping (old → new)

| Old | New |
|---|---|
| `form.space-y-4` | `<FieldGroup>` (gap-based, no class) |
| `div > label.block...` + `input.mt-1...border` | `<Field>` + `<FieldLabel htmlFor>` + `<Input>` |
| `p.text-red-600` (`role=alert`) | `p.text-destructive` + `role="alert"` kept |
| `p.text-green-700` (success) | Keep element; `text-success`-ish semantic token only if theme defines it, else leave minimal change |
| `p.text-amber-700` (duplicate) | Semantic warning token; dismiss `button.rounded.border` → `<Button variant="outline" size="sm">` |
| `button.bg-blue-600...text-white` | `<Button type="submit">` (default variant) |

Imports use existing `@/` alias; follow `ui/button.tsx` + `ui/input.tsx` patterns.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Existing suite | `RegisterForm.test.tsx` unchanged | Gate: full pass, no query/text edits |
| Gate grep | No `space-y-*`, `text-red-600`, `bg-blue-600` in RegisterForm | `rg` check in tasks/verify |
| Manual | Labels linked, alert announced, dismiss works | Quick render check |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration, no flag. Rollback: `git checkout -- src/components/RegisterForm.tsx`; delete `ui/field.tsx` if newly added; rerun tests.

## Open Questions

- None blocking. Minor: exact success/warning token names depend on theme — resolve at apply time from CSS variables.
