import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  isAuthConfigured,
  signInWithPassword,
  signUp,
} from "../lib/auth";

// Login + sign-up form with Spanish labels. When Supabase credentials are
// missing the app stays fully offline-first: an offline/local-only notice
// renders instead of the form, and the shell (App.tsx) bypasses this view
// entirely. Sign-up with email confirmation enabled replaces the form with
// a success notice; without confirmation the session arrives via the
// existing onAuthStateChange machinery in App.tsx.
export function LoginView({ onSignedIn }: { onSignedIn?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Empty fields flag only their own Input; auth failures (wrong
  // credentials, existing account) stay a form-level alert so no field
  // is marked invalid for a server-side outcome.
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (!isAuthConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        La aplicación funciona sin conexión en este equipo. La sincronización
        no está configurada.
      </p>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    // Per-field required check: the shared sentence is split so each
    // empty Input carries its own id, message, and invalid flag.
    const nextEmailError =
      email.trim().length === 0 ? "El correo electrónico es obligatorio." : null;
    const nextPasswordError =
      password.length === 0 ? "La contraseña es obligatoria." : null;
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
          ? err.message
          : mode === "signup"
            ? "No se pudo crear la cuenta."
            : "No se pudo iniciar sesión.",
      );
    } finally {
      setPending(false);
    }
  }

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);
    setConfirmationSent(false);
  }

  const busy = pending;
  const isSignup = mode === "signup";

  if (confirmationSent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
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

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={emailError ? true : undefined}>
          <FieldLabel htmlFor="login-email">Correo electrónico</FieldLabel>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
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
          <Input
            id="login-password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(null);
            }}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? "login-password-error" : undefined}
          />
          {passwordError && (
            <FieldError id="login-password-error">{passwordError}</FieldError>
          )}
        </Field>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {isSignup
            ? pending
              ? "Creando cuenta…"
              : "Crear cuenta"
            : pending
              ? "Iniciando sesión…"
              : "Iniciar sesión"}
        </Button>
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
