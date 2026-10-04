import { useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { usePadronStore } from "../stores/padronStore";
import { useOnline } from "../hooks/useOnline";
import { createSupabaseSyncTable, filterUnchangedIds, pushDirty } from "../lib/sync";
import { getSupabaseClient } from "../lib/supabase";
import {
  clearSyncError,
  clearSyncNotice,
  formatLastSyncAgo,
  formatSyncOffline,
  formatSyncPending,
  guardedPull,
  isSyncing,
  lastPullAt,
  lastSyncError,
  lastSyncNotice,
  recordSyncError,
  recordSyncNotice,
  runGuarded,
  subscribeSyncState,
  SYNC_BUSY_MESSAGE,
  SYNC_NEVER_SYNCED_RECEIPT,
  SYNC_STATUS_SAFE,
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
// sidebar) renders an icon-with-badge plus the title tooltip plus a sync
// icon button (same action, Alt+G) so the footer never clips and never
// loses the sync path; the full text, receipt, and error lines return
// expanded. The state + handler live in useSyncAction (shared with the
// phone-only Padrón row) and the text-button JSX in SyncActionButton, so
// no surface duplicates sync behavior.
// Shared sync state + sync handler for every sync surface: the footer
// chip below (expanded + collapsed) and the phone-only rows (Registro,
// Padrón, Panel — PhoneSyncRow). One hook so the surfaces can never
// disagree on pending text, enabled grammar, or vocabulary; the last error
// lives in the syncGuard module (recordSyncError/clearSyncError) so a
// failure on one surface appears on every other surface. Every rendered
// action carries data-sync-action, so the Alt+G shell query fires
// whichever instance it finds first: the sidebar Sheet content unmounts
// when closed (the mounted view's phone row wins), and with the Sheet open
// the sidebar instance comes first in DOM order while the phone row hides
// behind sm:hidden — the query always lands on a working, visible button
// running this same guarded handler.
export type SyncAction = {
  online: boolean;
  pending: number;
  syncing: boolean;
  error: string | null;
  text: string;
  displayText: string;
  receipt: string;
  title: string;
  showAction: boolean;
  buttonLabel: string;
  handleSync: () => Promise<void>;
};

export function useSyncAction(): SyncAction {
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
  // Last sync failure: the module-owned lastSyncError, mirrored live so
  // every surface announces the same string and clears together.
  const [error, setError] = useState<string | null>(lastSyncError);
  // Last sync outcome note (success or cooldown skip): the module-owned
  // lastSyncNotice, mirrored live like the error so every surface voices
  // the same line (run-30 P1-b). Rendered through the existing single
  // role=status announcer below, never the ticking receipt.
  const [notice, setNotice] = useState<string | null>(lastSyncNotice);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const unsubscribe = subscribeSyncState((state) => {
      if (alive.current) {
        setSyncing(isSyncing);
        setLastSyncAt(lastPullAt);
        setError(state.lastSyncError);
        setNotice(state.lastSyncNotice);
      }
    });
    return () => {
      alive.current = false;
      unsubscribe();
    };
  }, []);

  // Dirty rows (tombstones included) are the pending queue.
  const pending = pacientes.filter((p) => p.dirty).length;

  // Stale-notice guard (run-31 P1): when the queue goes from empty to
  // non-empty, the last outcome note stops describing the world — drop it
  // so the pending line wins (sync → register must read "1 por
  // sincronizar", never the old congratulation). Only the 0→>0 edge
  // clears: rows that stay dirty through a sync keep that sync's own
  // note, and failures already clear via fail(). clearSyncNotice notifies
  // only when a note stands, so no render loop (this effect reruns on
  // pending alone, never on the notice it clears).
  const prevPending = useRef(pending);
  useEffect(() => {
    if (prevPending.current === 0 && pending > 0) clearSyncNotice();
    prevPending.current = pending;
  }, [pending]);

  const text = !online
    ? formatSyncOffline(pending)
    : pending > 0
      ? formatSyncPending(pending)
      : SYNC_STATUS_SAFE;

  function fail(message: string): void {
    // Module-owned: notifies, so the failing surface AND every other
    // mounted surface show the identical string (no per-instance drift).
    // A stale success/cooldown note clears first so it never lingers
    // beside the alert.
    clearSyncNotice();
    recordSyncError(message);
  }

  async function handleSync(): Promise<void> {
    if (!online || isSyncing) return;
    // A retry starts: clear the shared error first so every surface drops
    // its alert line together (success clears it too, via the same path).
    clearSyncError();
    const client = getSupabaseClient();
    const table = client ? createSupabaseSyncTable(client) : null;
    const snapshot = usePadronStore.getState().pacientes;

    // Push first so local edits reach the remote before the pull merge.
    let pushedIds: string[];
    let pushMessage: string;
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
      pushMessage = pushOutcome.value.message;
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
        clearSyncNotice();
        recordSyncError(pull.message);
        return;
      }
      // Cooldown hits (ok, skipped) carry no fresh rows: nothing to apply —
      // but the skip still speaks (run-30 P1-b): a second tap inside the
      // cooldown window used to render nothing (dead button on slow links),
      // and the push/pull success lines were computed then discarded.
      // Success voices that already-computed module vocabulary, one honest
      // line through the existing announcer: the push confirmation when
      // local edits replicated, else the pull message. Behind a push the
      // cooldown clause stays silent — the push confirmation already proves
      // freshness, so joining the cooldown line only buries the outcome.
      // The ticking receipt stays non-live, so the note announces exactly
      // once per sync action.
      if (pull.skipped === "cooldown") {
        recordSyncNotice(pushedIds.length > 0 ? pushMessage : pull.message);
        return;
      }
      applyPullMerge(pull.merged);
      recordSyncNotice(pushedIds.length > 0 ? pushMessage : pull.message);
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
  // compose with it directly. Never-synced shows no lie — the shared
  // "Aún sin sincronizar" (one vocabulary with the print header). Date.now()
  // reads fresh on every render, and the adaptive tick above keeps it moving
  // while mounted.
  const receipt =
    lastSyncAt === null
      ? SYNC_NEVER_SYNCED_RECEIPT
      : formatLastSyncAgo(Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000)));
  // The chip's single announcer: live connectivity outranks the last
  // outcome note — offline the pending/safe status always wins over a
  // standing congratulation (a mid-jornada signal loss must never keep
  // congratulating), and the stored notice survives underneath so it may
  // speak again on reconnect. Online, the last outcome note (success/
  // cooldown) wins when one stands, else the pending/safe status. A stale
  // note never covers NEW dirty rows (run-31 P1): the transition effect
  // below clears the notice when the queue goes 0→>0, so after sync →
  // register the pending line wins. Static between sync actions, so
  // receipt ticks never re-announce it.
  const displayText = !online ? text : (notice ?? text);
  // Mirrors the full status so the collapsed (icon-only) sidebar clipping
  // stays discoverable through the native tooltip.
  const title = error ? `${displayText} · ${error}` : `${displayText} · ${receipt}`;

  return { online, pending, syncing, error, text, displayText, receipt, title, showAction, buttonLabel, handleSync };
}

// Shared sync button (expanded chip + phone rows): same tag, same
// shortcut, same disabled grammar. The collapsed chip keeps its own
// icon-button JSX (different visual) but the same tag + hook handler.
// run-28 P3-1 (polish, documented skip): the busy label (SYNCING_LABEL)
// stays label-only with no spinner — no Loader2/animate-spin precedent
// exists, and this chip is pinned "no animation" by design (quiet sync
// surface; craft-floor refuses scattered motion as decoration).
export function SyncActionButton({
  label,
  syncing,
  onSync,
}: {
  label: string;
  syncing: boolean;
  onSync: () => Promise<void>;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      data-sync-action="true"
      className="pointer-coarse:min-h-11"
      disabled={syncing}
      aria-keyshortcuts="Alt+G"
      title={`${label} (Alt+G)`}
      onClick={() => void onSync()}
    >
      {label}
    </Button>
  );
}

// Phone-only sync row shared by Registro, Padrón, and Panel: the sidebar
// footer (with the sync chip) hides inside the hamburger Sheet on phones,
// so each view renders sync on its first screen — compact status text plus
// the shared sync action, quiet when clean + online like the chip.
// sm:hidden keeps it off desktop (the footer chip owns that surface);
// print:hidden keeps it off paper. Failure speaks through a compact
// role="alert" line rendering the SAME module error string as the chip's
// alert (one syncGuard source, one vocabulary — never a copied string),
// styled identically (text-xs text-destructive). testId is view-scoped
// (register/padron/dashboard-sync-phone) so pins stay per-view while the
// structure stays identical. Only one view mounts at a time (tab switch
// unmounts), so at most one phone action shares the DOM with the sidebar
// chip — the Alt+G shell query always resolves first-in-DOM-order to a
// working button running the same guarded handler.
// Single announcer per viewport (run-25 P3-1 assessment, no behavior
// change on purpose): at most one of the two role=alert lines is ever
// effectively announced —
// - desktop (≥sm): this row is display:none via sm:hidden, which removes
//   it from the accessibility tree in real browsers, so the chip speaks
//   alone (jsdom has no layout engine and still queries both — the
//   two-alert test pin below is that artifact plus the shared-string
//   invariant, not a second announcement);
// - phone with the Sheet closed: the Sheet portal unmounts (Base UI
//   Dialog keepMounted defaults to false), so the chip is gone and this
//   row speaks alone;
// - phone with the Sheet open: both are mounted, but the Sheet is a modal
//   dialog holding focus while this row sits inert behind it.
// Suppressing this row's alert while the Sheet is open would need
// Sheet-open state plumbed into every view — too invasive for a second
// announcer that no viewport/AT combination effectively hears. The two
// alerts agreeing verbatim (pinned below) is the backstop that keeps the
// co-mounted phone+Sheet-open case honest.
export function PhoneSyncRow({ testId }: { testId: string }) {
  const sync = useSyncAction();
  if (
    sync.pending === 0 &&
    sync.error === null &&
    !sync.syncing &&
    sync.online
  ) {
    return null;
  }
  return (
    <div
      data-testid={testId}
      title={sync.title}
      className="flex flex-col gap-1 sm:hidden print:hidden"
    >
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {sync.displayText}
        </p>
        {sync.showAction && (
          <SyncActionButton
            label={sync.buttonLabel}
            syncing={sync.syncing}
            onSync={sync.handleSync}
          />
        )}
      </div>
      {sync.error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {sync.error}
        </p>
      )}
    </div>
  );
}

export function SyncStatusChip({ collapsed = false }: { collapsed?: boolean }) {
  const {
    online,
    pending,
    syncing,
    error,
    displayText,
    receipt,
    title,
    showAction,
    buttonLabel,
    handleSync,
  } = useSyncAction();

  // Icon-only form for the collapsed sidebar: same title composition, a
  // pending-count badge, and an accessible name so the status survives
  // without the clipped text lines. The accessible name is STATIC between
  // sync actions (status text or the last outcome note, never the ticking
  // receipt): role="status" re-announces on every accessible-name change,
  // so embedding the receipt would read "hace 5s… hace 10s…" unattended
  // every tick. On failure the name carries the error plus the retry
  // affordance ("… . Reintentar disponible") so the collapsed user is
  // never told "A salvo" while rows are dirty; the receipt stays
  // mouse-only in the title tooltip, and on demand in the expanded
  // receipt line below. The sync action survives collapse as an icon button
  // (same handler, same enabled/disabled grammar, Alt+G shortcut) so
  // icon-width users can still sync. A small destructive error dot on the
  // action button gives a non-text failure signal without layout shift;
  // the expanded/mobile error line keeps the single role="alert" so the
  // collapsed name never double-announces.
  // run-29 P3-1 (harden): the receipt also lives on demand for screen
  // readers via aria-describedby on the status AND on the icon action
  // (when rendered), pointing at a visually-hidden sibling span. A
  // description is queried on demand — it never auto-announces — so the
  // 5s/30s receipt ticks cause no re-announce churn, and the live name
  // above stays static. The span sits OUTSIDE the role="status" live
  // region (a text change inside it would announce); it carries no live
  // role of its own.
  if (collapsed) {
    const Icon = !online ? CloudOff : syncing ? RefreshCw : Cloud;
    const collapsedName =
      error !== null ? `${displayText}. ${error}. Reintentar disponible` : displayText;
    return (
      <div
        data-testid="sync-status-chip"
        title={title}
        className="flex flex-col items-center gap-1 py-1"
      >
        <span
          className="relative inline-flex"
          role="status"
          aria-label={collapsedName}
          aria-describedby="sync-receipt-collapsed"
        >
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
        <span id="sync-receipt-collapsed" className="sr-only">
          {receipt}
        </span>
        {showAction && (
          <span className="relative inline-flex">
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              data-sync-action="true"
              className="pointer-coarse:min-h-11"
              disabled={syncing}
              aria-label={buttonLabel}
              aria-describedby="sync-receipt-collapsed"
              aria-keyshortcuts="Alt+G"
              title={`${buttonLabel} (Alt+G) · ${displayText}`}
              onClick={() => void handleSync()}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
            {error !== null && (
              <span
                data-testid="sync-error-dot"
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive"
              />
            )}
          </span>
        )}
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
          {displayText}
        </p>
        {showAction && (
          <SyncActionButton
            label={buttonLabel}
            syncing={syncing}
            onSync={handleSync}
          />
        )}
      </div>
      {/* Receipt line: deliberately NOT a live region. The status line
          above is the chip's single announcer (pending/safe text, or the
          last outcome note after a sync); the receipt re-renders on an
          adaptive tick (every 5s while fresh), so a role="status"
          here would announce "hace 5s… hace 10s…" unattended. Screen
          readers reach the receipt on demand; the collapsed icon keeps a
          STATIC accessible name (status text or outcome note only, plus
          the error + retry affordance while failed) for the same reason,
          with the receipt mouse-only in its title tooltip. */}
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
