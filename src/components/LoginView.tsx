import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  isAuthConfigured,
  signInWithPassword,
} from "../lib/auth";

// Login form with Spanish labels. When Supabase credentials are missing the
// app stays fully offline-first: an offline/local-only notice renders instead
// of the form, and the shell (App.tsx) bypasses this view entirely.
export function LoginView({ onSignedIn }: { onSignedIn?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      await signInWithPassword(email.trim(), password);
      onSignedIn?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo iniciar sesión.",
      );
    } finally {
      setPending(false);
    }
  }

  const invalid = error !== null;
  const busy = pending;

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
            autoComplete="current-password"
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
          {pending ? "Iniciando sesión…" : "Iniciar sesión"}
        </Button>
      </FieldGroup>
    </form>
  );
}
