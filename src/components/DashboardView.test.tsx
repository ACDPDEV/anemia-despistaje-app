import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { DashboardView, toHbBandData } from "./DashboardView";

const HB_BANDS = ["Normal", "Anemia Leve", "Anemia Moderada", "Anemia Severa"];

function seedPadron() {
  const { add } = usePadronStore.getState();
  add({ nombre: "Nina Roca", edadMeses: 10, nivelHemoglobina: 12.0 }); // Normal
  add({ nombre: "Paz Leon", edadMeses: 15, nivelHemoglobina: 11.5 }); // Normal
  add({ nombre: "Rio Salas", edadMeses: 20, nivelHemoglobina: 10.5 }); // Leve
  add({ nombre: "Luz Paredes", edadMeses: 24, nivelHemoglobina: 9.0 }); // Moderada
  add({ nombre: "Sol Vega", edadMeses: 40, nivelHemoglobina: 6.0 }); // Severa
}

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
});

describe("DashboardView", () => {
  it("renders KPI cards from store selectors for a seeded padron", () => {
    seedPadron();
    render(<DashboardView />);

    // Total screened and average Hb derive from selectors
    expect(screen.getByText("Total de pacientes")).toBeInTheDocument();
    // avg of 12.0 + 11.5 + 10.5 + 9.0 + 6.0 = 49.0 / 5
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("5");
    expect(screen.getByText("Promedio de hemoglobina")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-avg")).toHaveTextContent("9.80");

    // 3 of 5 have anemia → 60%; Moderada + Severa → 2
    expect(screen.getByText("Con anemia")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-anemia-pct")).toHaveTextContent("60%");
    expect(screen.getByText("Moderada + Severa")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-modsev")).toHaveTextContent("2");
  });

  it("renders a fixed-size 4-band Hb chart with selector counts", () => {
    seedPadron();
    const { container } = render(<DashboardView />);
    const chart = screen.getByTestId("hb-chart");

    // All four diagnosis bands are labeled on the chart
    for (const band of HB_BANDS) {
      expect(within(chart).getByText(band)).toBeInTheDocument();
    }
    // Bar labels print each band count: Normal 2, others 1
    expect(within(chart).getByText("2")).toBeInTheDocument();
    expect(within(chart).getAllByText("1")).toHaveLength(3);

    // Fixed-size hook: real SVG with explicit dimensions, no ResponsiveContainer
    const svg = chart.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("320");
    expect(svg?.getAttribute("height")).toBe("200");
    expect(container.querySelector(".recharts-responsive-container")).toBeNull();
  });

  it("renders per-group age bars with the 24-month boundary in 24-59", () => {
    seedPadron();
    render(<DashboardView />);
    const chart = screen.getByTestId("age-chart");

    expect(within(chart).getByText("6-23")).toBeInTheDocument();
    expect(within(chart).getByText("24-59")).toBeInTheDocument();
    // ages 10, 15, 20 → younger; 24 (boundary), 40 → older
    expect(within(chart).getByText("3")).toBeInTheDocument();
    expect(within(chart).getByText("2")).toBeInTheDocument();
  });

  it("shows the empty state with em-dash and Sin registros", () => {    render(<DashboardView />);

    expect(screen.getByText("Total de pacientes")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("0");
    expect(screen.getByTestId("kpi-avg")).toHaveTextContent("—");
    expect(screen.getByTestId("kpi-anemia-pct")).toHaveTextContent("—");
    expect(screen.getByText(/sin registros/i)).toBeInTheDocument();
    // Total + 4 diagnosis counts are zero without errors
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(5);
    const bandCounts = screen.getByTestId("band-counts");
    for (const band of HB_BANDS) {
      expect(within(bandCounts).getByText(band)).toBeInTheDocument();
    }
  });
});

describe("toHbBandData", () => {
  it("maps counts to four rows in band order", () => {
    expect(
      toHbBandData({
        Normal: 2,
        "Anemia Leve": 1,
        "Anemia Moderada": 0,
        "Anemia Severa": 3,
      }),
    ).toEqual([
      { band: "Normal", count: 2 },
      { band: "Anemia Leve", count: 1 },
      { band: "Anemia Moderada", count: 0 },
      { band: "Anemia Severa", count: 3 },
    ]);
  });
});
