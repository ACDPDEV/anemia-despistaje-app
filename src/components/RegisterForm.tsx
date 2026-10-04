import { useState } from "react";
import { findPossibleDuplicates, usePadronStore } from "../stores/padronStore";
import type { Diagnosis } from "../domain/anemia";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Registration form with Spanish labels and validation messages.
// Delegates persistence and diagnosis to the padron store.
export function RegisterForm() {
  const add = usePadronStore((s) => s.add);
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [hb, setHb] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastDiagnosis, setLastDiagnosis] = useState<Diagnosis | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLastDiagnosis(null);
    setDuplicateWarning(null);

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

    // Warning-only duplicate signal: computed after validation, never blocks add.
    const matches = findPossibleDuplicates(nombre);
    if (matches.length > 0) {
      setDuplicateWarning(
        `Posible duplicado: ya existe un paciente llamado ${matches[0].nombre}.`,
      );
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

  const invalid = error !== null;

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={invalid ? true : undefined}>
          <FieldLabel htmlFor="nombre">Nombre del paciente</FieldLabel>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            aria-invalid={invalid ? true : undefined}
          />
        </Field>
        <Field data-invalid={invalid ? true : undefined}>
          <FieldLabel htmlFor="edad">Edad (meses)</FieldLabel>
          <Input
            id="edad"
            inputMode="numeric"
            value={edad}
            onChange={(e) => setEdad(e.target.value)}
            aria-invalid={invalid ? true : undefined}
          />
        </Field>
        <Field data-invalid={invalid ? true : undefined}>
          <FieldLabel htmlFor="hb">Hemoglobina (g/dL)</FieldLabel>
          <Input
            id="hb"
            inputMode="decimal"
            value={hb}
            onChange={(e) => setHb(e.target.value)}
            aria-invalid={invalid ? true : undefined}
          />
        </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {lastDiagnosis && (
        <p className="text-sm text-green-700">
          Paciente registrado: <strong>{lastDiagnosis}</strong>
        </p>
      )}
      {duplicateWarning && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-amber-700">{duplicateWarning}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDuplicateWarning(null)}
          >
            Descartar
          </Button>
        </div>
      )}
      <Button type="submit">Registrar paciente</Button>
      </FieldGroup>
    </form>
  );
}
