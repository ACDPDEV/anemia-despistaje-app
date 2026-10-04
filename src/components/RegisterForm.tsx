import { useState } from "react";
import { findPossibleDuplicates, usePadronStore } from "../stores/padronStore";
import type { Diagnosis } from "../domain/anemia";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Registration form with Spanish labels and validation messages.
// Delegates persistence and diagnosis to the padron store.
// Validation errors are per-field (each Input points at its own error id);
// only store-level failures (e.g. the 100-record cap) use the form alert
// and leave every field valid.
export function RegisterForm() {
  const add = usePadronStore((s) => s.add);
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [hb, setHb] = useState("");
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [edadError, setEdadError] = useState<string | null>(null);
  const [hbError, setHbError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastDiagnosis, setLastDiagnosis] = useState<Diagnosis | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLastDiagnosis(null);
    setDuplicateWarning(null);
    setFormError(null);

    // Collect every field error so one submit surfaces all of them.
    const nextNombreError =
      nombre.trim().length === 0 ? "El nombre del paciente es obligatorio." : null;
    const edadMeses = Number(edad);
    const nextEdadError =
      !Number.isInteger(edadMeses) || edadMeses < 6 || edadMeses > 59
        ? "La edad debe estar entre 6 y 59 meses."
        : null;
    const nivelHemoglobina = Number(hb);
    const nextHbError =
      !Number.isFinite(nivelHemoglobina) || nivelHemoglobina <= 0
        ? "El nivel de hemoglobina debe ser mayor que 0."
        : null;
    setNombreError(nextNombreError);
    setEdadError(nextEdadError);
    setHbError(nextHbError);
    if (nextNombreError || nextEdadError || nextHbError) return;

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
      setFormError(err instanceof Error ? err.message : "No se pudo registrar al paciente.");
      return;
    }

    setNombreError(null);
    setEdadError(null);
    setHbError(null);
    setFormError(null);
    setLastDiagnosis(usePadronStore.getState().pacientes.at(-1)?.diagnostico ?? null);
    setNombre("");
    setEdad("");
    setHb("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={nombreError ? true : undefined}>
          <FieldLabel htmlFor="nombre">Nombre del paciente</FieldLabel>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (nombreError) setNombreError(null);
            }}
            aria-invalid={nombreError ? true : undefined}
            aria-describedby={nombreError ? "nombre-error" : undefined}
          />
          {nombreError && (
            <FieldError id="nombre-error">{nombreError}</FieldError>
          )}
        </Field>
        <Field data-invalid={edadError ? true : undefined}>
          <FieldLabel htmlFor="edad">Edad (meses)</FieldLabel>
          <Input
            id="edad"
            inputMode="numeric"
            value={edad}
            onChange={(e) => {
              setEdad(e.target.value);
              if (edadError) setEdadError(null);
            }}
            aria-invalid={edadError ? true : undefined}
            aria-describedby={edadError ? "edad-error" : undefined}
          />
          {edadError && <FieldError id="edad-error">{edadError}</FieldError>}
        </Field>
        <Field data-invalid={hbError ? true : undefined}>
          <FieldLabel htmlFor="hb">Hemoglobina (g/dL)</FieldLabel>
          <Input
            id="hb"
            inputMode="decimal"
            value={hb}
            onChange={(e) => {
              setHb(e.target.value);
              if (hbError) setHbError(null);
            }}
            aria-invalid={hbError ? true : undefined}
            aria-describedby={hbError ? "hb-error" : undefined}
          />
          {hbError && <FieldError id="hb-error">{hbError}</FieldError>}
        </Field>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      {lastDiagnosis && (
        <p role="status" className="text-sm text-success">
          Paciente registrado: <strong>{lastDiagnosis}</strong>
        </p>
      )}
      {duplicateWarning && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-warning">{duplicateWarning}</p>
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
