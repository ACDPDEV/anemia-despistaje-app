// Call-site guard for the manual sync (Unit 3 buttons). sync.ts is untouched:
// this module only wraps pushDirty/pullRemote at the future call site so no
// auto-sync or signature change leaks into the offline-first core.
//
// Future Unit-3 button binding (disabled while a sync is in flight):
//   import { isSyncing, runGuarded } from "./lib/syncGuard";
//   import { pushDirty } from "./lib/sync";
//   const [syncing, setSyncing] = useState(isSyncing);
//   useEffect(() => subscribeSyncState(() => setSyncing(isSyncing)), []);
//   <button disabled={syncing} onClick={() => runGuarded(() => pushDirty(...))}>
//     {syncing ? SYNCING_LABEL : "Sincronizar"}
//   </button>
// The plain `disabled={isSyncing}` read works for the initial render; the
// subscribeSyncState line above is the minimal reactive upgrade (no zustand)
// so the button re-renders when the flag flips.
//
// User-facing copy is Spanish; code and comments stay in English.
import { pullRemote, type PullOutcome, type SyncTable } from "./sync";
import type { Paciente } from "../stores/padronStore";

// Label shown on the future sync button while a sync is running.
export const SYNCING_LABEL = "Sincronizando…";
// Message returned when a pull lands inside the cooldown window.
export const PULL_COOLDOWN_MESSAGE =
  "La sincronización está actualizada. Inténtalo de nuevo en unos segundos.";
// Message returned when a second sync is attempted while one is in flight.
export const SYNC_BUSY_MESSAGE = "Sincronizando… Espera a que termine la sincronización en curso.";
// Prefix for the "last sync Xs ago" label; use formatLastSyncAgo for the full text.
export const LAST_SYNC_PREFIX = "Última sincronización hace";

// Full "Última sincronización hace Xs" label for a given elapsed second count.
export function formatLastSyncAgo(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  return `${LAST_SYNC_PREFIX} ${clamped}s`;
}

// Default minimum gap between two remote pulls.
export const DEFAULT_PULL_COOLDOWN_MS = 20000;

// In-flight flag for the manual sync. Module-level boolean on purpose: the
// codebase keeps sync state in plain modules (see supabase.ts lazy client)
// and sync is MANUAL-only with no UI wired yet, so no store is needed.
export let isSyncing = false;

// Timestamp (ms, same clock as the `now` args below) of the last pull that
// really hit the remote. Null until the first successful pull.
export let lastPullAt: number | null = null;

// Reactive payload: sync flag plus last-pull timestamp so the receipt line
// can update live after a sync completes.
export interface SyncState {
  isSyncing: boolean;
  lastPullAt: number | null;
}

type Listener = (state: SyncState) => void;
const listeners = new Set<Listener>();

function notify(): void {
  const state: SyncState = { isSyncing, lastPullAt };
  for (const listener of listeners) listener(state);
}

function setSyncing(value: boolean): void {
  isSyncing = value;
  notify();
}

// Minimal reactive seam for the future Unit-3 buttons (zustand-free).
// Returns an unsubscribe function; pairs with the usage example above.
export function subscribeSyncState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type GuardedSkipped = { skipped: "in-flight" };
export type GuardedValue<T> = { skipped: false; value: T };
export type GuardedResult<T> = GuardedSkipped | GuardedValue<T>;

// Runs fn unless a sync is already in flight. The flag is always cleared via
// try/finally so a throw never wedges future buttons in disabled state.
export async function runGuarded<T>(fn: () => Promise<T>): Promise<GuardedResult<T>> {
  if (isSyncing) return { skipped: "in-flight" };
  setSyncing(true);
  try {
    const value = await fn();
    return { skipped: false, value };
  } finally {
    setSyncing(false);
  }
}

// True when `now` falls inside the cooldown window opened by the last pull.
// Pure and clock-injectable so tests never depend on wall time.
export function shouldSkipPull(now: number = Date.now(), cooldownMs: number = DEFAULT_PULL_COOLDOWN_MS): boolean {
  if (lastPullAt === null) return false;
  return now - lastPullAt < cooldownMs;
}

// Opens/refreshes the pull cooldown window at `now`. Notifies subscribers
// so the timestamp receipt re-reads lastPullAt live after a sync completes.
export function recordPull(now: number = Date.now()): void {
  lastPullAt = now;
  notify();
}

export interface GuardedPullOptions {
  now?: number;
  cooldownMs?: number;
}

export type GuardedPullResult = PullOutcome & { skipped?: "cooldown" | "in-flight" };

// Pull guarded by both the cooldown window and the in-flight flag. Within the
// window the table is never touched (0 fetchAll calls). The window only moves
// after a pull that really succeeded (ok: true), so offline/unconfigured
// attempts never start the cooldown. Push keeps its existing skip-when-clean
// in pushDirty; nothing is added here on purpose.
export async function guardedPull(
  local: Paciente[],
  table: SyncTable | null,
  isOnline: boolean,
  options: GuardedPullOptions = {},
): Promise<GuardedPullResult> {
  const now = options.now ?? Date.now();
  const cooldownMs = options.cooldownMs ?? DEFAULT_PULL_COOLDOWN_MS;

  if (shouldSkipPull(now, cooldownMs)) {
    return { ok: true, merged: local, message: PULL_COOLDOWN_MESSAGE, skipped: "cooldown" };
  }

  const result = await runGuarded(() => pullRemote(local, table, isOnline));
  if ("skipped" in result && result.skipped === "in-flight") {
    return { ok: false, merged: local, message: SYNC_BUSY_MESSAGE, skipped: "in-flight" };
  }

  const outcome = (result as GuardedValue<PullOutcome>).value;
  if (outcome.ok) recordPull(now);
  return outcome;
}

// Test-only seam: clears the in-flight flag, the cooldown timestamp, and any
// subscribers so suites stay isolated.
export function resetSyncGuardForTests(): void {
  isSyncing = false;
  lastPullAt = null;
  listeners.clear();
}
