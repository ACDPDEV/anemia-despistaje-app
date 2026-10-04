import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  bySeverity,
  findPossibleDuplicates,
  MAX_NOMBRE,
  usePadronStore,
  type Paciente,
} from "../stores/padronStore";
import { normalizeNombre } from "../lib/normalize";
import { buildPadronCsv, padronFilename } from "../lib/padronExport";
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

const COLUMN_COUNT = 6;

// Undo toast visibility window after a confirmed delete.
const UNDO_TIMEOUT_MS = 8000;
// Honest undo stack: single-slot silently dropped the earlier net, so keep
// up to 3 pending groups with independent timers; the oldest is evicted
// with an announcement when a fourth lands.
const UNDO_STACK_MAX = 3;
const EVICTION_MESSAGE = "Se expiró un deshacer anterior.";

interface UndoGroup {
  key: number;
  ids: string[];
  label: string;
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
  const [filter, setFilter] = useState("");
  const [gravesPrimero, setGravesPrimero] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bulk selection lives over row ids. Semantics (documented, simplest
  // sane reset): the set clears whenever the filter text changes, and
  // every bulk action derives from selected ∩ visible — a selected row
  // that disappears (deleted, filtered out) simply drops out of scope.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [undoGroups, setUndoGroups] = useState<UndoGroup[]>([]);
  // Honest undo stack (max 3): newest renders on top, each row restores
  // its own ids through the existing per-row restore() loop.
  const [evictionNotice, setEvictionNotice] = useState<string | null>(null);
  const undoKey = useRef(0);
  const undoTimers = useRef(new Map<number, number>());
  const evictionTimer = useRef<number | undefined>(undefined);
  const bulkConfirmTimer = useRef<number | undefined>(undefined);
  // Shortcut: arming the bulk delete moves focus to Confirmar so Enter
  // completes it; Esc cancels (see bulk effect below).
  const bulkConfirmRef = useRef<HTMLButtonElement>(null);
  const groupsRef = useRef<UndoGroup[]>([]);
  groupsRef.current = undoGroups;

  useEffect(() => {
    setSelected(new Set());
    setBulkConfirming(false);
    window.clearTimeout(bulkConfirmTimer.current);
  }, [filter]);

  // The 8s undo window is wall-clock per group: each delete pushes its
  // own group with an independent timer; unmount clears all of them.
  useEffect(() => {
    return () => {
      for (const timer of undoTimers.current.values()) window.clearTimeout(timer);
      undoTimers.current.clear();
      window.clearTimeout(bulkConfirmTimer.current);
      window.clearTimeout(evictionTimer.current);
    };
  }, []);

  // Shortcut: focus Confirmar when the bulk delete arms so Enter confirms.
  useEffect(() => {
    if (bulkConfirming) bulkConfirmRef.current?.focus();
  }, [bulkConfirming]);

  function dismissGroup(key: number) {
    const timer = undoTimers.current.get(key);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      undoTimers.current.delete(key);
    }
    setUndoGroups((prev) => prev.filter((g) => g.key !== key));
  }

  function pushUndoGroup(ids: string[], label: string) {
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
      setUndoGroups([...prev.slice(1), { key, ids, label }]);
      setEvictionNotice(EVICTION_MESSAGE);
      window.clearTimeout(evictionTimer.current);
      evictionTimer.current = window.setTimeout(() => setEvictionNotice(null), 4000);
    } else {
      setUndoGroups([...prev, { key, ids, label }]);
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
    // Same per-row restore path as the single delete, looped: tombstone
    // semantics per row unchanged (deletedAt cleared, dirty requeued).
    for (const id of group.ids) restore(id);
    dismissGroup(key);
  }

  // Undo toasts render in BOTH branches below: wiping the last visible row
  // lands on the empty state, and each 8s window must survive the crossing.
  // Up to 3 compact rows (newest first), each with its own Deshacer.
  const undoToast = undoGroups.length > 0 && (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
    >
      {[...undoGroups].reverse().map((group) => (
        <div key={group.key} className="flex items-center gap-3">
          <p className="text-sm">{group.label}</p>
          <Button type="button" size="sm" onClick={() => handleUndoGroup(group.key)}>
            Deshacer
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
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Padrón de pacientes</h2>
          <div className="padron-actions flex gap-2">
            <Button type="button" disabled>
              Exportar CSV
            </Button>
            <Button type="button" variant="outline" disabled>
              Imprimir
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          No hay pacientes registrados.
        </p>
        <p className="text-sm text-muted-foreground">
          Exportar e imprimir estarán disponibles con pacientes registrados.
        </p>
        {onEmptyRegister ? (
          <div>
            <Button type="button" onClick={onEmptyRegister}>
              Registrar paciente
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Use la pestaña Registro para agregar el primer paciente.
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
  const now = new Date();
  const todayStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((p) => p.id)));
    }
  }

  function disarmBulk() {
    window.clearTimeout(bulkConfirmTimer.current);
    setBulkConfirming(false);
  }

  function handleBulkDeleteTap() {
    if (selectedVisible.length === 0) return;
    if (!bulkConfirming) {
      setBulkConfirming(true);
      window.clearTimeout(bulkConfirmTimer.current);
      bulkConfirmTimer.current = window.setTimeout(disarmBulk, 4000);
      return;
    }
    window.clearTimeout(bulkConfirmTimer.current);
    setBulkConfirming(false);
    const ids = selectedVisible.map((p) => p.id);
    for (const id of ids) remove(id);
    if (editingId !== null && ids.includes(editingId)) setEditingId(null);
    setSelected(new Set());
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
    <section className="padron-section flex flex-col gap-4">
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
      <div className="padron-print-header hidden print:block">
        <p className="text-lg font-semibold">
          Padrón de pacientes — {todayStamp}
        </p>
        <p className="text-sm">
          Total: {visible.length} · Moderada + Severa:{" "}
          {visibleModerateSevere} · Promedio Hb: {visibleAverageHb.toFixed(1)}{" "}
          g/dL
        </p>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        Moderada + Severa (en vista): {visibleModerateSevere} de{" "}
        {visible.length}
      </p>
      <div className="padron-filters flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="padron-filter">Buscar por nombre</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id="padron-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                // Escape clears the query; ignore IME composition so the
                // key that confirms composed text never wipes the filter.
                if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                  setFilter("");
                }
              }}
              placeholder="Buscar por nombre…"
            />
            {filter.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilter("")}
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
      {selectedVisible.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) disarmBulk();
          }}
        >
          <p className="text-sm text-muted-foreground">
            {selectedVisible.length === 1
              ? "1 seleccionado"
              : `${selectedVisible.length} seleccionados`}
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
      <Table className="padron-table">
        <TableCaption className="sr-only">
          Padrón de pacientes — {visible.length} en vista
        </TableCaption>
        <TableHeader>
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
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <PadronRow
                  key={p.id}
                  paciente={p}
                  selected={selected.has(p.id)}
                  onToggle={() => toggleOne(p.id)}
                  onEdit={() => setEditingId(p.id)}
                  onDeleted={handleDeleted}
                />
              ),
            )
          )}
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
}: {
  paciente: Paciente;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeleted: (id: string, nombre: string) => void;
}) {
  const remove = usePadronStore((s) => s.remove);
  const isPossibleDuplicate =
    findPossibleDuplicates(paciente.nombre).length > 1;
  // Two-tap delete guard: the first tap arms the confirm state in place
  // (same button keeps focus), the second tap confirms. Cancelar, Esc,
  // focus leaving the group, or a ~4s timeout disarms with no delete.
  // Shortcut: arming moves focus to Confirmar so Enter completes the
  // armed delete; Esc already cancels.
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => window.clearTimeout(confirmTimer.current);
  }, []);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function disarm() {
    window.clearTimeout(confirmTimer.current);
    setConfirming(false);
  }

  function handleDeleteTap() {
    if (!confirming) {
      setConfirming(true);
      window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(disarm, 4000);
      return;
    }
    window.clearTimeout(confirmTimer.current);
    setConfirming(false);
    remove(paciente.id);
    onDeleted(paciente.id, paciente.nombre);
  }

  return (
    <TableRow>
      <TableCell>
        <label className="flex cursor-pointer items-center gap-2 pointer-coarse:min-h-11">
          <Checkbox checked={selected} onChange={onToggle} />
          <span className="sr-only">Seleccionar a {paciente.nombre}</span>
        </label>
      </TableCell>
      <TableCell className="font-medium">{paciente.nombre}</TableCell>
      <TableCell>{paciente.edadMeses}</TableCell>
      <TableCell>{paciente.nivelHemoglobina}</TableCell>
      <TableCell>
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
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="pointer-coarse:min-h-11"
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
  onDone,
}: {
  paciente: Paciente;
  onDone: () => void;
}) {
  const update = usePadronStore((s) => s.update);
  const [nombre, setNombre] = useState(paciente.nombre);
  const [edad, setEdad] = useState(String(paciente.edadMeses));
  const [hb, setHb] = useState(String(paciente.nivelHemoglobina));
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [edadError, setEdadError] = useState<string | null>(null);
  const [hbError, setHbError] = useState<string | null>(null);

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
    update(paciente.id, { nombre: nombre.trim(), edadMeses, nivelHemoglobina });
    setNombreError(null);
    setEdadError(null);
    setHbError(null);
    onDone();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    handleSave();
  }

  // Esc cancels the edit without saving; ignored during IME composition
  // so confirming composed text never closes the row. Enter saves through
  // the native form submit (single-line inputs): no custom Enter handler,
  // so Shift+Enter behaves exactly like Enter with no quirk to guard.
  function handleRowKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
      event.stopPropagation();
      onDone();
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
              id={`nombre-${paciente.id}`}
              value={nombre}
              maxLength={MAX_NOMBRE}
              onChange={(e) => {
                setNombre(e.target.value);
                if (nombreError) setNombreError(null);
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
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              className="pointer-coarse:min-h-11"
            >
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="pointer-coarse:min-h-11"
              onClick={onDone}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}
