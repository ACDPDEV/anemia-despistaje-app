import { describe, expect, it } from "vitest";
import { groupByAgeBand } from "./ageGroups";

// Presentation-only grouping for the dashboard age chart.
// Boundary rule: edadMeses < 24 → "6-23", otherwise "24-59".
// Lives outside domain/anemia.ts (no clinical threshold involved).
describe("groupByAgeBand", () => {
  it("counts a 23-month-old patient in the 6-23 band", () => {
    expect(groupByAgeBand([{ edadMeses: 23 }])).toEqual({ "6-23": 1, "24-59": 0 });
  });

  it("counts a patient aged exactly 24 months in the 24-59 band", () => {
    expect(groupByAgeBand([{ edadMeses: 24 }])).toEqual({ "6-23": 0, "24-59": 1 });
  });

  it("returns zero counts for an empty padron", () => {
    expect(groupByAgeBand([])).toEqual({ "6-23": 0, "24-59": 0 });
  });

  it("splits a mixed padron across both bands", () => {
    const result = groupByAgeBand([
      { edadMeses: 6 },
      { edadMeses: 15 },
      { edadMeses: 24 },
      { edadMeses: 59 },
    ]);
    expect(result).toEqual({ "6-23": 2, "24-59": 2 });
  });
});
