import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
  const [error, setError] = useState<string | null>(null);
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
    if (email.trim().length === 0 || password.length === 0) {
      setError("El correo y la contraseña son obligatorios.");
      return;
    }
    setPending(true);
    setError(null);
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
      setError(
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
    setError(null);
    setConfirmationSent(false);
  }

  const invalid = error !== null;
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
        <Field data-invalid={invalid ? true : undefined}>
          <FieldLabel htmlFor="login-email">Correo electrónico</FieldLabel>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={invalid ? true : undefined}
          />
        </Field>
        <Field data-invalid={invalid ? true : undefined}>
          <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
          <Input
            id="login-password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={invalid ? true : undefined}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
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
