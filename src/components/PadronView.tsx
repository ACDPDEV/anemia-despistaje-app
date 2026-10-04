import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  bySeverity,
  findPossibleDuplicates,
  getDuplicateWarning,
  MAX_NOMBRE,
  MAX_PADRON,
  usePadronStore,
  type NewPaciente,
  type Paciente,
} from "../stores/padronStore";
import { normalizeNombre } from "../lib/normalize";
import { buildPadronCsv, padronFilename } from "../lib/padronExport";
import { formatHb } from "../lib/formatHb";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { DIAGNOSIS_BADGE } from "./DashboardView";
import { HB_CUTOFF_LABEL } from "../domain/anemia";
import {
  formatLastSyncAgo,
  formatSyncPending,
  lastPullAt,
  subscribeSyncState,
  SYNC_NEVER_SYNCED_RECEIPT,
  SYNC_STATUS_SAFE,
} from "../lib/syncGuard";
import { useSlidingExpiry } from "../hooks/useSlidingExpiry";
import { XIcon } from "lucide-react";

const COLUMN_COUNT = 6;
// Dismiss grammar (single source of truth; RegisterForm mirrors it):
// - warnings/drafts → "Descartar": duplicate-warning hints here and in
//   the create form acknowledge and dismiss, never delete.
// - armed confirms → "Cancelar": disarms row/bulk delete guards and clean
//   edit cancels; nothing is destroyed.
// - dirty-discard confirm → "Descartar cambios?": the second tap confirms
//   losing an unsaved edit draft (row-switch, filter, Cancelar, Esc).
// - toast dismiss (×) → "Cerrar aviso" (aria-label): drops the notice,
//   the tombstone stays deleted.
// "Deshacer" is recovery, never dismissal: it restores deletes AND edit
// preimages from the same undo stack.
// Quiet capacity signal: the total-registered counter appears once the
// padrón reaches ~80 of the 100-record cap. Total over the full store
// (never the search-filtered visible slice).
const CAPACITY_HINT_MIN = 80;

// Undo toast visibility window after a confirmed delete.
const UNDO_TIMEOUT_MS = 8000;
// Honest undo stack: single-slot silently dropped the earlier net, so keep
// up to 3 pending groups with independent timers; the oldest is evicted
// with an announcement when a fourth lands. The notice lives as long as
// the oldest SURVIVING group (not its own timer): it clears when that
// group is undone/expires, or when the next delete replaces it.
const UNDO_STACK_MAX = 3;
// Honest eviction copy: names what happened (the oldest undo net was
// discarded) and how many nets remain. The count derives from the
// surviving stack at the eviction point, never a hardcoded number, so it
// stays true if UNDO_STACK_MAX ever changes.
export function evictionMessage(remaining: number): string {
  return `Se descartó el deshacer más antiguo; quedan ${remaining} disponibles.`;
}

interface UndoGroup {
  key: number;
  ids: string[];
  label: string;
  // Edit-preimage revert: snapshot of the pre-save values of a Guardar.
  // Undo applies them through update() (dirty requeued, diagnostico
  // recomputed) instead of the delete restore() loop. Same group shape,
  // same 8s sliding timers, same max-3 eviction — one stack, not two.
  editPreimage?: EditPreimage;
}

// Pre-save values captured by the edit row before a successful Guardar.
// The id plus the NewPaciente patch update() needs to re-apply them.
export interface EditPreimage extends NewPaciente {
  id: string;
}

// Filterable register: shadcn Table + single Input filter over nombre.
// Row edit/delete reuse the existing store update/remove selectors.
// Tombstones (deletedAt set) are hidden: remove() is a dirty soft-delete
// kept for sync push, never a visible row (B2).
export function PadronView({
  onEmptyRegister,
}: {
  onEmptyRegister?: () => void;
}) {
  const pacientes = usePadronStore((s) => s.pacientes).filter((p) => !p.deletedAt);
  const restore = usePadronStore((s) => s.restore);
  const remove = usePadronStore((s) => s.remove);
  // Edit-undo revert path: preimages flow back through update(), the same
  // commit path as Guardar (revalidates, recomputes diagnostico, stamps
  // updatedAt, requeues dirty for the next push).
  const update = usePadronStore((s) => s.update);
  // Print-only pending queue: dirty rows (tombstones included) over the full
  // store, not the visible slice. Same stable selector as `pacientes` (the
  // filter runs during render) so the subscription never re-fires on its
  // own derived array. Hooked beside the other selectors so the empty-state
  // early return below never changes the hook order.
  const pendingSyncCount = usePadronStore((s) => s.pacientes).filter(
    (p) => p.dirty,
  ).length;
  // Print-time sync receipt: the paper line reuses the chip vocabulary
  // verbatim (pending count + last-sync receipt, never a divergent third
  // phrasing). Subscribed live so a sync landing while the padrón is open
  // prints the fresh receipt, not a mount-time one.
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(lastPullAt);
  useEffect(() => {
    return subscribeSyncState((state) => setLastSyncAt(state.lastPullAt));
  }, []);
  const [filter, setFilter] = useState("");
  const [gravesPrimero, setGravesPrimero] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bulk selection lives over row ids and SURVIVES filter changes:
  // hidden selections persist but never act. Every bulk consumer (bulk
  // bar count, select-all state, bulk delete, selected export) derives
  // from selected ∩ visible ONLY, so a filtered-out row can never be
  // deleted or exported by a bulk action.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [undoGroups, setUndoGroups] = useState<UndoGroup[]>([]);
  // Honest undo stack (max 3): newest renders on top, each row restores
  // its own ids through the existing per-row restore() loop.
  const [evictionNotice, setEvictionNotice] = useState<string | null>(null);
  // Silent-fuse cue: the sliding 4s auto-disarm is invisible to
  // screen-reader users — they return, press Enter, and re-arm instead of
  // confirming. Only the TIMEOUT expiry announces, through the existing
  // triage status line below (no new announcer): manual disarms
  // (Cancelar, Esc, blur, filter change) need none because the user just
  // acted. Arming clears the notice so the next expiry always changes the
  // text and re-announces. Fuse semantics (activity resets) untouched.
  const [fuseNotice, setFuseNotice] = useState<string | null>(null);
  const notifyFuseExpired = useCallback(() => {
    setFuseNotice("Se canceló la confirmación.");
  }, []);
  const clearFuseNotice = useCallback(() => setFuseNotice(null), []);
  const undoKey = useRef(0);
  const undoTimers = useRef(new Map<number, number>());
  // Which surviving group the eviction notice is tied to: the oldest group
  // that remained after the eviction. Clearing happens in dismissGroup when
  // that key leaves (undo or 8s expiry), or on the next delete (see
  // pushUndoGroup). No independent 4s timer on purpose — the notice must
  // never outlive nothing it describes nor vanish mid-window.
  const evictionTiedKey = useRef<number | null>(null);
  // Armed bulk confirm auto-disarms on a sliding 4s fuse (see hook).
  // Timeout expiry announces through the triage status line; manual
  // disarms (Cancelar, Esc, blur, filter change) stay silent.
  const disarmBulk = useCallback(() => setBulkConfirming(false), []);
  const handleBulkExpire = useCallback(() => {
    disarmBulk();
    notifyFuseExpired();
  }, [disarmBulk, notifyFuseExpired]);
  const { slideProps: bulkSlideProps } = useSlidingExpiry(
    bulkConfirming,
    handleBulkExpire,
  );
  // Shortcut: arming the bulk delete moves focus to Confirmar so Enter
  // completes it; Esc cancels (see bulk effect below).
  const bulkConfirmRef = useRef<HTMLButtonElement>(null);
  const groupsRef = useRef<UndoGroup[]>([]);
  groupsRef.current = undoGroups;
  // Focus + dirty-guard machinery (polish P2-2/P2-3):
  // - sectionRef scopes the post-delete focus fallback chain.
  // - editButtonRefs remembers one Editar button per row so a cancelled
  //   edit can return focus to its origin.
  // - pendingCancelFocusId carries the row whose Editar regains focus
  //   once the edit row unmounts (any close path: cancel, Esc, save).
  // - editDirty mirrors the open edit row's dirty flag so row-switch and
  //   filter gestures can guard instead of silently discarding.
  // - discardSignal nudges the open edit row to arm its in-row
  //   "Descartar cambios?" confirm; pendingPostDiscard remembers what the
  //   discard, once confirmed, must complete (switch or filter).
  // - Stable focus anchor, documented: the nombre filter input while the
  //   table is mounted; the section's first button once it is not (empty
  //   state). Focus never rests on <body> after delete or edit-close.
  const sectionRef = useRef<HTMLElement | null>(null);
  const undoBoxRef = useRef<HTMLDivElement | null>(null);
  const editButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingCancelFocusId = useRef<string | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const [discardSignal, setDiscardSignal] = useState(0);
  const pendingPostDiscard = useRef<
    { type: "switch"; id: string } | { type: "filter"; value: string } | null
  >(null);
  const prevUndoCount = useRef(0);

  // Filter changes disarm a pending bulk confirm (its scope just moved)
  // but never wipe the selection itself: hidden selections persist and
  // the bulk bar count (derived from selected ∩ visible) updates live.
  useEffect(() => {
    disarmBulk();
  }, [filter, disarmBulk]);

  // The 8s undo window is wall-clock per group: each delete pushes its
  // own group with an independent timer; unmount clears all of them.
  useEffect(() => {
    return () => {
      for (const timer of undoTimers.current.values()) window.clearTimeout(timer);
      undoTimers.current.clear();
    };
  }, []);

  // Shortcut: focus Confirmar when the bulk delete arms so Enter confirms.
  useEffect(() => {
    if (bulkConfirming) bulkConfirmRef.current?.focus();
  }, [bulkConfirming]);

  // Post-delete focus: a confirmed delete (single or bulk) always lands an
  // undo group, so focus its newest Deshacer. Fallback chain when the toast
  // is gone: the next row's Editar, else the documented stable anchor
  // (filter input, or the section's first button in the empty state).
  function focusFirstEditOrAnchor(): void {
    const root = sectionRef.current;
    if (!root) return;
    // Prefer the next row's Editar, then the documented stable anchor
    // (the nombre filter), then any enabled button (empty-state
    // "Registrar paciente"). One of them always exists while the section
    // is mounted, so focus never rests on <body>.
    const editar = [...root.querySelectorAll("button")].find(
      (b) => !b.disabled && b.textContent === "Editar",
    );
    if (editar) {
      editar.focus();
      return;
    }
    const filterInput = root.querySelector<HTMLElement>("#padron-filter");
    if (filterInput) {
      filterInput.focus();
      return;
    }
    root.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }

  useEffect(() => {
    if (undoGroups.length > prevUndoCount.current) {
      const newestDeshacer =
        undoBoxRef.current?.querySelector<HTMLButtonElement>("button");
      if (newestDeshacer) newestDeshacer.focus();
      else focusFirstEditOrAnchor();
    }
    prevUndoCount.current = undoGroups.length;
  });

  function dismissGroup(key: number) {
    const timer = undoTimers.current.get(key);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      undoTimers.current.delete(key);
    }
    setUndoGroups((prev) => prev.filter((g) => g.key !== key));
    // The notice is tied to the oldest surviving group's lifetime.
    if (evictionTiedKey.current === key) {
      evictionTiedKey.current = null;
      setEvictionNotice(null);
    }
  }

  // Sliding 8s window per group: pointer/keyboard activity inside a toast
  // row restarts that group's own timer (useSlidingExpiry pattern, kept
  // per-group so concurrent nets stay independent). restore() untouched.
  function resetGroupTimer(key: number) {
    if (!groupsRef.current.some((g) => g.key === key)) return;
    const timer = undoTimers.current.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    undoTimers.current.set(
      key,
      window.setTimeout(() => dismissGroup(key), UNDO_TIMEOUT_MS),
    );
  }

  function pushUndoGroup(ids: string[], label: string, editPreimage?: EditPreimage) {
    undoKey.current += 1;
    const key = undoKey.current;
    const timer = window.setTimeout(() => dismissGroup(key), UNDO_TIMEOUT_MS);
    undoTimers.current.set(key, timer);
    const prev = groupsRef.current;
    if (prev.length >= UNDO_STACK_MAX) {
      const oldest = prev[0];
      const oldestTimer = undoTimers.current.get(oldest.key);
      if (oldestTimer !== undefined) {
        window.clearTimeout(oldestTimer);
        undoTimers.current.delete(oldest.key);
      }
      const next = [...prev.slice(1), { key, ids, label, editPreimage }];
      setUndoGroups(next);
      // Tie the notice to the oldest SURVIVING group (now first).
      evictionTiedKey.current = next[0].key;
      setEvictionNotice(evictionMessage(next.length));
    } else {
      // No eviction: a fresh delete replaces a stale notice.
      evictionTiedKey.current = null;
      setEvictionNotice(null);
      setUndoGroups([...prev, { key, ids, label, editPreimage }]);
    }
  }

  function handleDeleted(id: string, _nombre: string) {
    pushUndoGroup([id], "Paciente eliminado.");
  }
  function handleBulkDeleted(ids: string[]) {
    pushUndoGroup(
      ids,
      ids.length === 1 ? "Paciente eliminado." : `${ids.length} pacientes eliminados.`,
    );
  }

  function handleUndoGroup(key: number) {
    const group = groupsRef.current.find((g) => g.key === key);
    if (!group) return;
    if (group.editPreimage) {
      // Edit revert (never a tombstone restore): pre-save values flow back
      // through the same update() path as Guardar, so diagnostico is
      // recomputed, updatedAt restamps, and the row requeues dirty for the
      // next push. editingId untouched: an open edit keeps its draft (the
      // dirty guard wins over silent replacement).
      const { id, ...patch } = group.editPreimage;
      update(id, patch);
    } else {
      // Same per-row restore path as the single delete, looped: tombstone
      // semantics per row unchanged (deletedAt cleared, dirty requeued).
      for (const id of group.ids) restore(id);
    }
    dismissGroup(key);
  }

  // Edit-save undo: every Guardar snapshots its pre-save values onto the
  // SAME 3-group stack (same timers, same eviction). A save landing while
  // groups exist evicts normally. The savePushedUndo flag suppresses the
  // edit-close focus hop below so focus lands on the newest Deshacer,
  // exactly like deletes; the dirty guard is untouched.
  const savePushedUndo = useRef(false);
  function handleEditSaved(preimage: EditPreimage) {
    savePushedUndo.current = true;
    pushUndoGroup([preimage.id], "Cambios guardados.", preimage);
  }

  // Any edit close (cancel, Esc, save, confirmed discard) returns focus to
  // the originating Editar button when it is still mounted; otherwise the
  // stable anchor. Runs as an effect on editingId so it fires after the
  // edit row unmounts and the Editar button is back in the DOM.
  function closeEditing(focusId: string | null): void {
    pendingPostDiscard.current = null;
    setEditDirty(false);
    pendingCancelFocusId.current = focusId;
    setEditingId(null);
  }

  useEffect(() => {
    if (editingId !== null) return;
    if (savePushedUndo.current) {
      // A Guardar just pushed its undo group: the undo effect above already
      // focused the newest Deshacer. Drop the stale return target so the
      // next close starts clean.
      savePushedUndo.current = false;
      pendingCancelFocusId.current = null;
      return;
    }
    const id = pendingCancelFocusId.current;
    pendingCancelFocusId.current = null;
    if (id === null) return;
    const origin = editButtonRefs.current.get(id);
    if (origin && document.contains(origin)) {
      origin.focus();
      return;
    }
    focusFirstEditOrAnchor();
  }, [editingId]);

  // Row-switch guard: clean edits switch silently (today's behavior);
  // dirty edits arm the open row's in-row "Descartar cambios?" confirm and
  // park the requested row until the discard is confirmed or disarmed.
  function handleRequestEdit(id: string): void {
    if (editingId === null || id === editingId || !editDirty) {
      pendingPostDiscard.current = null;
      setEditingId(id);
      return;
    }
    pendingPostDiscard.current = { type: "switch", id };
    setDiscardSignal((s) => s + 1);
  }

  // Filter guard: explicit filter gestures (typing, Limpiar, Esc) apply
  // directly while the edit is clean, but park behind the same in-row
  // discard confirm while dirty — otherwise the edit row unmounts and the
  // draft dies silently.
  function requestFilter(value: string): void {
    if (editingId !== null && editDirty) {
      pendingPostDiscard.current = { type: "filter", value };
      setDiscardSignal((s) => s + 1);
      return;
    }
    setFilter(value);
  }

  // The open edit row calls back when its discard confirm resolves.
  function handleDiscardConfirm(rowId: string): void {
    const pending = pendingPostDiscard.current;
    pendingPostDiscard.current = null;
    setEditDirty(false);
    if (!pending) {
      closeEditing(rowId);
      return;
    }
    if (pending.type === "switch") {
      // The fresh edit row autofocuses Nombre on mount; no focus call here.
      setEditingId(pending.id);
      return;
    }
    setFilter(pending.value);
    pendingCancelFocusId.current = null;
    setEditingId(null);
    // The user was filtering: land back on the filter input (stable
    // anchor). It lives outside the edit row, so it is mounted already
    // and takes focus synchronously.
    sectionRef.current
      ?.querySelector<HTMLElement>("#padron-filter")
      ?.focus();
  }

  function handleDiscardDisarm(): void {
    // Timeout or "Seguir editando": drop the parked switch/filter, the
    // draft stays open exactly as it was.
    pendingPostDiscard.current = null;
  }

  // Undo toasts render in BOTH branches below: wiping the last visible row
  // lands on the empty state, and each 8s window must survive the crossing.
  // Up to 3 compact rows (newest first), each with its own Deshacer plus a
  // dismiss (×) that drops the notice without restoring (tombstone stays).
  // Small screens: full-width bottom sheet (left+right anchored, no
  // max-width) so the toast never hovers over the row action column.
  // Desktop (sm+): docked bottom-LEFT — the row-action column lives on the
  // right (last table column), so a right-docked toast would cover row
  // actions; left-docking clears them with zero layout shift.
  const undoToast = undoGroups.length > 0 && (
    <div
      role="status"
      data-testid="undo-toast"
      ref={undoBoxRef}
      className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg max-sm:right-4 max-sm:left-4 max-sm:max-w-none sm:right-auto sm:left-4"
    >
      {[...undoGroups].reverse().map((group) => (
        <div
          key={group.key}
          className="flex items-center gap-3"
          onPointerOverCapture={() => resetGroupTimer(group.key)}
          onKeyDownCapture={() => resetGroupTimer(group.key)}
        >
          <p className="text-sm">{group.label}</p>
          <Button type="button" size="sm" onClick={() => handleUndoGroup(group.key)}>
            Deshacer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Cerrar aviso"
            onClick={() => dismissGroup(group.key)}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      ))}
      {evictionNotice && (
        <p className="text-xs text-muted-foreground">{evictionNotice}</p>
      )}
    </div>
  );

  if (pacientes.length === 0) {
    return (
      <section ref={sectionRef} className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Padrón de pacientes</h2>
        {onEmptyRegister ? (
          <>
            <p className="text-sm text-muted-foreground">
              No hay pacientes registrados.
            </p>
            <div>
              <Button type="button" onClick={onEmptyRegister}>
                Registrar paciente
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay pacientes registrados. Use la pestaña Registro para
            agregar el primer paciente.
          </p>
        )}
        {undoToast}
      </section>
    );
  }

  const normalized = normalizeNombre(filter);
  const filtered =
    normalized.length === 0
      ? pacientes
      : pacientes.filter((p) => normalizeNombre(p.nombre).includes(normalized));
  const visible = gravesPrimero ? bySeverity(filtered) : filtered;

  // Stats over the visible set feed the status line, the print header,
  // and the CSV. The on-screen line must never quote global counts while
  // a filter is active, so it derives from `visible` too.
  const visibleModerateSevere = visible.filter(
    (p) => p.diagnostico === "Anemia Moderada" || p.diagnostico === "Anemia Severa",
  ).length;
  const visibleAverageHb =
    visible.length === 0
      ? 0
      : visible.reduce((sum, p) => sum + p.nivelHemoglobina, 0) /
        visible.length;
  // Print-time stamp: print renders from React, so render time IS the
  // honest generation time for a print-to-PDF flow (documented
  // assumption). Fecha + hora anchors the line, and the sync tail reuses
  // the chip vocabulary verbatim (pending count + last-sync receipt, or
  // "Aún sin sincronizar"): the absolute stamp tells the reader when the
  // paper was frozen, so the relative receipt reads against a known
  // moment instead of lying. One date grammar per surface: the paper
  // header speaks es-PE throughout (title date-only, Impreso with time);
  // ISO (YYYY-MM-DD) lives only in padronFilename/CSV machine artifacts.
  const now = new Date();
  const printDate = new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(now);
  const printStamp = new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  // Bulk scope is always selected ∩ visible: select-all covers the
  // filtered set only, never the whole padrón.
  const selectedVisible = visible.filter((p) => selected.has(p.id));
  const allVisibleSelected =
    visible.length > 0 && selectedVisible.length === visible.length;
  const someVisibleSelected =
    selectedVisible.length > 0 && !allVisibleSelected;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      // Deselect only the visible scope: hidden selections persist.
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of visible) next.delete(p.id);
        return next;
      });
    } else {
      // Select the visible scope on top of any hidden selections.
      setSelected((prev) => new Set([...prev, ...visible.map((p) => p.id)]));
    }
  }

  function handleBulkDeleteTap() {
    if (selectedVisible.length === 0) return;
    if (!bulkConfirming) {
      // Arming starts the sliding 4s fuse via the hook effect.
      setBulkConfirming(true);
      clearFuseNotice();
      return;
    }
    setBulkConfirming(false);
    const ids = selectedVisible.map((p) => p.id);
    for (const id of ids) remove(id);
    if (editingId !== null && ids.includes(editingId)) setEditingId(null);
    setEditDirty(false);
    // Scrub only the deleted ids: hidden selections persist untouched.
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    handleBulkDeleted(ids);
  }

  function handleExport() {
    if (visible.length === 0) return;
    const csv = buildPadronCsv(visible, new Date());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = padronFilename(new Date());
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // Same Blob/URL seam as the full export, restricted to the selected ∩
  // visible rows. buildPadronCsv stays pure over any row set, so no CSV
  // format change: only the input rows narrow.
  function handleExportSelected() {
    if (selectedVisible.length === 0) return;
    const csv = buildPadronCsv(selectedVisible, new Date());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = padronFilename(new Date());
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section ref={sectionRef} className="padron-section flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Padrón de pacientes</h2>
        <div className="padron-actions flex gap-2">
          <Button
            type="button"
            onClick={handleExport}
            disabled={visible.length === 0}
          >
            Exportar CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            disabled={visible.length === 0}
          >
            Imprimir
          </Button>
        </div>
      </div>
      {/* Quiet capacity signal (P3): total registered over the full store,
          never the filtered view. Muted microcopy under the title — no
          alarm styling at any count, including 100 de 100 pacientes. */}
      {pacientes.length >= CAPACITY_HINT_MIN && (
        <p
          data-testid="padron-capacity"
          className="text-xs text-muted-foreground"
        >
          {pacientes.length} de {MAX_PADRON} pacientes
        </p>
      )}
      <div className="padron-print-header hidden print:block">
        <p className="text-lg font-semibold">
          Padrón de pacientes — {printDate}
        </p>
        <p className="text-sm">
          Total: {visible.length} · Moderada + Severa:{" "}
          {visibleModerateSevere} · Promedio Hb: {formatHb(visibleAverageHb)}{" "}
          g/dL
        </p>
        <p className="text-sm">
          Impreso: {printStamp} ·{" "}
          {pendingSyncCount > 0
            ? formatSyncPending(pendingSyncCount)
            : SYNC_STATUS_SAFE}{" "}
          ·{" "}
          {lastSyncAt === null
            ? SYNC_NEVER_SYNCED_RECEIPT
            : formatLastSyncAgo(
                Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000)),
              )}
        </p>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        Moderada + Severa (en vista): {visibleModerateSevere} de{" "}
        {visible.length}
        {fuseNotice && <> · {fuseNotice}</>}
      </p>
      <div className="padron-filters flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="padron-filter">Buscar por nombre</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id="padron-filter"
              value={filter}
              onChange={(e) => requestFilter(e.target.value)}
              onKeyDown={(e) => {
                // Escape clears the query; ignore IME composition so the
                // key that confirms composed text never wipes the filter.
                // Guarded while the edit is dirty (see requestFilter).
                if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                  requestFilter("");
                }
              }}
              placeholder="Buscar por nombre…"
            />
            {filter.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => requestFilter("")}
              >
                Limpiar
              </Button>
            )}
          </div>
        </Field>
        <label
          htmlFor="moderados-severos-primero"
          className="flex cursor-pointer items-center gap-2 text-sm font-medium pointer-coarse:min-h-11"
        >
          <Checkbox
            id="moderados-severos-primero"
            checked={gravesPrimero}
            onChange={(e) => setGravesPrimero(e.target.checked)}
          />
          Ver Anemia Moderada y Severa primero
        </label>
      </div>
      {/* Bulk bar: delete + export over selected ∩ visible only. Bulk
          EDIT is deliberately out of scope: per-row editing preserves
          row-level dirty/conflict semantics (each edit revalidates and
          stamps its own updatedAt for the push/pull merge); a bulk editor
          would need per-row conflict surfacing first. Revisit if jornada
          volume demands it. */}
      {selectedVisible.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) disarmBulk();
          }}
          onKeyDownCapture={bulkSlideProps.onKeyDownCapture}
          onPointerOverCapture={bulkSlideProps.onPointerOverCapture}
        >
          <p className="text-sm text-muted-foreground">
            {selectedVisible.length === 1
              ? "1 seleccionado en vista"
              : `${selectedVisible.length} seleccionados en vista`}
          </p>
          {bulkConfirming ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="pointer-coarse:min-h-11"
                ref={bulkConfirmRef}
                aria-label={`Confirmar eliminación de ${selectedVisible.length} pacientes seleccionados`}
                onClick={handleBulkDeleteTap}
                onKeyDown={(e) => {
                  if (e.key === "Escape") disarmBulk();
                }}
              >
                Confirmar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-coarse:min-h-11"
                onClick={disarmBulk}
                onKeyDown={(e) => {
                  if (e.key === "Escape") disarmBulk();
                }}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="pointer-coarse:min-h-11"
                onClick={handleBulkDeleteTap}
              >
                Eliminar seleccionados
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-coarse:min-h-11"
                onClick={handleExportSelected}
              >
                Exportar seleccionados
              </Button>
            </>
          )}
        </div>
      )}
      {/* Mobile select-all (P2-1): the thead (with the header checkbox)
          hides below sm where each row is a stacked card, so the same
          selected ∩ visible scope needs its own phone control. Same state,
          same toggle, same mixed-state grammar as the header checkbox;
          screen-only (print keeps the table header). */}
      <div className="flex items-center gap-2 sm:hidden print:hidden">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium pointer-coarse:min-h-11">
          <Checkbox
            checked={allVisibleSelected}
            ref={(node) => {
              if (node) {
                node.indeterminate =
                  someVisibleSelected && !allVisibleSelected;
              }
            }}
            onChange={toggleAllVisible}
          />
          Seleccionar pacientes visibles
        </label>
      </div>
      <Table className="padron-table">
        <TableCaption className="sr-only">
          Padrón de pacientes — {visible.length} en vista
        </TableCaption>
        <TableHeader className="padron-thead">
          <TableRow>
            <TableHead>
              <label className="flex cursor-pointer items-center gap-2 pointer-coarse:min-h-11">
                <Checkbox
                  checked={allVisibleSelected}
                  ref={(node) => {
                    // Mixed state when only some visible rows are selected.
                    // Inline callback (not an effect: hooks cannot run here,
                    // past the empty-state early return) re-runs each render.
                    if (node) {
                      node.indeterminate =
                        someVisibleSelected && !allVisibleSelected;
                    }
                  }}
                  onChange={toggleAllVisible}
                />
                <span className="sr-only">Seleccionar pacientes visibles</span>
              </label>
            </TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Edad (meses)</TableHead>
            <TableHead>Hemoglobina (g/dL)</TableHead>
            <TableHead>Diagnóstico</TableHead>
            <TableHead className="padron-action-col">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT}>
                Sin resultados para &ldquo;{filter.trim()}&rdquo;.
              </TableCell>
            </TableRow>
          ) : (
            visible.map((p) =>
              p.id === editingId ? (
                <PadronEditRow
                  key={p.id}
                  paciente={p}
                  discardSignal={discardSignal}
                  onDirtyChange={setEditDirty}
                  onDone={() => closeEditing(p.id)}
                  onSaved={handleEditSaved}
                  onDiscardConfirm={() => handleDiscardConfirm(p.id)}
                  onDiscardDisarm={handleDiscardDisarm}
                  onFuseExpire={notifyFuseExpired}
                  onFuseClear={clearFuseNotice}
                />
              ) : (
                <PadronRow
                  key={p.id}
                  paciente={p}
                  selected={selected.has(p.id)}
                  onToggle={() => toggleOne(p.id)}
                  onEdit={() => handleRequestEdit(p.id)}
                  onDeleted={handleDeleted}
                  onFuseExpire={notifyFuseExpired}
                  onFuseClear={clearFuseNotice}
                  editButtonRef={(node) => {
                    if (node) editButtonRefs.current.set(p.id, node);
                    else editButtonRefs.current.delete(p.id);
                  }}
                />
              ),
            ))}
        </TableBody>
      </Table>
      {undoToast}
    </section>
  );
}

function PadronRow({
  paciente,
  selected,
  onToggle,
  onEdit,
  onDeleted,
  editButtonRef,
  onFuseExpire,
  onFuseClear,
}: {
  paciente: Paciente;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeleted: (id: string, nombre: string) => void;
  editButtonRef?: (node: HTMLButtonElement | null) => void;
  // Silent-fuse cue: timeout expiry announces, arming clears.
  onFuseExpire?: () => void;
  onFuseClear?: () => void;
}) {
  const remove = usePadronStore((s) => s.remove);
  const isPossibleDuplicate =
    findPossibleDuplicates(paciente.nombre).length > 1;
  // Two-tap delete guard: the first tap arms the confirm state in place
  // (same button keeps focus), the second tap confirms. Cancelar, Esc,
  // focus leaving the group, or a sliding ~4s fuse disarms with no delete
  // (any keydown/pointerenter inside the group restarts the fuse).
  // Shortcut: arming moves focus to Confirmar so Enter completes the
  // armed delete; Esc already cancels.
  const [confirming, setConfirming] = useState(false);
  const disarm = useCallback(() => setConfirming(false), []);
  // Timeout expiry disarms AND announces (the quiet cue); every manual
  // disarm path below (Cancelar, Esc, blur) calls disarm() directly and
  // stays silent.
  const handleExpire = useCallback(() => {
    disarm();
    onFuseExpire?.();
  }, [disarm, onFuseExpire]);
  const { slideProps } = useSlidingExpiry(confirming, handleExpire);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function handleDeleteTap() {
    if (!confirming) {
      setConfirming(true);
      onFuseClear?.();
      return;
    }
    setConfirming(false);
    remove(paciente.id);
    onDeleted(paciente.id, paciente.nombre);
  }

  return (
    <TableRow>
      <TableCell className="padron-cell-select">
        <label className="flex cursor-pointer items-center gap-2 pointer-coarse:min-h-11">
          <Checkbox checked={selected} onChange={onToggle} />
          <span className="sr-only">Seleccionar a {paciente.nombre}</span>
        </label>
      </TableCell>
      <TableCell className="padron-cell-nombre font-medium">
        {paciente.nombre}
      </TableCell>
      <TableCell className="padron-cell-edad">
        <span className="font-medium sm:hidden print:hidden">
          Edad (meses):{" "}
        </span>
        {paciente.edadMeses}
      </TableCell>
      <TableCell className="padron-cell-hb">
        <span className="font-medium sm:hidden print:hidden">
          Hemoglobina (g/dL):{" "}
        </span>
        {paciente.nivelHemoglobina}
      </TableCell>
      <TableCell className="padron-cell-dx">
        <div className="flex flex-wrap gap-1">
          <Badge variant={DIAGNOSIS_BADGE[paciente.diagnostico]}>
            {paciente.diagnostico}
          </Badge>
          {isPossibleDuplicate && (
            <Badge variant="outline">Posible duplicado</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="padron-action-col">
        <div
          className="flex gap-2"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) disarm();
          }}
          onKeyDownCapture={slideProps.onKeyDownCapture}
          onPointerOverCapture={slideProps.onPointerOverCapture}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="pointer-coarse:min-h-11"
            ref={editButtonRef}
            onClick={onEdit}
          >
            Editar
          </Button>
          {confirming ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="pointer-coarse:min-h-11"
                ref={confirmRef}
                aria-label={`Confirmar eliminación de ${paciente.nombre}`}
                onClick={handleDeleteTap}
                onKeyDown={(e) => {
                  if (e.key === "Escape") disarm();
                }}
              >
                Confirmar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-coarse:min-h-11"
                onClick={disarm}
                onKeyDown={(e) => {
                  if (e.key === "Escape") disarm();
                }}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="pointer-coarse:min-h-11"
              onClick={handleDeleteTap}
            >
              Eliminar
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function PadronEditRow({
  paciente,
  discardSignal,
  onDirtyChange,
  onDone,
  onSaved,
  onDiscardConfirm,
  onDiscardDisarm,
  onFuseExpire,
  onFuseClear,
}: {
  paciente: Paciente;
  // External nudge from the row-switch / filter guards: each increment
  // arms the in-row discard confirm (the parked switch/filter completes
  // only when the user confirms the discard).
  discardSignal: number;
  onDirtyChange: (dirty: boolean) => void;
  onDone: () => void;
  // Fires after a successful Guardar with the pre-save values so the
  // parent can push an edit-preimage undo group. Never fires on discard.
  onSaved?: (preimage: EditPreimage) => void;
  onDiscardConfirm: () => void;
  onDiscardDisarm: () => void;
  // Silent-fuse cue: timeout expiry announces, arming clears.
  onFuseExpire?: () => void;
  onFuseClear?: () => void;
}) {
  const update = usePadronStore((s) => s.update);
  const initialNombre = paciente.nombre;
  const initialEdad = String(paciente.edadMeses);
  const initialHb = String(paciente.nivelHemoglobina);
  const [nombre, setNombre] = useState(initialNombre);
  const [edad, setEdad] = useState(initialEdad);
  const [hb, setHb] = useState(initialHb);
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [edadError, setEdadError] = useState<string | null>(null);
  const [hbError, setHbError] = useState<string | null>(null);
  // Warning-only duplicate signal (P2-3 parity with RegisterForm): same
  // shared helper, same copy. Never blocks: the first Guardar with a
  // duplicate match shows the warning and defers the commit; Descartar
  // acknowledges the current nombre so the next Guardar commits. The
  // dirty-guard flow is untouched — the row stays open either way.
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [dupAckFor, setDupAckFor] = useState<string | null>(null);
  // Dirty-edit guard (harden): any field off its initial value. Clean
  // cancel/Esc/row-switch/filter gestures discard silently (today's
  // behavior); dirty ones arm the in-row two-tap confirm below — no modal.
  const dirty =
    nombre !== initialNombre || edad !== initialEdad || hb !== initialHb;
  // Two-tap discard grammar, mirroring the delete guards: the first tap
  // (Cancelar, Esc, row-switch, filter gesture) arms "Descartar cambios?",
  // the second confirms the discard. "Seguir editando" or a sliding ~4s
  // fuse disarms with the draft intact (any keydown/pointerenter inside
  // the action group restarts the fuse).
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const discardConfirmRef = useRef<HTMLButtonElement>(null);

  // High-stakes focus: the Nombre field takes focus on mount so keyboard
  // users start typing immediately. Queried by id (the shared Input does
  // not take a ref) — the id is row-scoped, so the query is unambiguous.
  const nombreInputId = `nombre-${paciente.id}`;
  function focusNombre() {
    document.getElementById(nombreInputId)?.focus();
  }
  // Timeout disarm drops the parked switch/filter and hands focus back
  // to Nombre: the Descartar button unmounts, and focus must never fall
  // through to <body>. Deferred through focusNombreOnDisarm (effect
  // below): while armed the inputs are disabled, so a synchronous focus
  // call here would land on a still-disabled control and silently fail.
  const focusNombreOnDisarm = useRef(false);
  const handleDiscardExpire = useCallback(() => {
    setConfirmingDiscard(false);
    onDiscardDisarm();
    onFuseExpire?.();
    focusNombreOnDisarm.current = true;
  }, [onDiscardDisarm, onFuseExpire]);
  const { slideProps: discardSlideProps } = useSlidingExpiry(
    confirmingDiscard,
    handleDiscardExpire,
  );
  useEffect(() => {
    document.getElementById(nombreInputId)?.focus();
  }, [nombreInputId]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Arming moves focus to "Descartar cambios?" so Enter confirms and the
  // prompt is perceivable; Esc confirms the discard (second Esc overall).
  // Focus choice matches the row/bulk delete guards (Confirmar takes focus
  // when armed): the destructive confirm owns the keyboard in every armed
  // row, never the safe disarm.
  useEffect(() => {
    if (confirmingDiscard) discardConfirmRef.current?.focus();
  }, [confirmingDiscard]);

  // Arming (Cancelar, Esc, row-switch, filter gesture, external signal)
  // clears a stale fuse notice so the next timeout expiry re-announces.
  useEffect(() => {
    if (confirmingDiscard) onFuseClear?.();
  }, [confirmingDiscard, onFuseClear]);

  // "Seguir editando" (and the fuse timeout above) disarm while the draft
  // stays open: focus returns to Nombre only after the re-render
  // re-enables the inputs. Flag-gated so blur-disarms (focus already left
  // the group) and confirmed discards (the parent owns focus: Editar
  // button, next row, or filter anchor) never get yanked back here.
  useEffect(() => {
    if (!confirmingDiscard && focusNombreOnDisarm.current) {
      focusNombreOnDisarm.current = false;
      focusNombre();
    }
  }, [confirmingDiscard]);

  // Row-switch / filter gestures arm the confirm from the outside. The
  // last-seen signal ref keeps a freshly mounted row (after a confirmed
  // switch) from inheriting the arm that confirmed it: only a signal
  // increment while mounted arms.
  const lastDiscardSignal = useRef(discardSignal);
  useEffect(() => {
    if (discardSignal !== lastDiscardSignal.current) {
      lastDiscardSignal.current = discardSignal;
      setConfirmingDiscard(true);
    }
  }, [discardSignal]);

  function disarmDiscard() {
    if (confirmingDiscard) {
      setConfirmingDiscard(false);
      onDiscardDisarm();
    }
  }

  function armDiscard() {
    // Arming starts the sliding 4s fuse via the hook effect.
    setConfirmingDiscard(true);
  }

  // Single cancel entry point for Cancelar clicks and Esc: clean drafts
  // close silently; dirty drafts arm the confirm, and a second
  // invocation while armed confirms the discard.
  function requestCancel() {
    if (!dirty) {
      onDone();
      return;
    }
    if (!confirmingDiscard) {
      armDiscard();
      return;
    }
    setConfirmingDiscard(false);
    onDiscardConfirm();
  }

  // Per-field validation mirrors RegisterForm: same clinical copy, each
  // Input pointing at its own error id, invalid flag only on offenders.
  // Edad/Hb hints mirror the create form (same copy, row-scoped ids).
  const nombreErrorId = `nombre-${paciente.id}-error`;
  const edadHintId = `edad-${paciente.id}-hint`;
  const edadErrorId = `edad-${paciente.id}-error`;
  const hbHintId = `hb-${paciente.id}-hint`;
  const hbErrorId = `hb-${paciente.id}-error`;

  function handleSave() {
    const edadMeses = Number(edad);
    const nivelHemoglobina = Number(hb);
    const nextNombreError =
      nombre.trim().length === 0
        ? "El nombre del paciente es obligatorio."
        : nombre.trim().length > MAX_NOMBRE
          ? `El nombre no puede exceder ${MAX_NOMBRE} caracteres.`
          : null;
    const nextEdadError =
      !Number.isInteger(edadMeses) || edadMeses < 6 || edadMeses > 59
        ? "La edad debe estar entre 6 y 59 meses."
        : null;
    const nextHbError =
      !Number.isFinite(nivelHemoglobina) || nivelHemoglobina <= 0
        ? "El nivel de hemoglobina debe ser mayor que 0."
        : null;
    setNombreError(nextNombreError);
    setEdadError(nextEdadError);
    setHbError(nextHbError);
    if (nextNombreError || nextEdadError || nextHbError) return;
    // Duplicate check AFTER validation (create-form order): warn inline
    // before the commit, never block. Self excluded so an untouched
    // nombre never warns against its own row.
    const trimmedNombre = nombre.trim();
    const duplicateMessage = getDuplicateWarning(trimmedNombre, paciente.id);
    if (duplicateMessage && dupAckFor !== trimmedNombre) {
      setDupWarning(duplicateMessage);
      return;
    }
    update(paciente.id, { nombre: trimmedNombre, edadMeses, nivelHemoglobina });
    setNombreError(null);
    setEdadError(null);
    setHbError(null);
    setDupWarning(null);
    // Snapshot BEFORE the commit (paciente is still the pre-save row here):
    // the parent pushes it as an edit-preimage undo group.
    onSaved?.({
      id: paciente.id,
      nombre: paciente.nombre,
      edadMeses: paciente.edadMeses,
      nivelHemoglobina: paciente.nivelHemoglobina,
    });
    onDone();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    handleSave();
  }

  // Esc cancels the edit without saving; ignored during IME composition
  // so confirming composed text never closes the row. While dirty the
  // first Esc arms the discard confirm and only the second discards.
  // Enter saves through the native form submit (single-line inputs): no
  // custom Enter handler, so Shift+Enter behaves exactly like Enter with
  // no quirk to guard.
  function handleRowKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
      event.stopPropagation();
      requestCancel();
    }
  }

  return (
    <TableRow>
      <TableCell colSpan={COLUMN_COUNT}>
        <form
          className="flex flex-col gap-2"
          onSubmit={handleSubmit}
          onKeyDown={handleRowKeyDown}
        >
          <p className="text-sm font-medium">
            Editando a {paciente.nombre}
          </p>
          <Field data-invalid={nombreError ? true : undefined}>
            <FieldLabel htmlFor={`nombre-${paciente.id}`}>Nombre</FieldLabel>
            <Input
              id={nombreInputId}
              value={nombre}
              maxLength={MAX_NOMBRE}
              disabled={confirmingDiscard}
              onChange={(e) => {
                setNombre(e.target.value);
                if (nombreError) setNombreError(null);
                // A renamed draft needs a fresh duplicate verdict on save.
                if (dupWarning) setDupWarning(null);
              }}
              aria-invalid={nombreError ? true : undefined}
              aria-describedby={nombreError ? nombreErrorId : undefined}
              className="mt-1"
            />
            {nombreError && (
              <FieldError id={nombreErrorId}>{nombreError}</FieldError>
            )}
          </Field>
          <Field data-invalid={edadError ? true : undefined}>
            <FieldLabel htmlFor={`edad-${paciente.id}`}>
              Edad (meses)
            </FieldLabel>
            <Input
              id={`edad-${paciente.id}`}
              inputMode="numeric"
              value={edad}
              disabled={confirmingDiscard}
              onChange={(e) => {
                setEdad(e.target.value);
                if (edadError) setEdadError(null);
              }}
              aria-invalid={edadError ? true : undefined}
              aria-describedby={edadError ? `${edadHintId} ${edadErrorId}` : edadHintId}
              className="mt-1"
            />
            <FieldDescription id={edadHintId}>6 a 59 meses</FieldDescription>
            {edadError && <FieldError id={edadErrorId}>{edadError}</FieldError>}
          </Field>
          <Field data-invalid={hbError ? true : undefined}>
            <FieldLabel htmlFor={`hb-${paciente.id}`}>
              Hemoglobina (g/dL)
            </FieldLabel>
            <Input
              id={`hb-${paciente.id}`}
              inputMode="decimal"
              value={hb}
              disabled={confirmingDiscard}
              onChange={(e) => {
                setHb(e.target.value);
                if (hbError) setHbError(null);
              }}
              aria-invalid={hbError ? true : undefined}
              aria-describedby={hbError ? `${hbHintId} ${hbErrorId}` : hbHintId}
              className="mt-1"
            />
            <FieldDescription id={hbHintId}>
              <span className="block">Valor del hemoglobinómetro, ej. 11.5</span>
              <span className="block">{HB_CUTOFF_LABEL}</span>
            </FieldDescription>
            {hbError && <FieldError id={hbErrorId}>{hbError}</FieldError>}
          </Field>
          {/* Duplicate warning (create-form parity): single polite status,
              Descartar outside the live region. Acknowledging records the
              current nombre so the next Guardar commits; renaming the
              draft re-arms the check. */}
          {dupWarning && (
            <p role="status" className="text-sm text-warning">
              {dupWarning}
            </p>
          )}
          {dupWarning && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-coarse:min-h-11"
                onClick={() => {
                  setDupAckFor(nombre.trim());
                  setDupWarning(null);
                }}
              >
                Descartar
              </Button>
            </div>
          )}
          <div
            className="flex gap-2"
            onBlur={(e) => {
              // Leaving the action group disarms a pending discard prompt
              // (same grammar as the delete guards); the draft is untouched.
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                disarmDiscard();
              }
            }}
            onKeyDownCapture={discardSlideProps.onKeyDownCapture}
            onPointerOverCapture={discardSlideProps.onPointerOverCapture}
          >
            {/* Armed discard is a binary choice: while the confirm is up
                the inputs above are disabled and Guardar steps aside, so
                the row offers exactly "¿Descartar cambios?" (destructive)
                and "Seguir editando" (safe). Disarming restores the full
                form with the draft intact. */}
            {!confirmingDiscard && (
              <Button
                type="submit"
                size="sm"
                className="pointer-coarse:min-h-11"
              >
                Guardar
              </Button>
            )}
            {confirmingDiscard ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="pointer-coarse:min-h-11"
                  ref={discardConfirmRef}
                  onClick={requestCancel}
                  onKeyDown={(e) => {
                    // Second-Esc confirmation must not bubble to the form
                    // row handler, which would invoke the cancel entry a
                    // second time after the discard already resolved.
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      requestCancel();
                    }
                  }}
                >
                  Descartar cambios?
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="pointer-coarse:min-h-11"
                  onClick={() => {
                    disarmDiscard();
                    // Deferred: the effect above focuses Nombre after the
                    // re-render re-enables the armed-disabled inputs.
                    focusNombreOnDisarm.current = true;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      disarmDiscard();
                      focusNombreOnDisarm.current = true;
                    }
                  }}
                >
                  Seguir editando
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="pointer-coarse:min-h-11"
                onClick={requestCancel}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}
