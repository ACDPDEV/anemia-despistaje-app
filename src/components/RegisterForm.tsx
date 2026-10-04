import { useRef, useState } from "react";
import { getDuplicateWarning, MAX_NOMBRE, usePadronStore } from "../stores/padronStore";
import { useRegisterDraftStore } from "../stores/registerDraftStore";
import { HB_CUTOFF_LABEL, parseHemoglobina, type Diagnosis } from "../domain/anemia";
import { HelpSteps } from "./app-sidebar";
import { PhoneSyncRow } from "./SyncStatusChip";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Registration form with Spanish labels and validation messages.
// Delegates persistence and diagnosis to the padron store.
// Field values (Nombre/Edad/Hb) are controlled by the persisted draft
// store, not local useState: switching tabs unmounts this form, and the
// draft must survive that (jornada interruptions) plus full reloads.
// One selector per field keeps keystroke renders to one, same as useState.
// Errors, success, and duplicate warning stay local (ephemeral UI).
// Validation errors are per-field (each Input points at its own error id);
// only store-level failures (e.g. the 100-record cap) use the form alert
// and leave every field valid.
export function RegisterForm() {
  const add = usePadronStore((s) => s.add);
  const nombre = useRegisterDraftStore((s) => s.nombre);
  const edad = useRegisterDraftStore((s) => s.edad);
  const hb = useRegisterDraftStore((s) => s.hb);
  const setDraft = useRegisterDraftStore((s) => s.setDraft);
  const clearDraft = useRegisterDraftStore((s) => s.clearDraft);
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [edadError, setEdadError] = useState<string | null>(null);
  const [hbError, setHbError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastRegistered, setLastRegistered] = useState<{
    nombre: string;
    diagnostico: Diagnosis;
  } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  // Capture-loop shortcut: after a successful register, focus returns to
  // Nombre so the next patient needs no extra click. Deferred with
  // setTimeout 0 so the success announcer settles first.
  const nombreRef = useRef<HTMLInputElement>(null);

  // Audit: Spanish JS validation is the sole enforcement of clinical
  // invariants (6–59, Hb>0, cap 100); native min/max/step are advisory.
  // Any refactor weakening these checks removes the bound entirely —
  // tests must stay green.
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLastRegistered(null);
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
    const nivelHemoglobina = parseHemoglobina(hb);
    const nextHbError = !Number.isFinite(nivelHemoglobina)
      ? "El nivel de hemoglobina debe ser un número como 11.5 o 11,5."
      : nivelHemoglobina <= 0
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
    // Capture the nombre BEFORE the draft is consumed: the receipt names
    // the patient (privacy is consistent — the padrón table already shows
    // names, and this is the nurse's own local data).
    const registeredNombre = nombre.trim();
    setLastRegistered({
      nombre: registeredNombre,
      diagnostico:
        usePadronStore.getState().pacientes.at(-1)?.diagnostico ?? "Normal",
    });
    // The draft is consumed: a registered patient must never replay.
    clearDraft();
    window.setTimeout(() => nombreRef.current?.focus(), 0);
  }

  return (
    // noValidate (Spanish-first harden): native bubbles speak the browser's
    // locale, so interactive validation is off and the submit validation
    // above owns EVERY message in Spanish. min/max/step/inputMode stay as
    // progressive enhancement only (numeric keyboards, advisory semantics) —
    // they never explain a failure first.
    <form id="register-form" onSubmit={handleSubmit} noValidate>
      {/* Phone-only sync row (shared PhoneSyncRow, identical structure on
          Registro/Padrón/Panel): the sidebar footer hides inside the
          hamburger Sheet on phones, so sync sits above the capture fields.
          Quiet when clean + online — the capture loop never sees it. The
          action is type="button", so it can never submit this form. */}
      <PhoneSyncRow testId="register-sync-phone" />
      <FieldGroup>
        <Field data-invalid={nombreError ? true : undefined}>
          <FieldLabel htmlFor="nombre">Nombre del paciente</FieldLabel>
          <Input
            id="nombre"
            ref={nombreRef}
            value={nombre}
            maxLength={MAX_NOMBRE}
            onChange={(e) => {
              setDraft({ nombre: e.target.value });
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
          {/* Edad keeps type=number (integer months, no decimal separator
              for the comma bug to bite) with native min/max/step as
              advisory bounds only: noValidate above means out-of-range
              values reach the Spanish submit validation instead of a
              browser-locale bubble. The draft store still receives strings
              (e.target.value is always a string, even for type=number). */}
          <Input
            id="edad"
            type="number"
            min={6}
            max={59}
            step={1}
            inputMode="numeric"
            value={edad}
            onChange={(e) => {
              setDraft({ edad: e.target.value });
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
          {/* type=text + parseHemoglobina (run-26 P1): type=number
              sanitizes the Spanish comma to "" before onChange fires, so the
              comma never reaches our code on a number input — in jsdom AND
              in Chrome (same HTML rule). The text input receives "11,5"
              intact and the parser normalizes it to 11.5; inputMode keeps
              the decimal keyboard on phones. */}
          <Input
            id="hb"
            type="text"
            inputMode="decimal"
            value={hb}
            onChange={(e) => {
              setDraft({ hb: e.target.value });
              if (hbError) setHbError(null);
            }}
            aria-invalid={hbError ? true : undefined}
            aria-describedby={hbError ? "hb-hint hb-error" : "hb-hint"}
          />
          <FieldDescription id="hb-hint">
            <span className="block">Valor del hemoglobinómetro, ej. 11.5</span>
            <span className="block">
              Usa punto o coma — aceptamos ambas (11.5 o 11,5).
            </span>
            <span className="block" data-testid="hb-cutoffs">
              {HB_CUTOFF_LABEL}
            </span>
          </FieldDescription>
          {/* Contextual help at the most-confusing moment (the Hb cutoffs):
              the SAME 4 steps as the sidebar footer, behind one quiet
              details/summary line. The summary itself carries the triage
              cue (run-28 P2-1): always visible without opening the
              disclosure, one tap still opens the full steps. Muted and
              small so it never competes with the form; outside the
              hb-hint description so screen readers meet it as its own
              disclosure, not as field hint noise on every Hb focus. The
              full cue sentence stays verbatim in the disclosure body.
              run-29 P3-2 (polish, accepted): the cue may wrap to two lines
              below ~320px — accepted pending a field report; never
              truncated (truncation would hide the triage). */}
          <details
            data-testid="register-help"
            className="text-xs text-muted-foreground"
          >
            <summary className="cursor-pointer underline-offset-4 hover:underline pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center">
              ¿Cómo registro? · Moderada/Severa → Panel
            </summary>
            <HelpSteps />
            <p className="mt-1" data-testid="hb-triage">
              Moderada o Severa → seguimiento en el Panel
            </p>
          </details>
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
      {(lastRegistered || duplicateWarning) && (
        <p role="status" className="text-sm">
          {lastRegistered && (
            <span className="block truncate text-success">
              Paciente registrado: {lastRegistered.nombre} —{" "}
              <strong>{lastRegistered.diagnostico}</strong>
            </span>
          )}
          {lastRegistered && duplicateWarning && " "}
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
      <Button
        type="submit"
        data-testid="register-submit"
        aria-keyshortcuts="Alt+S"
        title="Registrar paciente (Alt+S)"
      >
        Registrar paciente
      </Button>
      </FieldGroup>
      {/* Phone-only thumb-zone submit (run-29 P2-1, adapt): Alt+1/2/3/S/G
          are desktop-only, so the field nurse on a phone gets the same
          submit in thumb reach. INSIDE the form as a second type="submit":
          native submit runs the identical handleSubmit guards (Spanish
          validation, 100-cap, warning-only duplicate flow) — no second
          behavior, focus/dirty/duplicate flows untouched. sticky (not
          fixed) so it only rides along while the form is on screen;
          sm:hidden keeps it off desktop where the primary button + Alt+S
          own the action; print:hidden keeps it off paper. Registro-only
          by construction (this component mounts on the Registro tab
          alone). Quiet Card surface (border-top, bg-card, no shadow, no
          live region — nothing to double-announce): the short "Registrar"
          label is the small-screen form of the primary action. */}
      <div
        data-testid="register-submit-bar"
        className="sticky bottom-0 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden print:hidden"
      >
        <Button
          type="submit"
          data-testid="register-submit-phone"
          aria-keyshortcuts="Alt+S"
          title="Registrar paciente (Alt+S)"
          className="min-h-11 w-full"
        >
          Registrar
        </Button>
      </div>
    </form>
  );
}
