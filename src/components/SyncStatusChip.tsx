import { useEffect, useRef, useState } from "react";
import { usePadronStore } from "../stores/padronStore";
import { useOnline } from "../hooks/useOnline";
import { createSupabaseSyncTable, pushDirty } from "../lib/sync";
import { getSupabaseClient } from "../lib/supabase";
import {
  guardedPull,
  isSyncing,
  runGuarded,
  subscribeSyncState,
  SYNC_BUSY_MESSAGE,
  SYNCING_LABEL,
} from "../lib/syncGuard";
import { Button } from "./ui/button";

// Quiet footer chip: pending-to-sync count plus connectivity, now with the
// first honest sync call-site. Push runs through runGuarded, pull through
// guardedPull (cooldown + in-flight); sequential on purpose because
// guardedPull re-enters runGuarded and would report in-flight inside it.
// Spanish copy, theme tokens, no animation, no toasts: failure speaks
// through an inline message with a retry action.
export function SyncStatusChip() {
  const pacientes = usePadronStore((s) => s.pacientes);
  const online = useOnline();
  const [syncing, setSyncing] = useState(isSyncing);
  // Last sync failure, kept visible until the next attempt starts.
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const unsubscribe = subscribeSyncState(() => {
      if (alive.current) setSyncing(isSyncing);
    });
    return () => {
      alive.current = false;
      unsubscribe();
    };
  }, []);

  // Dirty rows (tombstones included) are the pending queue.
  const pending = pacientes.filter((p) => p.dirty).length;

  const text = !online
    ? `Sin conexión · ${pending} pendientes`
    : pending > 0
      ? `${pending} por sincronizar`
      : "A salvo en este equipo";

  function fail(message: string): void {
    if (alive.current) setError(message);
  }

  async function handleSync(): Promise<void> {
    if (!online || isSyncing) return;
    if (alive.current) setError(null);
    const client = getSupabaseClient();
    const table = client ? createSupabaseSyncTable(client) : null;
    const snapshot = usePadronStore.getState().pacientes;

    // Push first so local edits reach the remote before the pull merge.
    let pushedIds: string[];
    try {
      const pushOutcome = await runGuarded(() =>
        pushDirty(snapshot, table, online),
      );
      if (pushOutcome.skipped === "in-flight") {
        fail(SYNC_BUSY_MESSAGE);
        return;
      }
      if (!pushOutcome.value.ok) {
        fail(pushOutcome.value.message);
        return;
      }
      pushedIds = pushOutcome.value.pushedIds;
    } catch (err) {
      fail(
        err instanceof Error
          ? err.message
          : "No se pudo sincronizar. Inténtalo de nuevo.",
      );
      return;
    }

    const { applyPullMerge, markSynced, purgeSyncedTombstones } =
      usePadronStore.getState();
    if (pushedIds.length > 0) markSynced(pushedIds);
    // Replicated tombstones are now clean and safe to collect.
    purgeSyncedTombstones();

    try {
      const pull = await guardedPull(
        usePadronStore.getState().pacientes,
        table,
        online,
      );
      if (!alive.current) return;
      if (!pull.ok) {
        setError(pull.message);
        return;
      }
      // Cooldown hits (ok, skipped) carry no fresh rows: nothing to apply.
      if (!pull.skipped) applyPullMerge(pull.merged);
    } catch (err) {
      fail(
        err instanceof Error
          ? err.message
          : "No se pudo sincronizar. Inténtalo de nuevo.",
      );
    }
  }

  // Offline is text only; the button appears for pending work, while a
  // sync runs, and to retry after a failure.
  const showAction = online && (pending > 0 || error !== null || syncing);
  const buttonLabel = syncing ? SYNCING_LABEL : error !== null ? "Reintentar" : "Sincronizar";
  // Mirrors the full status so the collapsed (icon-only) sidebar clipping
  // stays discoverable through the native tooltip.
  const title = error ? `${text} · ${error}` : text;

  return (
    <div data-testid="sync-status-chip" title={title} className="flex flex-col gap-1 px-2">
      <div className="flex items-center gap-2">
        <p
          role="status"
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
        >
          {text}
        </p>
        {showAction && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={syncing}
            onClick={() => void handleSync()}
          >
            {buttonLabel}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
