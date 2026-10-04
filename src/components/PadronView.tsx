import { useState } from "react";
import { usePadronStore, type Paciente } from "../stores/padronStore";
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
export function PadronView({
  onEmptyRegister,
}: {
  onEmptyRegister?: () => void;
}) {
  const pacientes = usePadronStore((s) => s.pacientes);
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  if (pacientes.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Padrón de pacientes</h2>
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

  const normalized = filter.trim().toLowerCase();
  const visible =
    normalized.length === 0
      ? pacientes
      : pacientes.filter((p) => p.nombre.toLowerCase().includes(normalized));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Padrón de pacientes</h2>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Edad (meses)</TableHead>
            <TableHead>Hemoglobina (g/dL)</TableHead>
            <TableHead>Diagnóstico</TableHead>
            <TableHead>
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

  return (
    <TableRow>
      <TableCell className="font-medium">{paciente.nombre}</TableCell>
      <TableCell>{paciente.edadMeses}</TableCell>
      <TableCell>{paciente.nivelHemoglobina}</TableCell>
      <TableCell>
        <Badge variant={DIAGNOSIS_BADGE[paciente.diagnostico]}>
          {paciente.diagnostico}
        </Badge>
      </TableCell>
      <TableCell>
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
