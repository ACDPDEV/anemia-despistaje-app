import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy Supabase client. Deferred-safe: returns null (no-op) when the project
// URL or anon key is missing, so the app stays fully offline-first.
// Credentials arrive via Vite env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.

let cachedClient: SupabaseClient | null = null;

function readEnv(name: string): string | undefined {
  const value = import.meta.env?.[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function isSupabaseConfigured(): boolean {
  return readEnv("VITE_SUPABASE_URL") !== undefined && readEnv("VITE_SUPABASE_ANON_KEY") !== undefined;
}

export function getSupabaseClient(): SupabaseClient | null {
  const url = readEnv("VITE_SUPABASE_URL");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  if (!cachedClient) {
    cachedClient = createClient(url, anonKey);
  }
  return cachedClient;
}

// Test-only seam: drops the cached client so credential scenarios stay isolated.
export function resetSupabaseClientForTests(): void {
  cachedClient = null;
}
