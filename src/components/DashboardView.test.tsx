import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { captionFor, DashboardView, toHbBandData } from "./DashboardView";

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

  it("shows every KPI card with value plus exactly one Spanish caption", () => {
    seedPadron();
    render(<DashboardView />);

    const expectations: Array<[string, string]> = [
      ["Total de pacientes", "Pacientes registrados en el padrón"],
      ["Promedio de hemoglobina", "Promedio de la muestra actual"],
      ["Con anemia", "Porcentaje con algún grado de anemia"],
      ["Moderada + Severa", "Casos que requieren seguimiento"],
    ];
    for (const [title, caption] of expectations) {
      const card = screen.getByText(title).closest("div[data-slot='card']")!;
      expect(within(card as HTMLElement).getByText(caption)).toBeInTheDocument();
      // Exactly one caption line per card (CardDescription slot)
      const descriptions = (card as HTMLElement).querySelectorAll(
        "[data-slot='card-description']",
      );
      expect(descriptions).toHaveLength(1);
    }
  });

  it("shows empty-state Spanish captions instead of trends", () => {
    render(<DashboardView />);

    const expectations: Array<[string, string]> = [
      ["Total de pacientes", "Sin registros en el padrón"],
      ["Promedio de hemoglobina", "Sin registros"],
      ["Con anemia", "Sin datos de anemia"],
      ["Moderada + Severa", "Sin casos moderados ni severos"],
    ];
    for (const [title, caption] of expectations) {
      const card = screen.getByText(title).closest("div[data-slot='card']")!;
      expect(within(card as HTMLElement).getByText(caption)).toBeInTheDocument();
      const descriptions = (card as HTMLElement).querySelectorAll(
        "[data-slot='card-description']",
      );
      expect(descriptions).toHaveLength(1);
    }
  });

  it("excludes soft-deleted tombstones from KPIs and age bands (B2)", () => {
    seedPadron();
    const id = usePadronStore.getState().pacientes[4].id;
    usePadronStore.getState().remove(id);
    render(<DashboardView />);
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("4");
    expect(screen.getByTestId("kpi-modsev")).toHaveTextContent("1");
    const chart = screen.getByTestId("age-chart");
    expect(within(chart).getByText("3")).toBeInTheDocument();
    expect(within(chart).getByText("1")).toBeInTheDocument();
  });

  it("shows the empty state with em-dash and Sin registros", () => {    render(<DashboardView />);

    expect(screen.getByText("Total de pacientes")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("0");
    expect(screen.getByTestId("kpi-avg")).toHaveTextContent("—");
    expect(screen.getByTestId("kpi-anemia-pct")).toHaveTextContent("—");
    expect(screen.getAllByText(/sin registros/i).length).toBeGreaterThanOrEqual(1);
    // Total + 4 diagnosis counts are zero without errors
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(5);
    const bandCounts = screen.getByTestId("band-counts");
    for (const band of HB_BANDS) {
      expect(within(bandCounts).getByText(band)).toBeInTheDocument();
    }
  });
});

describe("captionFor", () => {
  it("returns Spanish trend captions for non-empty state", () => {
    expect(captionFor("total", false)).toBe("Pacientes registrados en el padrón");
    expect(captionFor("avg", false)).toBe("Promedio de la muestra actual");
    expect(captionFor("anemia", false)).toBe("Porcentaje con algún grado de anemia");
    expect(captionFor("modsev", false)).toBe("Casos que requieren seguimiento");
  });

  it("returns Spanish empty-state captions", () => {
    expect(captionFor("total", true)).toBe("Sin registros en el padrón");
    expect(captionFor("avg", true)).toBe("Sin registros");
    expect(captionFor("anemia", true)).toBe("Sin datos de anemia");
    expect(captionFor("modsev", true)).toBe("Sin casos moderados ni severos");
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
