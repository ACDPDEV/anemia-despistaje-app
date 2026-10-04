// Spanish error mapper for the Supabase/PostgREST boundary.
//
// CONTRACT: the input is ALWAYS a raw provider message (English). Our own
// business copy is ALREADY Spanish and must never be wrapped: throw sites
// in auth.ts/sync.ts call this mapper only on `error.message` from the
// Supabase client, while own-copy throws/returns (unconfigured auth, offline
// queue, no-pending) go out directly in Spanish. Render-site catches
// (LoginView, SyncStatusChip, app-sidebar) re-apply the mapper ONLY as a
// safety net for unexpected raws that bypass the throw-site mapping — the
// diacritics guard below makes that re-entry idempotent on own copy.
// The raw message survives only in console.debug.
//
// PRODUCT invariant: "el usuario de campo no ve inglés". Raw provider
// messages (English) must never reach a role=alert surface.

// Known bad credentials (Supabase Auth).
export const INVALID_CREDENTIALS_MESSAGE =
  "Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.";
// Email already taken (Supabase Auth sign-up).
export const ALREADY_REGISTERED_MESSAGE =
  "Ese correo ya está registrado. Inicia sesión o usa otro correo.";
// Provider unreachable: generic retry (sync.ts keeps its own OFFLINE_MESSAGE
// for the queued-changes case; this one fits auth and ad-hoc failures).
export const OFFLINE_RETRY_MESSAGE =
  "Sin conexión. Revisa tu red e inténtalo de nuevo.";
// Provider throttling.
export const RATE_LIMIT_MESSAGE =
  "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
// Last resort: always Spanish, always actionable.
export const GENERIC_ERROR_MESSAGE =
  "No se pudo completar la operación. Inténtalo de nuevo.";

const CREDENTIALS_PATTERNS = [
  "invalid login",
  "invalid credential",
  "invalid email or password",
  "invalid password",
  "wrong password",
  "email or password",
];

const REGISTERED_PATTERNS = [
  "already registered",
  "already exists",
  "already in use",
  "email already",
];

const NETWORK_PATTERNS = [
  "failed to fetch",
  "network",
  "fetch",
  "offline",
  "load failed",
  "timeout",
  "econn",
  "enotfound",
];

const RATE_LIMIT_PATTERNS = [
  "rate limit",
  "too many requests",
  "too many",
  "429",
];

function extractMessage(raw: unknown): string {
  if (raw instanceof Error) return raw.message ?? "";
  if (typeof raw === "string") return raw;
  if (raw !== null && typeof raw === "object") {
    const candidate = raw as { message?: unknown; code?: unknown };
    const parts = [
      typeof candidate.message === "string" ? candidate.message : "",
      typeof candidate.code === "string" ? candidate.code : "",
    ].filter((part) => part.length > 0);
    if (parts.length > 0) return parts.join(" ");
  }
  return "";
}

function matchesAny(lower: string, patterns: string[]): boolean {
  return patterns.some((pattern) => lower.includes(pattern));
}

// Maps a raw provider failure to field-user Spanish. Unknown input falls
// back to GENERIC_ERROR_MESSAGE. The diacritics guard is a cheap safety
// net ONLY: per the contract above our own copy never enters the mapper on
// purpose, but render-site catches re-apply it defensively, so Spanish
// input (recognizable by its diacritics) returns untouched instead of
// being reworded or swallowed by an English pattern.
export function toSpanishErrorMessage(raw: unknown): string {
  const message = extractMessage(raw);
  if (message.length === 0) return GENERIC_ERROR_MESSAGE;
  // Our own copy passes through verbatim: never reword Spanish.
  if (/[áéíóúñ¿¡]/i.test(message)) return message;
  const lower = message.toLowerCase();
  if (matchesAny(lower, CREDENTIALS_PATTERNS)) {
    console.debug("[supabase error]", message);
    return INVALID_CREDENTIALS_MESSAGE;
  }
  if (matchesAny(lower, REGISTERED_PATTERNS)) {
    console.debug("[supabase error]", message);
    return ALREADY_REGISTERED_MESSAGE;
  }
  if (matchesAny(lower, NETWORK_PATTERNS)) {
    console.debug("[supabase error]", message);
    return OFFLINE_RETRY_MESSAGE;
  }
  if (matchesAny(lower, RATE_LIMIT_PATTERNS)) {
    console.debug("[supabase error]", message);
    return RATE_LIMIT_MESSAGE;
  }
  console.debug("[supabase error]", message);
  return GENERIC_ERROR_MESSAGE;
}
