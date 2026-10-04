# Proposal: form-polish

## Intent

RegisterForm uses hand-rolled layout/colors; migrate to shadcn Field idiom with semantic tokens for a11y consistency. Behavior and Spanish copy frozen.

## Scope

### In Scope
- JSX swap: FieldGroup + Field + FieldLabel + Input + Button
- Semantic tokens (`text-destructive` etc.), `aria-invalid` wiring
- `shadcn add field` for missing `ui/field.tsx`

### Out of Scope
- Validation, duplicate logic, store, copy changes
- Other forms/views restyle

## Capabilities

### New Capabilities
- `form-a11y-polish`: FieldGroup idiom + semantic tokens + alert roles on RegisterForm

### Modified Capabilities
- None

## Approach

Approach 1 from exploration: add `field` primitive via CLI, then swap `form.space-y-4` → FieldGroup, each `div` → Field + FieldLabel + Input, error keeps `role=alert` with `text-destructive`, submit/dismiss → Button variants. Keep labels/names verbatim; tests unchanged.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/RegisterForm.tsx` | Modified | JSX-only swap (~100 lines), no logic |
| `src/components/ui/field.tsx` | New | Via `shadcn add field` |
| `src/components/RegisterForm.test.tsx` | Unchanged | Must pass as-is |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CLI pulls extra deps | Med | Review diff before accept |
| Query breakage from element change | Low | Keep elements/text, classes only |
| Validation flow altered | Low | Visual-only `aria-invalid` |

## Rollback Plan

`git checkout -- src/components/RegisterForm.tsx`; delete `ui/field.tsx` if added; rerun tests.

## Dependencies

- `shadcn add field` must succeed first

## Success Criteria

- [ ] No `space-y-*`/raw red/green/blue classes in RegisterForm
- [ ] Existing RegisterForm tests pass unchanged
- [ ] Labels, `role=alert`, button names preserved
