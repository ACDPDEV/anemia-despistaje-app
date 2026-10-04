import { useState } from "react";
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

const COLUMN_COUNT = 5;

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
  const [filter, setFilter] = useState("");
  const [gravesPrimero, setGravesPrimero] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="graves-primero"
            checked={gravesPrimero}
            onChange={(e) => setGravesPrimero(e.target.checked)}
          />
          <label htmlFor="graves-primero" className="text-sm font-medium">
            Ver graves primero
          </label>
        </div>
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
                />
              ),
            )
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function PadronRow({
  paciente,
  onEdit,
}: {
  paciente: Paciente;
  onEdit: () => void;
}) {
  const remove = usePadronStore((s) => s.remove);
  const isPossibleDuplicate =
    findPossibleDuplicates(paciente.nombre).length > 1;

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
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Editar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => remove(paciente.id)}
          >
            Eliminar
          </Button>
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
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const edadMeses = Number(edad);
    const nivelHemoglobina = Number(hb);
    if (nombre.trim().length === 0) {
      setError("El nombre del paciente es obligatorio.");
      return;
    }
    if (!Number.isInteger(edadMeses) || edadMeses < 6 || edadMeses > 59) {
      setError("La edad debe estar entre 6 y 59 meses.");
      return;
    }
    if (!Number.isFinite(nivelHemoglobina) || nivelHemoglobina <= 0) {
      setError("El nivel de hemoglobina debe ser mayor que 0.");
      return;
    }
    update(paciente.id, { nombre: nombre.trim(), edadMeses, nivelHemoglobina });
    setError(null);
    onDone();
  }

  return (
    <TableRow>
      <TableCell colSpan={COLUMN_COUNT}>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Editando a {paciente.nombre}
          </p>
          <div>
            <label
              htmlFor={`nombre-${paciente.id}`}
              className="block text-sm font-medium"
            >
              Nombre
            </label>
            <Input
              id={`nombre-${paciente.id}`}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`edad-${paciente.id}`}
              className="block text-sm font-medium"
            >
              Edad (meses)
            </label>
            <Input
              id={`edad-${paciente.id}`}
              inputMode="numeric"
              value={edad}
              onChange={(e) => setEdad(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor={`hb-${paciente.id}`}
              className="block text-sm font-medium"
            >
              Hemoglobina (g/dL)
            </label>
            <Input
              id={`hb-${paciente.id}`}
              inputMode="decimal"
              value={hb}
              onChange={(e) => setHb(e.target.value)}
              className="mt-1"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
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
