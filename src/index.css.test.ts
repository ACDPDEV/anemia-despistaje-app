import { describe, expect, it } from "vitest";
import css from "./index.css?raw";

// run-22 P3-1: chart-1..5 tokens were removed as unused (zero consumers —
// the charts read the severity tokens + --destructive in both themes).
// This pins the removal: if a chart ever needs the ramp again, both the
// light and dark ramps come back together.
describe("index.css chart tokens", () => {
  it("defines no chart-1..5 tokens or color utilities", () => {
    expect(css).not.toMatch(/--chart-/);
    expect(css).not.toMatch(/--color-chart-/);
  });
});
