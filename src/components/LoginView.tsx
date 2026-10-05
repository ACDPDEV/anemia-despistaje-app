import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useOnline } from "../hooks/useOnline";
import {
  requestPasswordReset,
  signInWithPassword,
  signUp,
} from "../lib/auth";
import {
  ALREADY_REGISTERED_MESSAGE,
  OFFLINE_RETRY_MESSAGE,
  toSpanishErrorMessage,
} from "../lib/errorMessages";

// Login + sign-up form with Spanish labels. Sign-up with email confirmation
// enabled replaces the form with a success notice; without confirmation the
// session arrives via the existing onAuthStateChange machinery in App.tsx.
// No unconfigured/offline branch (run-17 P3-2): App.tsx only mounts this
// view inside `if (authConfigured && !session)`, so isAuthConfigured() is
// always true here and that branch could never render — deleted, not kept.
// Offline is notice-only (run-30 P3): sign-in still requires connection, so
// there is no bypass and the gate stays; the notice only makes the doomed
// network call unsurprising. Recovery mail goes through Supabase
// resetPasswordForEmail with the app origin as redirect (that origin must
// be allowlisted in the Supabase dashboard redirect URLs).
const EMAIL_REQUIRED_MESSAGE = "El correo electrónico es obligatorio.";
const EMAIL_FORMAT_MESSAGE = "Escribe un correo electrónico válido.";
const PASSWORD_REQUIRED_MESSAGE = "La contraseña es obligatoria.";
const PASSWORD_MIN_LENGTH_MESSAGE = "Mínimo 6 caracteres.";
const RESET_SEND_FAILED_MESSAGE = "No se pudo enviar el enlace de recuperación.";
const RESET_SENT_MESSAGE =
  "Revisa tu correo. Te enviamos un enlace para restablecer tu contraseña.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailFieldError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return EMAIL_REQUIRED_MESSAGE;
  if (!EMAIL_PATTERN.test(trimmed)) return EMAIL_FORMAT_MESSAGE;
  return null;
}

// Login form component (sign-in, sign-up, and password recovery).
export function LoginView({ onSignedIn }: { onSignedIn?: () => void }) {
  const online = useOnline();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Empty/short fields flag only their own Input; auth failures (wrong
  // credentials, existing account) stay a form-level alert so no field
  // is marked invalid for a server-side outcome. Format errors are
  // client-side and DO own the email field (blur/submit, before any
  // network call); a short password likewise owns its field pre-network.
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Repeat-failure re-announce (harden): React bails out when the same
  // string is set twice, so an identical second failure would reuse the
  // live node and the [formError] focus effect would never refire. The
  // attempt counter keys a fresh alert node per failure and joins the
  // focus effect deps, so every attempt announces once + moves focus.
  const [formErrorAttempt, setFormErrorAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  // Forgotten-password sub-view (sign-in only): replaces the form, then a
  // confirmation notice on success. No bypass — it only sends the mail.
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetPending, setResetPending] = useState(false);

  const emailRef = useRef<HTMLInputElement | null>(null);
  const formAlertRef = useRef<HTMLParagraphElement | null>(null);
  const confirmationRef = useRef<HTMLParagraphElement | null>(null);
  const resetConfirmationRef = useRef<HTMLParagraphElement | null>(null);
  const mounted = useRef(false);

  // Focus management (run-30 P2-b): view switches land on the email field,
  // the confirmation notice and the form-level alert take focus when they
  // appear so screen readers announce them. Field focus is never pinned by
  // tests, so the alert owns focus on auth failure.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (confirmationSent || resetSent) return;
    emailRef.current?.focus();
  }, [mode, showReset, confirmationSent, resetSent]);
  useEffect(() => {
    if (formError) formAlertRef.current?.focus();
  }, [formError, formErrorAttempt]);
  useEffect(() => {
    if (confirmationSent) confirmationRef.current?.focus();
  }, [confirmationSent]);
  useEffect(() => {
    if (resetSent) resetConfirmationRef.current?.focus();
  }, [resetSent]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    // Per-field check BEFORE any network call: the shared sentence is
    // split so each empty Input carries its own id, message, and invalid
    // flag, and a malformed email never reaches Supabase.
    const nextEmailError = emailFieldError(email);
    const nextPasswordError =
      password.length === 0
        ? PASSWORD_REQUIRED_MESSAGE
        : password.length < 6
          ? PASSWORD_MIN_LENGTH_MESSAGE
          : null;
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;
    setPending(true);
    setFormError(null);
    try {
      if (mode === "signup") {
        const result = await signUp(email.trim(), password);
        if (result.needsConfirmation) {
          setConfirmationSent(true);
        } else {
          onSignedIn?.();
        }
      } else {
        await signInWithPassword(email.trim(), password);
        onSignedIn?.();
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? toSpanishErrorMessage(err.message)
          : mode === "signup"
            ? "No se pudo crear la cuenta."
            : "No se pudo iniciar sesión.",
      );
      setFormErrorAttempt((c) => c + 1);
    } finally {
      setPending(false);
    }
  }

  async function handleResetSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (resetPending) return;
    const nextEmailError = emailFieldError(email);
    setEmailError(nextEmailError);
    if (nextEmailError) return;
    setResetPending(true);
    setFormError(null);
    try {
      await requestPasswordReset(email.trim());
      setResetSent(true);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? toSpanishErrorMessage(err.message)
          : RESET_SEND_FAILED_MESSAGE,
      );
      setFormErrorAttempt((c) => c + 1);
    } finally {
      setResetPending(false);
    }
  }

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    // Shared-device hygiene: the password never survives a mode switch,
    // the email does (it is the recovery target for "already registered").
    setPassword("");
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);
    setConfirmationSent(false);
    setShowPassword(false);
  }

  function openReset() {
    setShowReset(true);
    // Shared-device hygiene (same contract as switchMode): the password
    // never survives the recovery detour, the email does (it is the
    // recovery target). Also drop the visibility toggle so a revealed
    // password never greets the next user on return.
    setPassword("");
    setShowPassword(false);
    setEmailError(null);
    setFormError(null);
  }

  function closeReset() {
    setShowReset(false);
    setResetSent(false);
    // Return path clears too: a password typed before the detour must not
    // linger one screen longer if the user abandons recovery.
    setPassword("");
    setShowPassword(false);
    setEmailError(null);
    setFormError(null);
  }

  const busy = pending;
  const isSignup = mode === "signup";

  // Proactive offline notice (run-30 P3): honest, visible, no bypass — the
  // submit behavior underneath is unchanged.
  const offlineNotice = !online ? (
    <p role="status" className="text-sm text-muted-foreground">
      {OFFLINE_RETRY_MESSAGE}
    </p>
  ) : null;

  // "Already registered" carries its own recovery: one click lands on
  // sign-in with the email preserved (switchMode keeps it, drops the
  // password). Server failures stay form-level — the fields keep no
  // invalid flag for a server-side outcome.
  const showAlreadyRegisteredRecovery =
    isSignup && formError === ALREADY_REGISTERED_MESSAGE;
  const formAlert = formError ? (
    <div key={formErrorAttempt} className="flex flex-col gap-1">
      <p ref={formAlertRef} tabIndex={-1} role="alert" className="text-sm text-destructive">
        {formError}
      </p>
      {showAlreadyRegisteredRecovery && (
        <Button
          type="button"
          variant="link"
          className="self-start px-0"
          onClick={() => switchMode("signin")}
        >
          Ir a iniciar sesión
        </Button>
      )}
    </div>
  ) : null;

  if (confirmationSent) {
    return (
      <div className="flex flex-col gap-4">
        <p ref={confirmationRef} tabIndex={-1} role="status" className="text-sm text-muted-foreground">
          Cuenta creada. Revisa tu correo para confirmar tu cuenta.
        </p>
        <Button
          type="button"
          variant="link"
          onClick={() => switchMode("signin")}
        >
          Volver a iniciar sesión
        </Button>
      </div>
    );
  }

  if (showReset) {
    if (resetSent) {
      return (
        <div className="flex flex-col gap-4">
          <p ref={resetConfirmationRef} tabIndex={-1} role="status" className="text-sm text-muted-foreground">
            {RESET_SENT_MESSAGE}
          </p>
          <Button type="button" variant="link" onClick={closeReset}>
            Volver a iniciar sesión
          </Button>
        </div>
      );
    }
    return (
      // noValidate (Spanish-first, same decision as RegisterForm): native
      // bubbles speak the browser's language, so every value reaches the
      // React handler and the inline Spanish check answers first.
      <form onSubmit={handleResetSubmit} noValidate>
        <FieldGroup>
          {offlineNotice}
          <Field data-invalid={emailError ? true : undefined}>
            <FieldLabel htmlFor="login-email">Correo electrónico</FieldLabel>
            <Input
              ref={emailRef}
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              onBlur={() => {
                // Blur-time format nag only: empty stays a submit-time
                // concern, a filled malformed value flags immediately.
                const trimmed = email.trim();
                if (trimmed.length === 0) return;
                setEmailError(
                  EMAIL_PATTERN.test(trimmed) ? null : EMAIL_FORMAT_MESSAGE,
                );
              }}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "login-email-error" : undefined}
            />
            {emailError && (
              <FieldError id="login-email-error">{emailError}</FieldError>
            )}
          </Field>
          {formAlert}
          <Button type="submit" disabled={resetPending}>
            {resetPending ? "Enviando enlace…" : "Enviar enlace de recuperación"}
          </Button>
          <Button
            type="button"
            variant="link"
            disabled={resetPending}
            onClick={closeReset}
          >
            Volver a iniciar sesión
          </Button>
        </FieldGroup>
      </form>
    );
  }

  return (
    // noValidate (Spanish-first, same decision as RegisterForm): native
    // bubbles speak the browser's language, so every value reaches the
    // React handler and the inline Spanish check answers first.
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        {offlineNotice}
        <Field data-invalid={emailError ? true : undefined}>
          <FieldLabel htmlFor="login-email">Correo electrónico</FieldLabel>
          <Input
            ref={emailRef}
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            onBlur={() => {
              // Blur-time format nag only: empty stays a submit-time
              // concern, a filled malformed value flags immediately.
              const trimmed = email.trim();
              if (trimmed.length === 0) return;
              setEmailError(
                EMAIL_PATTERN.test(trimmed) ? null : EMAIL_FORMAT_MESSAGE,
              );
            }}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "login-email-error" : undefined}
          />
          {emailError && (
            <FieldError id="login-email-error">{emailError}</FieldError>
          )}
        </Field>
        <Field data-invalid={passwordError ? true : undefined}>
          <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
          {/* Absolute toggle: showing/hiding never moves siblings. */}
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "login-password-error" : undefined}
              className="pr-24"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-1/2 right-1 min-h-11 -translate-y-1/2"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              disabled={busy}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
          {passwordError && (
            <FieldError id="login-password-error">{passwordError}</FieldError>
          )}
        </Field>
        {formAlert}
        {/* run-28 P3-1 (polish, documented skip): pending stays label-only
            ("Iniciando sesión…" / "Creando cuenta…") with disabled grammar
            and no spinner. No Loader2/animate-spin precedent exists in the
            codebase, and scattered motion would break the quiet capture
            surface (craft-floor: one authored moment, never decoration). */}
        <Button type="submit" disabled={busy}>
          {isSignup
            ? pending
              ? "Creando cuenta…"
              : "Crear cuenta"
            : pending
              ? "Iniciando sesión…"
              : "Iniciar sesión"}
        </Button>
        {!isSignup && (
          <Button
            type="button"
            variant="link"
            disabled={busy}
            onClick={openReset}
          >
            ¿Olvidaste tu contraseña?
          </Button>
        )}
        <Button
          type="button"
          variant="link"
          disabled={busy}
          onClick={() => switchMode(isSignup ? "signin" : "signup")}
        >
          {isSignup
            ? "¿Ya tienes cuenta? Iniciar sesión"
            : "¿No tienes cuenta? Crear cuenta"}
        </Button>
      </FieldGroup>
    </form>
  );
}
