import { useState } from "react";
import { usePadronStore, type Paciente } from "../stores/padronStore";

// List + edit/delete view over the padron store selectors.
export function PadronView() {
  const pacientes = usePadronStore((s) => s.pacientes);

  if (pacientes.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold">Padrón de pacientes</h2>
        <p className="mt-2 text-sm text-gray-600">No hay pacientes registrados.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">Padrón de pacientes</h2>
      <ul className="mt-4 space-y-3">
        {pacientes.map((p) => (
          <PadronRow key={p.id} paciente={p} />
        ))}
      </ul>
    </section>
  );
}

function PadronRow({ paciente }: { paciente: Paciente }) {
  const update = usePadronStore((s) => s.update);
  const remove = usePadronStore((s) => s.remove);
  const [editing, setEditing] = useState(false);
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
    setEditing(false);
  }

  return (
    <li className="rounded border p-3">
      <p className="font-medium">{paciente.nombre}</p>
      <p className="text-sm text-gray-600">
        {paciente.edadMeses} meses · {paciente.nivelHemoglobina} g/dL ·{" "}
        <span className="font-medium">{paciente.diagnostico}</span>
      </p>
      {!editing ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setNombre(paciente.nombre);
              setEdad(String(paciente.edadMeses));
              setHb(String(paciente.nivelHemoglobina));
              setError(null);
              setEditing(true);
            }}
            className="rounded border px-3 py-1 text-sm"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => remove(paciente.id)}
            className="rounded border px-3 py-1 text-sm text-red-600"
          >
            Eliminar
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div>
            <label htmlFor={`nombre-${paciente.id}`} className="block text-sm font-medium">
              Nombre
            </label>
            <input
              id={`nombre-${paciente.id}`}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-1"
            />
          </div>
          <div>
            <label htmlFor={`edad-${paciente.id}`} className="block text-sm font-medium">
              Edad (meses)
            </label>
            <input
              id={`edad-${paciente.id}`}
              inputMode="numeric"
              value={edad}
              onChange={(e) => setEdad(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-1"
            />
          </div>
          <div>
            <label htmlFor={`hb-${paciente.id}`} className="block text-sm font-medium">
              Hemoglobina (g/dL)
            </label>
            <input
              id={`hb-${paciente.id}`}
              inputMode="decimal"
              value={hb}
              onChange={(e) => setHb(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-1"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border px-3 py-1 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
