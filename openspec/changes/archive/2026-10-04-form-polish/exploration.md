## Exploration: form-polish (RegisterForm shadcn idiom migration)

### Current State
`src/components/RegisterForm.tsx` (122 lines) is hand-rolled markup: `form.space-y-4`, three `div > label + input` blocks with `mt-1 w-full rounded border`, error `p[role=alert].text-red-600`, success `p.text-green-700`, duplicate hint `div.flex + p.text-amber-700 + button.rounded.border`, submit `button.bg-blue-600`. Logic (validation, `findPossibleDuplicates` warning-only, store `add`, Spanish copy) is behavior-frozen. Precedent: `PadronView.tsx:340` already uses semantic `text-destructive`; `ui/button.tsx`, `ui/input.tsx`, `ui/badge.tsx` exist with semantic tokens. No `ui/field.tsx` — `FieldGroup`/`Field`/`FieldLabel` are missing and must be added via CLI.

### Affected Areas
- `src/components/RegisterForm.tsx` — full JSX swap to FieldGroup+Field+FieldLabel, Input, Button; error to semantic token; no logic change.
- `src/components/ui/field.tsx` (new, via `shadcn add field`) — required dependency.
- `src/components/RegisterForm.test.tsx` — must keep passing unchanged (label queries, `role=alert`, button names).

### Approaches
1. **FieldGroup + Field + Input + Button (recommended)** — `FieldGroup` wraps 3 `Field > FieldLabel + Input`; error `p` keeps `role=alert` with `text-destructive`; submit becomes default `Button`; dismiss becomes `outline`/`ghost` small `Button`.
   - Pros: Matches shadcn forms rule exactly; removes all `space-y-*`/raw colors; accessible `data-invalid`/`aria-invalid` on error path.
   - Cons: Requires `shadcn add field` first; minor import churn.
   - Effort: Low
2. **Minimal token swap only (no Field primitives)** — Replace raw colors with semantic tokens, keep `div` layout.
   - Pros: No CLI dependency; smaller diff.
   - Cons: Violates FieldGroup+Field rule; leaves `space-y-4` violation in place.
   - Effort: Low

### Recommendation
Approach 1. Add `field` via CLI, then migrate: `form.space-y-4` → `FieldGroup`; each `div` → `Field` + `FieldLabel(htmlFor)` + `Input(aria-invalid when error)`; error → `text-destructive` keeping `role="alert"`; success/duplicate → semantic tokens or `Badge`/`Alert` only if trivial; submit → `<Button type="submit">`, dismiss → `<Button variant="outline" size="sm">`. Preserve all labels, `role=alert`, and button names verbatim.

### Risks
- `field` CLI add may pull extra deps — verify diff before accepting.
- Over-styling (Alert/Badge for success/duplicate) could break `getByText` queries — keep same elements/text, change classes only.
- `aria-invalid`/`data-invalid` wiring must not alter validation flow — visual only.

### Ready for Proposal
Yes — scope is a single-file JSX swap with frozen behavior; proceed to proposal.
