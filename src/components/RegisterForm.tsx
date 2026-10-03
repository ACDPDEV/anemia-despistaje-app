import { useState } from "react";
import { usePadronStore } from "../stores/padronStore";
import type { Diagnosis } from "../domain/anemia";

// Registration form with Spanish labels and validation messages.
// Delegates persistence and diagnosis to the padron store.
export function RegisterForm() {
  const add = usePadronStore((s) => s.add);
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [hb, setHb] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastDiagnosis, setLastDiagnosis] = useState<Diagnosis | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLastDiagnosis(null);

    if (nombre.trim().length === 0) {
      setError("El nombre del paciente es obligatorio.");
      return;
    }
    const edadMeses = Number(edad);
    if (!Number.isInteger(edadMeses) || edadMeses < 6 || edadMeses > 59) {
      setError("La edad debe estar entre 6 y 59 meses.");
      return;
    }
    const nivelHemoglobina = Number(hb);
    if (!Number.isFinite(nivelHemoglobina) || nivelHemoglobina <= 0) {
      setError("El nivel de hemoglobina debe ser mayor que 0.");
      return;
    }

    try {
      add({ nombre: nombre.trim(), edadMeses, nivelHemoglobina });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar al paciente.");
      return;
    }

    setError(null);
    setLastDiagnosis(usePadronStore.getState().pacientes.at(-1)?.diagnostico ?? null);
    setNombre("");
    setEdad("");
    setHb("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium">
          Nombre del paciente
        </label>
        <input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="edad" className="block text-sm font-medium">
          Edad (meses)
        </label>
        <input
          id="edad"
          inputMode="numeric"
          value={edad}
          onChange={(e) => setEdad(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="hb" className="block text-sm font-medium">
          Hemoglobina (g/dL)
        </label>
        <input
          id="hb"
          inputMode="decimal"
          value={hb}
          onChange={(e) => setHb(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {lastDiagnosis && (
        <p className="text-sm text-green-700">
          Paciente registrado: <strong>{lastDiagnosis}</strong>
        </p>
      )}
      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
        Registrar paciente
      </button>
    </form>
  );
}
