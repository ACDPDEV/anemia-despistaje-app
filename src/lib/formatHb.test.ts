import { describe, expect, it } from "vitest";
import { formatHb } from "./formatHb";

describe("formatHb", () => {
  it("formats every Hb surface with one decimal, the paper voice", () => {
    expect(formatHb(9.8)).toBe("9.8");
    expect(formatHb(12)).toBe("12.0");
    expect(formatHb(0)).toBe("0.0");
  });

  it("rounds instead of truncating so screen, print, and CSV agree", () => {
    // Dashboard avg (12.0 + 11.5 + 10.5 + 9.0 + 6.0) / 5 = 9.8 exactly.
    expect(formatHb(49 / 5)).toBe("9.8");
    // (12.0 + 6.5 + 10.5) / 3 = 9.666… → the CSV-quoted 9.7.
    expect(formatHb(29 / 3)).toBe("9.7");
  });
});
