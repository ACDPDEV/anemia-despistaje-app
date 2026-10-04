// BrandLockup: the single authored identity touch for this clinical tool.
// A severity-dot motif (Normal → Leve → Moderada → Severa, the same triage
// order the dashboard charts use) beside a compact wordmark. Theme tokens
// only, no logo asset, no marketing: four 6px dots that read as triage at
// a glance. Shared by the sidebar header and the login card so the mark
// has exactly one source of truth.
export function BrandLockup() {
  return (
    <span data-testid="brand-lockup" className="flex items-center gap-2 px-2">
      <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
        <span className="size-1.5 rounded-full bg-[var(--color-severity-normal)]" />
        <span className="size-1.5 rounded-full bg-[var(--color-severity-mild)]" />
        <span className="size-1.5 rounded-full bg-[var(--color-severity-moderate)]" />
        <span className="size-1.5 rounded-full bg-[var(--destructive)]" />
      </span>
      <span className="truncate text-sm font-semibold">
        Despistaje{" "}
        <span className="font-normal text-muted-foreground">de Anemia</span>
      </span>
    </span>
  );
}
