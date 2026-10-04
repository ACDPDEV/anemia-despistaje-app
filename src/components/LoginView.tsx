import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  isAuthConfigured,
  signInWithGoogle,
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
  const [oauthPending, setOauthPending] = useState(false);

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
  const busy = pending || oauthPending;

  async function handleGoogle() {
    if (busy) return;
    setOauthPending(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      // On success the browser leaves for Google and onAuthStateChange picks
      // up the session on return — no onSignedIn() call here.
      if (!result.ok) {
        setError(result.error ?? "No se pudo iniciar sesión con Google.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo iniciar sesión con Google.",
      );
    } finally {
      setOauthPending(false);
    }
  }

  return (
    <div>
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
    <div
      aria-hidden="true"
      className="my-4 flex items-center gap-3 text-sm text-muted-foreground"
    >
      <span className="h-px flex-1 bg-border" />
      <span>o</span>
      <span className="h-px flex-1 bg-border" />
    </div>
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={handleGoogle}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="size-4"
      >
        <path d="M21.35 11.1H12v2.9h5.35c-.5 2.4-2.55 3.5-5.35 3.5a5.9 5.9 0 0 1 0-11.8c1.5 0 2.85.55 3.9 1.45l2.05-2.05A8.35 8.35 0 0 0 12 2.5a9.5 9.5 0 0 0 0 19c4.65 0 8.6-3.35 8.6-9.15 0-.4-.05-.85-.25-1.25Z" />
      </svg>
      {oauthPending ? "Conectando con Google…" : "Continuar con Google"}
    </Button>
    </div>
  );
}
