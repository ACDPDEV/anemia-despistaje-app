import { useEffect, useRef, useState } from "react";
import {
  bySeverity,
  findPossibleDuplicates,
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { DIAGNOSIS_BADGE } from "./DashboardView";
import { HB_CUTOFF_LABEL } from "../domain/anemia";

const COLUMN_COUNT = 5;

// Undo toast visibility window after a confirmed delete.
const UNDO_TIMEOUT_MS = 8000;

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
  const [filter, setFilter] = useState("");
  const [gravesPrimero, setGravesPrimero] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [undone, setUndone] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const undoTimer = useRef<number | undefined>(undefined);

  // The 8s undo window is wall-clock: a newer delete replaces the pending
  // one and restarts the timer; unmount clears it.
  useEffect(() => {
    return () => window.clearTimeout(undoTimer.current);
  }, []);

  function handleDeleted(id: string, nombre: string) {
    window.clearTimeout(undoTimer.current);
    setUndone({ id, nombre });
    undoTimer.current = window.setTimeout(() => setUndone(null), UNDO_TIMEOUT_MS);
  }

  function handleUndo() {
    if (!undone) return;
    restore(undone.id);
    window.clearTimeout(undoTimer.current);
    setUndone(null);
  }

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
        <div>
          <label
            htmlFor="padron-filter"
            className="block text-sm font-medium"
          >
            Buscar por nombre
          </label>
          <Input
            id="padron-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por nombre…"
            className="mt-1"
          />
        </div>
        <label
          htmlFor="graves-primero"
          className="flex cursor-pointer items-center gap-2 text-sm font-medium pointer-coarse:min-h-11"
        >
          <Checkbox
            id="graves-primero"
            checked={gravesPrimero}
            onChange={(e) => setGravesPrimero(e.target.checked)}
          />
          Ver graves primero
        </label>
      </div>
      <Table className="padron-table">
        <TableHeader>
          <TableRow>
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
                  onEdit={() => setEditingId(p.id)}
                  onDeleted={handleDeleted}
                />
              ),
            )
          )}
        </TableBody>
      </Table>
      {undone && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
        >
          <p className="text-sm">Paciente eliminado.</p>
          <Button type="button" size="sm" onClick={handleUndo}>
            Deshacer
          </Button>
        </div>
      )}
    </section>
  );
}

function PadronRow({
  paciente,
  onEdit,
  onDeleted,
}: {
  paciente: Paciente;
  onEdit: () => void;
  onDeleted: (id: string, nombre: string) => void;
}) {
  const remove = usePadronStore((s) => s.remove);
  const isPossibleDuplicate =
    findPossibleDuplicates(paciente.nombre).length > 1;
  // Two-tap delete guard: the first tap arms the confirm state in place
  // (same button keeps focus), the second tap confirms. Cancelar, Esc,
  // focus leaving the group, or a ~4s timeout disarms with no delete.
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(confirmTimer.current);
  }, []);

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
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Editar
          </Button>
          {confirming ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
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
      nombre.trim().length === 0 ? "El nombre del paciente es obligatorio." : null;
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

  return (
    <TableRow>
      <TableCell colSpan={COLUMN_COUNT}>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Editando a {paciente.nombre}
          </p>
          <Field data-invalid={nombreError ? true : undefined}>
            <FieldLabel htmlFor={`nombre-${paciente.id}`}>Nombre</FieldLabel>
            <Input
              id={`nombre-${paciente.id}`}
              value={nombre}
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
            <Button type="button" size="sm" onClick={handleSave}>
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDone}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
