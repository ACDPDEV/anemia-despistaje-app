import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { HB_CUTOFF_LABEL } from "../domain/anemia";
import { captionFor, DashboardView, toHbBandData, triageSentence } from "./DashboardView";

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

  it("renders a responsive 4-band Hb chart with selector counts", () => {
    seedPadron();
    const { container } = render(<DashboardView />);
    const chart = screen.getByTestId("hb-chart");

    // Ticks use the short forms ("Normal", "Leve", "Moderada", "Severa"):
    // the full "Anemia …" names crowd at fontSize 11 with interval={0}.
    for (const tick of ["Normal", "Leve", "Moderada", "Severa"]) {
      expect(within(chart).getByText(tick)).toBeInTheDocument();
    }
    // Full diagnosis names live in the legend + sr-only table, not ticks.
    expect(within(chart).queryByText("Anemia Leve")).not.toBeInTheDocument();
    expect(within(chart).queryByText("Anemia Moderada")).not.toBeInTheDocument();
    expect(within(chart).queryByText("Anemia Severa")).not.toBeInTheDocument();
    // Bar labels print each band count: Normal 2, others 1
    expect(within(chart).getByText("2")).toBeInTheDocument();
    expect(within(chart).getAllByText("1")).toHaveLength(3);

    // Responsive hook: charts stretch to the card instead of fixed 320px.
    const svg = chart.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).not.toBe("320");
    expect(
      container.querySelector(".recharts-responsive-container"),
    ).not.toBeNull();
  });

  it("colors Hb bars by severity with Severa on the destructive token", () => {
    seedPadron();
    render(<DashboardView />);
    const chart = screen.getByTestId("hb-chart");
    const bars = chart.querySelectorAll(".recharts-bar-rectangle path");
    expect(bars).toHaveLength(4);
    const fills = [...bars].map((b) => b.getAttribute("fill"));
    expect(fills[0]).toBe("var(--color-severity-normal)");
    expect(fills[1]).toBe("var(--color-severity-mild)");
    expect(fills[2]).toBe("var(--color-severity-moderate)");
    expect(fills[3]).toBe("var(--destructive)");
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

  it("keeps the Hb legend as 4 diagnosis chips (bars ARE diagnoses)", () => {
    seedPadron();
    render(<DashboardView />);

    const legend = screen.getByTestId("hb-legend");
    for (const band of HB_BANDS) {
      expect(within(legend).getByText(band)).toBeInTheDocument();
    }
    expect(legend.className).toMatch(/flex-wrap/);
  });

  it("keys the age chart by worst case instead of diagnosis chips", () => {
    seedPadron();
    render(<DashboardView />);

    const legend = screen.getByTestId("age-legend");
    expect(legend).toHaveTextContent(
      /el color indica el peor diagnóstico observado en el grupo/i,
    );
    // No chip can teach the false bars-are-diagnoses mapping.
    for (const band of HB_BANDS) {
      expect(within(legend).queryByText(band)).not.toBeInTheDocument();
    }
  });

  it("promotes Moderada + Severa to a hero above the secondary KPIs", () => {
    seedPadron();
    render(<DashboardView />);

    const hero = screen.getByTestId("hero-modsev");
    const heroValue = within(hero).getByTestId("kpi-modsev");
    expect(heroValue).toHaveTextContent("2");
    // Hero value reads a full tier above the secondary numbers.
    expect(heroValue.className).toMatch(/text-4xl/);
    for (const id of ["kpi-total", "kpi-avg", "kpi-anemia-pct"]) {
      const secondary = screen.getByTestId(id);
      expect(secondary.className).toMatch(/text-xl/);
      expect(secondary.className).not.toMatch(/text-2xl/);
    }
    // Reading order: sentence → hero → secondary numbers.
    const triage = screen.getByTestId("triage-sentence");
    expect(
      triage.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      hero.compareDocumentPosition(screen.getByTestId("kpi-total")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps charts collapsed by default behind a desktop-visible toggle", () => {
    seedPadron();
    render(<DashboardView />);

    const disclosure = screen.getByTestId(
      "charts-disclosure",
    ) as HTMLDetailsElement;
    expect(disclosure.tagName).toBe("DETAILS");
    // Collapsed by default on ALL widths (no matchMedia force-open).
    expect(disclosure.open).toBe(false);
    // The toggle is explicit on every width, not phones-only.
    const summary = within(disclosure).getByText("Ver gráficos");
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.className).not.toMatch(/sm:hidden/);
    // Charts stay mounted while collapsed.
    expect(within(disclosure).getByTestId("hb-chart")).toBeInTheDocument();
    expect(within(disclosure).getByTestId("age-chart")).toBeInTheDocument();
    // The toggle event drives the controlled open state.
    disclosure.open = true;
    fireEvent(disclosure, new Event("toggle"));
    expect(
      (screen.getByTestId("charts-disclosure") as HTMLDetailsElement).open,
    ).toBe(true);
  });

  it("teaches the shared Hb cutoffs on the Hb chart card", () => {
    seedPadron();
    render(<DashboardView />);
    const card = screen.getByText("Distribución de hemoglobina").closest(
      "div[data-slot='card']",
    )!;
    // Reuses HB_CUTOFF_LABEL: the chart teaches the cutoffs the forms do.
    expect(card.textContent).toContain(HB_CUTOFF_LABEL);
  });

  it("guides first-timers with an empty-dashboard hint", () => {
    render(<DashboardView />);
    expect(screen.getByTestId("empty-guide")).toHaveTextContent(
      /registra tu primer paciente para ver el panel/i,
    );
  });

  it("leads with a triage sentence ahead of the KPI cards", () => {
    seedPadron();
    render(<DashboardView />);
    const triage = screen.getByTestId("triage-sentence");
    // 2 moderate-or-severe of 5 registered.
    expect(triage).toHaveTextContent(
      "2 moderados o severos de 5 registrados necesitan seguimiento",
    );
    // Protagonist type sits one step above the KPI values.
    expect(triage.tagName).toBe("P");
    expect(triage.className).toMatch(/text-2xl/);
    // The sentence renders before every KPI card in DOM order.
    const firstKpi = screen.getByTestId("kpi-total");
    expect(
      triage.compareDocumentPosition(firstKpi) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the calm zero variant of the triage sentence when empty", () => {
    render(<DashboardView />);
    expect(screen.getByTestId("triage-sentence")).toHaveTextContent(
      "Ningún caso moderado o severo de 0 registrados",
    );
  });

  it("exposes each chart's counts in a visually-hidden data table", () => {
    seedPadron();
    render(<DashboardView />);

    const hbTable = screen.getByTestId("hb-data-table");
    expect(hbTable).toHaveClass("sr-only");
    for (const [band, count] of [
      ["Normal", "2"],
      ["Anemia Leve", "1"],
      ["Anemia Moderada", "1"],
      ["Anemia Severa", "1"],
    ] as const) {
      const row = within(hbTable).getByText(band).closest("tr")!;
      expect(within(row).getByText(count)).toBeInTheDocument();
    }

    const ageTable = screen.getByTestId("age-data-table");
    expect(ageTable).toHaveClass("sr-only");
    const younger = within(ageTable).getByText("6-23").closest("tr")!;
    expect(within(younger).getByText("3")).toBeInTheDocument();
    const older = within(ageTable).getByText("24-59").closest("tr")!;
    expect(within(older).getByText("2")).toBeInTheDocument();
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
    // First-timers get a guide line on top of the calm zero captions.
    expect(screen.getByTestId("empty-guide")).toBeInTheDocument();
  });

  it("keys the Hb chart like the age chart", () => {
    seedPadron();
    render(<DashboardView />);
    const card = screen.getByText("Distribución de hemoglobina").closest(
      "div[data-slot='card']",
    )!;
    expect(
      within(card as HTMLElement).getByText(
        /el color indica la gravedad del diagnóstico/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows no empty guide once the padron has records", () => {
    seedPadron();
    render(<DashboardView />);
    expect(screen.queryByTestId("empty-guide")).not.toBeInTheDocument();
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

describe("triageSentence", () => {
  it("names the follow-up count over the registered total", () => {
    expect(triageSentence(5, 2)).toBe(
      "2 moderados o severos de 5 registrados necesitan seguimiento",
    );
  });

  it("uses the singular when a single case needs follow-up", () => {
    expect(triageSentence(4, 1)).toBe(
      "1 moderado o severo de 4 registrados necesita seguimiento",
    );
  });

  it("stays calm and names the denominator when there is nothing to follow", () => {
    expect(triageSentence(5, 0)).toBe(
      "Ningún caso moderado o severo de 5 registrados",
    );
    expect(triageSentence(0, 0)).toBe(
      "Ningún caso moderado o severo de 0 registrados",
    );
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
