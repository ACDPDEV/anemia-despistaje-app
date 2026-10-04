import { usePadronStore } from "../stores/padronStore";
import { useOnline } from "../hooks/useOnline";

// Quiet shell status: pending-to-sync count plus connectivity.
// Read-only on purpose: the store exposes no safe sync action and
// lib/sync.ts push/pull need table wiring plus syncGuard call-site logic,
// so there is no existing sync action to reuse as-is for a button.
// Spanish copy, theme tokens, no animation.
export function SyncStatusChip() {
  const pacientes = usePadronStore((s) => s.pacientes);
  const online = useOnline();
  // Dirty rows (tombstones included) are the pending queue.
  const pending = pacientes.filter((p) => p.dirty).length;

  const text = !online
    ? `Sin conexión · ${pending} pendientes`
    : pending > 0
      ? `${pending} por sincronizar`
      : "A salvo en este equipo";

  return (
    <p
      data-testid="sync-status-chip"
      role="status"
      className="truncate px-2 text-xs text-muted-foreground"
    >
      {text}
    </p>
  );
}
