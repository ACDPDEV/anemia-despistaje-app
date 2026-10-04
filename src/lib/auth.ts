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
  signInWithOAuth: (args: {
    provider: "google";
    options?: { redirectTo?: string };
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

// Google sign-in via Supabase OAuth. The browser redirects to Google and back
// to `redirectTo`; the existing onAuthStateChange machinery picks up the
// session on the return trip, so there is nothing else to wire here.
//
// LIVE PREREQUISITE (not code): enable the Google provider in the Supabase
// dashboard (Authentication → Providers → Google) with a Google Cloud OAuth
// client before live use; otherwise signInWithOAuth fails at runtime.
//
// TAURI CAVEAT (remaining blocker, do NOT work around here): the Tauri
// desktop build has no http(s) origin to redirect back to, so OAuth needs
// deep-link handling (tauri-plugin-deep-link / opener with a custom scheme
// registered as redirect URL) before live verification on desktop. Web dev
// (`window.location.origin` redirect) works as-is.
export async function signInWithGoogle(
  explicit?: SupabaseLike | null,
): Promise<{ ok: boolean; error?: string }> {
  const client = resolveClient(explicit);
  if (!client)
    return {
      ok: false,
      error: "La autenticación no está configurada en este equipo.",
    };
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
