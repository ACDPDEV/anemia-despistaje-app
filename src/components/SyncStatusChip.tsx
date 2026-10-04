import { useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { usePadronStore } from "../stores/padronStore";
import { useOnline } from "../hooks/useOnline";
import { createSupabaseSyncTable, filterUnchangedIds, pushDirty } from "../lib/sync";
import { getSupabaseClient } from "../lib/supabase";
import {
  formatLastSyncAgo,
  guardedPull,
  isSyncing,
  lastPullAt,
  runGuarded,
  subscribeSyncState,
  SYNC_BUSY_MESSAGE,
  SYNCING_LABEL,
} from "../lib/syncGuard";
import { Button } from "./ui/button";
import { toSpanishErrorMessage } from "../lib/errorMessages";

// Quiet footer chip: pending-to-sync count plus connectivity, now with the
// first honest sync call-site. Push runs through runGuarded, pull through
// guardedPull (cooldown + in-flight); sequential on purpose because
// guardedPull re-enters runGuarded and would report in-flight inside it.
// Spanish copy, theme tokens, no animation, no toasts: failure speaks
// through an inline message with a retry action. Collapsed (icon-width
// sidebar) renders an icon-with-badge plus the title tooltip so the footer
// never clips; the full text, receipt, and error lines return expanded.
export function SyncStatusChip({ collapsed = false }: { collapsed?: boolean }) {
  const pacientes = usePadronStore((s) => s.pacientes);
  const online = useOnline();
  const [syncing, setSyncing] = useState(isSyncing);
  // Last-sync receipt: mirrors lastPullAt live so the second line updates
  // right after a sync completes. Null until the first successful pull.
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(lastPullAt);
  // Receipt freshness: adaptive tick — fast (5s) while the receipt is
  // under a minute old, gentle (30s) after. The first minute after a sync
  // is the trust-forming moment ("hace 4s" going stale for 30s reads
  // broken), so the chip spends a few extra renders there and backs off
  // once the receipt escalates to minutes. Chained setTimeout (not a fixed
  // interval) so each tick re-reads lastSyncAt and the cadence relaxes on
  // its own; cleanup on unmount. Interval over window-focus on purpose:
  // the chip sits in the sidebar through long field sessions where the
  // window never blurs.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const elapsedMs =
      lastSyncAt === null ? Number.POSITIVE_INFINITY : Date.now() - lastSyncAt;
    const delay = elapsedMs < 60_000 ? 5000 : 30000;
    const timer = window.setTimeout(() => setTick((t) => t + 1), delay);
    return () => window.clearTimeout(timer);
  }, [lastSyncAt, tick]);
  // Last sync failure, kept visible until the next attempt starts.
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const unsubscribe = subscribeSyncState(() => {
      if (alive.current) {
        setSyncing(isSyncing);
        setLastSyncAt(lastPullAt);
      }
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
      : lastSyncAt === null
        ? "Guardado en este equipo · sin sincronizar"
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
          ? toSpanishErrorMessage(err.message)
          : "No se pudo sincronizar. Inténtalo de nuevo.",
      );
      return;
    }

    const { applyPullMerge, markSynced, purgeSyncedTombstones } =
      usePadronStore.getState();
    // Interleave window, proven safe by merge + this guard. Push and pull
    // run in two runGuarded acquisitions, so an edit can land in between.
    // The pull side is benign: mergePacientes is last-write-wins on
    // updatedAt, so a mid-flight edit (newer updatedAt) survives the merge
    // and stays dirty for the next push. The push side was NOT: markSynced
    // clears by id, so an edit to a just-pushed row would lose its dirty
    // flag and never replicate. Only ids whose updatedAt still matches the
    // pre-push snapshot go clean; edited rows keep dirty=true.
    if (pushedIds.length > 0) {
      const unchanged = filterUnchangedIds(
        snapshot,
        usePadronStore.getState().pacientes,
        pushedIds,
      );
      if (unchanged.length > 0) markSynced(unchanged);
    }
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
          ? toSpanishErrorMessage(err.message)
          : "No se pudo sincronizar. Inténtalo de nuevo.",
      );
    }
  }

  // Offline is text only; the button appears for pending work, while a
  // sync runs, and to retry after a failure.
  const showAction = online && (pending > 0 || error !== null || syncing);
  const buttonLabel = syncing ? SYNCING_LABEL : error !== null ? "Reintentar" : "Sincronizar";
  // Honest receipt line: the formatter owns the s/min/h escalation, so
  // compose with it directly. Never-synced shows no lie — a quiet
  // "Sin sincronizar aún". Date.now() reads fresh on every render, and the
  // adaptive tick above keeps it moving while mounted.
  const receipt =
    lastSyncAt === null
      ? "Sin sincronizar aún"
      : formatLastSyncAgo(Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000)));
  // Mirrors the full status so the collapsed (icon-only) sidebar clipping
  // stays discoverable through the native tooltip.
  const title = error ? `${text} · ${error}` : `${text} · ${receipt}`;

  // Icon-only form for the collapsed sidebar: same title composition, a
  // pending-count badge, and an accessible name so the status survives
  // without the clipped text lines. The accessible name mirrors the full
  // title (status + receipt), not just the status line.
  if (collapsed) {
    const Icon = !online ? CloudOff : syncing ? RefreshCw : Cloud;
    return (
      <div
        data-testid="sync-status-chip"
        title={title}
        className="flex justify-center py-1"
      >
        <span className="relative inline-flex" role="status" aria-label={title}>
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {pending > 0 && (
            <span
              data-testid="sync-pending-badge"
              aria-hidden="true"
              className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-medium text-primary-foreground tabular-nums"
            >
              {pending}
            </span>
          )}
        </span>
      </div>
    );
  }

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
            className="pointer-coarse:min-h-11"
            disabled={syncing}
            onClick={() => void handleSync()}
          >
            {buttonLabel}
          </Button>
        )}
      </div>
      {/* Receipt line: deliberately NOT a live region. The pending-count
          line above is the chip's single announcer; the receipt re-renders
          on an adaptive tick (every 5s while fresh), so a role="status"
          here would announce "hace 5s… hace 10s…" unattended. Screen
          readers reach the receipt on demand; the collapsed icon carries
          the same receipt inside its accessible name. */}
      <p
        data-testid="sync-receipt"
        className="truncate text-[11px] text-muted-foreground"
      >
        {receipt}
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
