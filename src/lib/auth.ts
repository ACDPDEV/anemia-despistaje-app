import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";
import { toSpanishErrorMessage } from "./errorMessages";

// Thin seam over supabase-js auth. Unconfigured (no credentials) the client
// is null and every call is a no-op so the app stays fully offline-first.
// Tests inject fakes through the optional client parameter, like SyncTable.

export type AuthClient = {
  signInWithPassword: (creds: {
    email: string;
    password: string;
  }) => Promise<{ data: unknown; error: { message: string } | null }>;
  signUp: (creds: {
    email: string;
    password: string;
  }) => Promise<{ data: unknown; error: { message: string } | null }>;
  resetPasswordForEmail: (
    email: string,
    options?: { redirectTo?: string },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
  getSession: () => Promise<{
    data: { session: Session | null };
    error: { message: string } | null;
  }>;
  onAuthStateChange: (
    callback: (event: string, session: Session | null) => void,
  ) => { data: { subscription: { unsubscribe: () => void } } };
};

type SupabaseLike = {
  auth: AuthClient;
};

function resolveClient(explicit?: SupabaseLike | null): SupabaseLike | null {
  if (explicit !== undefined) return explicit;
  return getSupabaseClient() as unknown as SupabaseLike | null;
}

export function isAuthConfigured(): boolean {
  return getSupabaseClient() !== null;
}

export async function getSession(
  explicit?: SupabaseLike | null,
): Promise<Session | null> {
  const client = resolveClient(explicit);
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(toSpanishErrorMessage(error.message));
  return data.session;
}

export async function signInWithPassword(
  email: string,
  password: string,
  explicit?: SupabaseLike | null,
): Promise<Session | null> {
  const client = resolveClient(explicit);
  if (!client) throw new Error("La autenticación no está configurada en este equipo.");
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(toSpanishErrorMessage(error.message));
  const session = (data as { session?: Session | null }).session ?? null;
  return session;
}

// Email+password registration over supabase.auth.signUp.
// Returns needsConfirmation=true when Supabase runs in email-confirmation
// mode (session null but user present); otherwise the session is active and
// the existing onAuthStateChange machinery in App.tsx gates forward.
export type SignUpResult = {
  ok: true;
  session: Session | null;
  needsConfirmation: boolean;
};

export async function signUp(
  email: string,
  password: string,
  explicit?: SupabaseLike | null,
): Promise<SignUpResult> {
  const client = resolveClient(explicit);
  if (!client) throw new Error("La autenticación no está configurada en este equipo.");
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(toSpanishErrorMessage(error.message));
  const session =
    (data as { session?: Session | null }).session ?? null;
  const user = (data as { user?: unknown }).user ?? null;
  return {
    ok: true,
    session,
    needsConfirmation: session === null && user !== null,
  };
}

export async function signOut(
  explicit?: SupabaseLike | null,
): Promise<void> {
  const client = resolveClient(explicit);
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw new Error(toSpanishErrorMessage(error.message));
}

// Recovery email over supabase.auth.resetPasswordForEmail. Redirects back
// to the app origin so the recovery link lands on this deployment; that
// origin must be allowlisted under Supabase Dashboard → Authentication →
// URL Configuration → Redirect URLs, or the link is rejected server-side.
export async function requestPasswordReset(
  email: string,
  explicit?: SupabaseLike | null,
): Promise<void> {
  const client = resolveClient(explicit);
  if (!client) throw new Error("La autenticación no está configurada en este equipo.");
  const redirectTo =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await client.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) throw new Error(toSpanishErrorMessage(error.message));
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
  explicit?: SupabaseLike | null,
): () => void {
  const client = resolveClient(explicit);
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}
