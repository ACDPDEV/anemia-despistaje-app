import { describe, expect, it } from "vitest";
import {
  ALREADY_REGISTERED_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  OFFLINE_RETRY_MESSAGE,
  RATE_LIMIT_MESSAGE,
  toSpanishErrorMessage,
} from "./errorMessages";
import {
  NO_PENDING_MESSAGE,
  OFFLINE_MESSAGE,
  UNCONFIGURED_MESSAGE,
} from "./sync";
import { PULL_COOLDOWN_MESSAGE, SYNC_BUSY_MESSAGE } from "./syncGuard";

describe("toSpanishErrorMessage", () => {
  it("maps invalid-credential English to the Spanish credentials copy", () => {
    expect(toSpanishErrorMessage("Invalid login credentials")).toBe(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(toSpanishErrorMessage("INVALID LOGIN CREDENTIALS")).toBe(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(
      toSpanishErrorMessage(new Error("Invalid login credentials")),
    ).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it("maps already-registered English to the Spanish account copy", () => {
    expect(toSpanishErrorMessage("User already registered")).toBe(
      ALREADY_REGISTERED_MESSAGE,
    );
  });

  it("maps network failures to the Spanish offline copy", () => {
    expect(toSpanishErrorMessage("Failed to fetch")).toBe(
      OFFLINE_RETRY_MESSAGE,
    );
    expect(toSpanishErrorMessage(new TypeError("Network request failed"))).toBe(
      OFFLINE_RETRY_MESSAGE,
    );
  });

  it("maps throttling to the Spanish rate-limit copy", () => {
    expect(toSpanishErrorMessage("Too many requests")).toBe(
      RATE_LIMIT_MESSAGE,
    );
    expect(toSpanishErrorMessage("Rate limit exceeded")).toBe(
      RATE_LIMIT_MESSAGE,
    );
  });

  it("falls back to the generic Spanish copy for unknown failures", () => {
    expect(toSpanishErrorMessage("boom")).toBe(GENERIC_ERROR_MESSAGE);
    expect(toSpanishErrorMessage(new Error("boom"))).toBe(
      GENERIC_ERROR_MESSAGE,
    );
    expect(toSpanishErrorMessage(null)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("leaves our own Spanish copy verbatim (idempotent at render sites)", () => {
    expect(toSpanishErrorMessage(INVALID_CREDENTIALS_MESSAGE)).toBe(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(
      toSpanishErrorMessage(
        "La autenticación no está configurada en este equipo.",
      ),
    ).toBe("La autenticación no está configurada en este equipo.");
    expect(toSpanishErrorMessage(GENERIC_ERROR_MESSAGE)).toBe(
      GENERIC_ERROR_MESSAGE,
    );
  });

  it("never rewords own business copy: every Spanish constant passes through", () => {
    // Contract pin: throw sites return these directly without wrapping, so
    // the mapper must leave each one untouched when a render-site catch
    // re-applies it defensively.
    const ownCopy = [
      ALREADY_REGISTERED_MESSAGE,
      INVALID_CREDENTIALS_MESSAGE,
      OFFLINE_RETRY_MESSAGE,
      RATE_LIMIT_MESSAGE,
      GENERIC_ERROR_MESSAGE,
      OFFLINE_MESSAGE,
      UNCONFIGURED_MESSAGE,
      NO_PENDING_MESSAGE,
      PULL_COOLDOWN_MESSAGE,
      SYNC_BUSY_MESSAGE,
      "La autenticación no está configurada en este equipo.",
      "No se pudo cerrar la sesión. Inténtalo de nuevo.",
      "No se pudo sincronizar. Inténtalo de nuevo.",
    ];
    for (const message of ownCopy) {
      expect(toSpanishErrorMessage(message)).toBe(message);
      expect(toSpanishErrorMessage(new Error(message))).toBe(message);
    }
  });
});
