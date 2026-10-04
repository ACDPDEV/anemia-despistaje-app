import { describe, expect, it } from "vitest";
import { normalizeNombre } from "./normalize";

describe("normalizeNombre", () => {
  it("folds diacritics and lowercases (José → jose)", () => {
    expect(normalizeNombre("José")).toBe("jose");
    expect(normalizeNombre("María López")).toBe("maria lopez");
  });

  it("trims and collapses inner whitespace", () => {
    expect(normalizeNombre("  maria   lopez  ")).toBe("maria lopez");
    expect(normalizeNombre(" maria  lopez ")).toBe("maria lopez");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeNombre("")).toBe("");
    expect(normalizeNombre("   ")).toBe("");
  });
});
