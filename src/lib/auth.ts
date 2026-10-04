import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";

// Thin seam over supabase-js auth. Unconfigured (no credentials) the client
// is null and every call is a no-op so the app stays fully offline-first.
// Tests inject fakes through the optional client parameter, like SyncTable.

export type AuthClient = {
  signInWithPassword: (creds: {
    email: string;
    password: string;
  }) => Promise<{ data: unknown; error: { message: string } | null }>;
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  const session = (data as { session?: Session | null }).session ?? null;
  return session;
}

export async function signOut(
  explicit?: SupabaseLike | null,
): Promise<void> {
  const client = resolveClient(explicit);
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
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
