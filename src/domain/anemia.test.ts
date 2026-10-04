import { describe, expect, it } from "vitest";
import { evaluatePatient, parseHemoglobina } from "./anemia";

describe("evaluatePatient", () => {
  it("classifies hemoglobin >= 11.0 as Normal", () => {
    expect(evaluatePatient(11.0)).toBe("Normal");
    expect(evaluatePatient(12.5)).toBe("Normal");
  });

  it("classifies hemoglobin 10.0-10.9 as Anemia Leve", () => {
    expect(evaluatePatient(10.0)).toBe("Anemia Leve");
    expect(evaluatePatient(10.5)).toBe("Anemia Leve");
    expect(evaluatePatient(10.9)).toBe("Anemia Leve");
  });

  it("classifies hemoglobin 7.0-9.9 as Anemia Moderada", () => {
    expect(evaluatePatient(7.0)).toBe("Anemia Moderada");
    expect(evaluatePatient(8.4)).toBe("Anemia Moderada");
    expect(evaluatePatient(9.9)).toBe("Anemia Moderada");
  });

  it("classifies hemoglobin below 7.0 as Anemia Severa", () => {
    expect(evaluatePatient(6.9)).toBe("Anemia Severa");
    expect(evaluatePatient(3.5)).toBe("Anemia Severa");
  });

  it("resolves boundary values 7.0 / 10.0 / 11.0 to Moderada / Leve / Normal", () => {
    expect(evaluatePatient(7.0)).toBe("Anemia Moderada");
    expect(evaluatePatient(10.0)).toBe("Anemia Leve");
    expect(evaluatePatient(11.0)).toBe("Normal");
  });

  it("is pure: repeated evaluations return the same diagnosis", () => {
    const first = evaluatePatient(9.5);
    const second = evaluatePatient(9.5);
    expect(second).toBe(first);
    expect([evaluatePatient(12.0), evaluatePatient(12.0)][0]).toBe("Normal");
  });
});

describe("parseHemoglobina (run-26 P1)", () => {
  it("accepts the Spanish comma and the period as the decimal separator", () => {
    expect(parseHemoglobina("11,5")).toBe(11.5);
    expect(parseHemoglobina("11.5")).toBe(11.5);
    expect(parseHemoglobina(" 10,0 ")).toBe(10);
  });

  it("returns NaN for empty and non-numeric entries (callers diagnose those in Spanish)", () => {
    expect(parseHemoglobina("")).toBeNaN();
    expect(parseHemoglobina("   ")).toBeNaN();
    expect(parseHemoglobina("abc")).toBeNaN();
    expect(parseHemoglobina("11,5,3")).toBeNaN();
  });
});
