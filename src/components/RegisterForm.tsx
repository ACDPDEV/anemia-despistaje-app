import { useRef, useState } from "react";
import { getDuplicateWarning, MAX_NOMBRE, usePadronStore } from "../stores/padronStore";
import { HB_CUTOFF_LABEL, type Diagnosis } from "../domain/anemia";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
  // Capture-loop shortcut: after a successful register, focus returns to
  // Nombre so the next patient needs no extra click. Deferred with
  // setTimeout 0 so the success announcer settles first.
  const nombreRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLastDiagnosis(null);
    setDuplicateWarning(null);
    setFormError(null);

    // Collect every field error so one submit surfaces all of them.
    const nextNombreError =
      nombre.trim().length === 0
        ? "El nombre del paciente es obligatorio."
        : nombre.trim().length > MAX_NOMBRE
          ? `El nombre no puede exceder ${MAX_NOMBRE} caracteres.`
          : null;
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
    // Shared helper with the edit row so both surfaces quote identical copy.
    const duplicateMessage = getDuplicateWarning(nombre);
    if (duplicateMessage) setDuplicateWarning(duplicateMessage);

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
    window.setTimeout(() => nombreRef.current?.focus(), 0);
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={nombreError ? true : undefined}>
          <FieldLabel htmlFor="nombre">Nombre del paciente</FieldLabel>
          <Input
            id="nombre"
            ref={nombreRef}
            value={nombre}
            maxLength={MAX_NOMBRE}
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
            aria-describedby={edadError ? "edad-hint edad-error" : "edad-hint"}
          />
          <FieldDescription id="edad-hint">6 a 59 meses</FieldDescription>
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
            aria-describedby={hbError ? "hb-hint hb-error" : "hb-hint"}
          />
          <FieldDescription id="hb-hint">
            <span className="block">Valor del hemoglobinómetro, ej. 11.5</span>
            <span className="block" data-testid="hb-cutoffs">
              {HB_CUTOFF_LABEL}
            </span>
          </FieldDescription>
          {hbError && <FieldError id="hb-error">{hbError}</FieldError>}
        </Field>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      {/* Single polite announcer: success and duplicate warning used to be
          sibling role=status regions racing each other. One region with
          both messages in DOM order (success first) serializes the
          announcement; the Descartar button stays outside the live region. */}
      {(lastDiagnosis || duplicateWarning) && (
        <p role="status" className="text-sm">
          {lastDiagnosis && (
            <span className="text-success">
              Paciente registrado: <strong>{lastDiagnosis}</strong>
            </span>
          )}
          {lastDiagnosis && duplicateWarning && " "}
          {duplicateWarning && (
            <span className="text-warning">{duplicateWarning}</span>
          )}
        </p>
      )}
      {duplicateWarning && (
        <div>
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
