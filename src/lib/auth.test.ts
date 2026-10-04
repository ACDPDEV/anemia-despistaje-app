import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabase-js so no live network calls happen (no credentials exist).
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ __mockSupabaseClient: true })),
}));

import { createClient } from "@supabase/supabase-js";
import {
  getSession,
  isAuthConfigured,
  onAuthStateChange,
  signInWithGoogle,
  signInWithPassword,
  signOut,
} from "./auth";
import { resetSupabaseClientForTests } from "./supabase";

const mockedCreateClient = vi.mocked(createClient);

function makeFakeAuth(overrides: Record<string, unknown> = {}) {
  return {
    signInWithPassword: vi.fn(async () => ({
      data: { session: { access_token: "tok" } },
      error: null,
    })),
    signInWithOAuth: vi.fn(async () => ({
      data: { provider: "google" },
      error: null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({
      data: { session: { access_token: "tok" } },
      error: null,
    })),
    onAuthStateChange: vi.fn((_cb: unknown) => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  resetSupabaseClientForTests();
  mockedCreateClient.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth module", () => {
  it("is unconfigured without credentials: false, null session, noop unsubscribe", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    expect(isAuthConfigured()).toBe(false);
    expect(mockedCreateClient).not.toHaveBeenCalled();

    await expect(getSession()).resolves.toBeNull();
    await expect(signInWithPassword("a@b.c", "secret")).rejects.toThrow(
      /no está configurada/,
    );
    await expect(signOut()).resolves.toBeUndefined();

    const calls: string[] = [];
    const unsubscribe = onAuthStateChange(() => {
      calls.push("called");
    });
    unsubscribe();
    expect(calls).toEqual([]);
  });

  it("returns the session through the injected fake client", async () => {
    const fake = makeFakeAuth();
    const session = await getSession({ auth: fake } as never);
    expect(session).toEqual({ access_token: "tok" });
    expect(fake.getSession).toHaveBeenCalledTimes(1);
  });

  it("signs in and surfaces auth errors in Spanish-friendly Error", async () => {
    const fake = makeFakeAuth();
    const session = await signInWithPassword("a@b.c", "secret", {
      auth: fake,
    } as never);
    expect(session).toEqual({ access_token: "tok" });
    expect(fake.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "secret",
    });

    const failing = makeFakeAuth({
      signInWithPassword: vi.fn(async () => ({
        data: {},
        error: { message: "Invalid login credentials" },
      })),
    });
    await expect(
      signInWithPassword("a@b.c", "wrong", { auth: failing } as never),
    ).rejects.toThrow("Invalid login credentials");
  });

  it("signs out and forwards the unsubscribe", async () => {
    const fake = makeFakeAuth();
    await signOut({ auth: fake } as never);
    expect(fake.signOut).toHaveBeenCalledTimes(1);

    const unsubscribeSpy = vi.fn();
    const sub = makeFakeAuth({
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: unsubscribeSpy } },
      })),
    });
    const seen: unknown[] = [];
    const unsubscribe = onAuthStateChange(
      (_e, s) => {
        seen.push(s);
      },
      { auth: sub } as never,
    );
    expect(sub.onAuthStateChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it("propagates session transitions from onAuthStateChange", async () => {
    let captured: ((event: string, session: unknown) => void) | undefined;
    const fake = makeFakeAuth({
      onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => {
        captured = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    });
    const seen: unknown[] = [];
    onAuthStateChange((_e, s) => seen.push(s), { auth: fake } as never);
    expect(captured).toBeDefined();
    captured?.("SIGNED_IN", { access_token: "tok" });
    captured?.("SIGNED_OUT", null);
    expect(seen).toEqual([{ access_token: "tok" }, null]);
  });

  it("signs in with Google via OAuth redirecting to the app origin", async () => {
    const fake = makeFakeAuth();
    const result = await signInWithGoogle({ auth: fake } as never);
    expect(result).toEqual({ ok: true });
    expect(fake.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  });

  it("surfaces Google OAuth failures and unconfigured client in Spanish", async () => {
    const failing = makeFakeAuth({
      signInWithOAuth: vi.fn(async () => ({
        data: {},
        error: { message: "Provider not enabled" },
      })),
    });
    await expect(
      signInWithGoogle({ auth: failing } as never),
    ).resolves.toEqual({ ok: false, error: "Provider not enabled" });

    await expect(signInWithGoogle(null)).resolves.toEqual({
      ok: false,
      error: "La autenticación no está configurada en este equipo.",
    });
  });
});
