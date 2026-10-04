import { beforeEach, describe, expect, it, vi } from "vitest";
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
    // Full diagnosis names live in the sr-only table, not ticks.
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

  it("drops the visible Hb legend: band cards above already name every band", () => {
    seedPadron();
    render(<DashboardView />);

    // No visible legend chips: they duplicated the band cards above.
    expect(screen.queryByTestId("hb-legend")).not.toBeInTheDocument();
    // AT still gets the full names from the sr-only table.
    const table = screen.getByTestId("hb-data-table");
    expect(table).toHaveClass("sr-only");
    for (const band of HB_BANDS) {
      expect(within(table).getByText(band)).toBeInTheDocument();
    }
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

  it("unifies the triage sentence and hero number into one hero unit", () => {
    seedPadron();
    render(<DashboardView />);

    const hero = screen.getByTestId("hero-modsev");
    const heroValue = within(hero).getByTestId("kpi-modsev");
    expect(heroValue).toHaveTextContent("2");
    // Hero value reads a full tier above the secondary numbers.
    expect(heroValue.className).toMatch(/text-4xl/);
    // One unit, one ramp: the sentence lives INSIDE the hero card as its
    // body copy, a tier below the hero number (no competing 2xl/3xl line).
    const triage = within(hero).getByTestId("triage-sentence");
    expect(triage).toHaveTextContent(
      "2 moderados o severos de 5 registrados necesitan seguimiento",
    );
    expect(triage.tagName).toBe("P");
    expect(triage.className).toMatch(/text-base/);
    expect(triage.className).not.toMatch(/text-2xl/);
    for (const id of ["kpi-total", "kpi-avg", "kpi-anemia-pct"]) {
      const secondary = screen.getByTestId(id);
      expect(secondary.className).toMatch(/text-xl/);
      expect(secondary.className).not.toMatch(/text-2xl/);
    }
    // Reading order: hero unit (number + sentence) → secondary numbers.
    expect(
      hero.compareDocumentPosition(screen.getByTestId("kpi-total")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps both pairs collapsed by default behind explicit toggles", () => {
    seedPadron();
    render(<DashboardView />);

    const hb = screen.getByTestId("hb-disclosure") as HTMLDetailsElement;
    const age = screen.getByTestId("age-disclosure") as HTMLDetailsElement;
    expect(hb.tagName).toBe("DETAILS");
    expect(age.tagName).toBe("DETAILS");
    // Collapsed by default on ALL widths (no matchMedia force-open).
    expect(hb.open).toBe(false);
    expect(age.open).toBe(false);
    // Each toggle is explicit on every width, not phones-only.
    const hbSummary = within(hb).getByText("Ver distribución de hemoglobina");
    expect(hbSummary.tagName).toBe("SUMMARY");
    expect(hbSummary.className).not.toMatch(/sm:hidden/);
    const ageSummary = within(age).getByText("Ver riesgo por edad");
    expect(ageSummary.tagName).toBe("SUMMARY");
    expect(ageSummary.className).not.toMatch(/sm:hidden/);
    // Pairs stay mounted while collapsed, each with its own content.
    expect(within(hb).getByTestId("hb-chart")).toBeInTheDocument();
    expect(within(hb).getByTestId("band-counts")).toBeInTheDocument();
    expect(within(age).getByTestId("age-chart")).toBeInTheDocument();
    expect(within(hb).queryByTestId("age-chart")).not.toBeInTheDocument();
    expect(within(age).queryByTestId("hb-chart")).not.toBeInTheDocument();
    // The toggle events drive the independent open states.
    hb.open = true;
    fireEvent(hb, new Event("toggle"));
    expect(
      (screen.getByTestId("hb-disclosure") as HTMLDetailsElement).open,
    ).toBe(true);
    expect(
      (screen.getByTestId("age-disclosure") as HTMLDetailsElement).open,
    ).toBe(false);
  });

  it("names each toggle honestly for its open state", () => {
    seedPadron();
    render(<DashboardView />);

    const hb = screen.getByTestId("hb-disclosure") as HTMLDetailsElement;
    expect(
      within(hb).getByText("Ver distribución de hemoglobina").tagName,
    ).toBe("SUMMARY");
    hb.open = true;
    fireEvent(hb, new Event("toggle"));
    expect(
      within(hb).getByText("Ocultar distribución de hemoglobina").tagName,
    ).toBe("SUMMARY");
    expect(
      within(hb).queryByText("Ver distribución de hemoglobina"),
    ).not.toBeInTheDocument();

    const age = screen.getByTestId("age-disclosure") as HTMLDetailsElement;
    expect(within(age).getByText("Ver riesgo por edad").tagName).toBe(
      "SUMMARY",
    );
    age.open = true;
    fireEvent(age, new Event("toggle"));
    expect(within(age).getByText("Ocultar riesgo por edad").tagName).toBe(
      "SUMMARY",
    );
    expect(
      within(age).queryByText("Ver riesgo por edad"),
    ).not.toBeInTheDocument();
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

  it("calls onEmptyRegister from the empty-state call-to-action", () => {
    const onEmptyRegister = vi.fn();
    render(<DashboardView onEmptyRegister={onEmptyRegister} />);
    expect(screen.getByTestId("empty-guide")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /registrar paciente/i }));
    expect(onEmptyRegister).toHaveBeenCalledTimes(1);
  });

  it("shows no register call-to-action without the prop", () => {
    render(<DashboardView />);
    expect(screen.getByTestId("empty-guide")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /registrar paciente/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the triage sentence in the hero unit ahead of the KPI cards", () => {
    seedPadron();
    render(<DashboardView />);
    const triage = screen.getByTestId("triage-sentence");
    // 2 moderate-or-severe of 5 registered.
    expect(triage).toHaveTextContent(
      "2 moderados o severos de 5 registrados necesitan seguimiento",
    );
    // Body copy inside the hero card, not a competing headline.
    expect(triage.tagName).toBe("P");
    expect(triage.className).toMatch(/text-base/);
    expect(
      within(screen.getByTestId("hero-modsev")).getByTestId("triage-sentence"),
    ).toBe(triage);
    // The hero unit renders before every secondary KPI card in DOM order.
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

  it("names each age band's worst case in visible text matching the sr-only table", () => {
    seedPadron();
    render(<DashboardView />);

    const text = screen.getByTestId("age-risk-text");
    expect(text).not.toHaveClass("sr-only");
    expect(text.className).toMatch(/text-muted-foreground/);
    // Same ageRisk source as the bars and the sr-only table: 6-23 worst is
    // Leve (Rio, 10.5), 24-59 worst is Severa (Sol, 6.0).
    const table = screen.getByTestId("age-data-table");
    for (const band of ["6-23", "24-59"]) {
      const row = within(table).getByText(band).closest("tr")!;
      const cells = within(row).getAllByRole("cell");
      const worst = cells[cells.length - 1].textContent;
      expect(text).toHaveTextContent(`${band}: ${worst}`);
    }
  });

  it("pairs each band set with its chart: Hb 2-col from sm, age single card", () => {
    seedPadron();
    render(<DashboardView />);

    // Hb pair: bands + chart side-by-side from sm, stacked on phones.
    const pair = screen.getByTestId("hb-pair-grid");
    expect(pair.className).toMatch(/grid-cols-1/);
    expect(pair.className).toMatch(/sm:grid-cols-2/);
    expect(pair).toContainElement(screen.getByTestId("band-counts"));
    expect(pair).toContainElement(screen.getByTestId("hb-chart"));
    expect(screen.getByTestId("hb-disclosure")).toContainElement(pair);
    // Bands read 2×2 inside the pair's left column on every width.
    const bands = screen.getByTestId("band-counts");
    expect(bands.className).toMatch(/grid-cols-2/);
    // Age pair: the risk card carries its own info, no grid needed.
    const age = screen.getByTestId("age-disclosure");
    expect(age).toContainElement(screen.getByTestId("age-chart"));
    expect(age).toContainElement(screen.getByTestId("age-risk-text"));
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
    // Total + 4 diagnosis counts are zero without errors (bands live
    // inside the Hb disclosure now, still in the DOM).
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(5);
    const bandCounts = screen.getByTestId("band-counts");
    expect(screen.getByTestId("hb-disclosure")).toContainElement(
      bandCounts,
    );
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

  it("folds band counts into the Hb disclosure: first screen holds 4 numbers", () => {
    seedPadron();
    render(<DashboardView />);
    const hb = screen.getByTestId("hb-disclosure");
    const age = screen.getByTestId("age-disclosure");
    const bandCounts = screen.getByTestId("band-counts");
    // Distribution data lives with its chart, not on the first screen.
    expect(hb).toContainElement(bandCounts);
    for (const band of HB_BANDS) {
      expect(within(bandCounts).getByText(band)).toBeInTheDocument();
    }
    // Age content stays out of the Hb pair and vice versa.
    expect(hb).not.toContainElement(screen.getByTestId("age-chart"));
    expect(age).not.toContainElement(screen.getByTestId("hb-chart"));
    // First screen numbers: hero + 3 KPIs only (4 numbers, not 8).
    for (const id of ["kpi-modsev", "kpi-total", "kpi-avg", "kpi-anemia-pct"]) {
      expect(hb).not.toContainElement(screen.getByTestId(id));
      expect(age).not.toContainElement(screen.getByTestId(id));
    }
  });

  it("renders quiet chart chrome: no grid, no tooltip (LabelList carries values)", () => {
    seedPadron();
    const { container } = render(<DashboardView />);
    expect(
      container.querySelector(".recharts-cartesian-grid"),
    ).toBeNull();
    expect(
      container.querySelector(".recharts-tooltip-wrapper"),
    ).toBeNull();
  });

  it("paints chart text with theme tokens so dark mode stays legible", () => {
    seedPadron();
    const { container } = render(<DashboardView />);
    // Both XAxis tick sets use the muted token (secondary text on the
    // chart surface, never the SVG light-gray default).
    const tickTexts = [
      ...container.querySelectorAll(".recharts-cartesian-axis-tick-label text"),
    ];
    expect(tickTexts.length).toBeGreaterThan(0);
    for (const tick of tickTexts) {
      expect(tick.getAttribute("fill")).toBe("var(--muted-foreground)");
    }
    // Value labels use the foreground token for full data contrast.
    const valueLabels = [
      ...container.querySelectorAll(".recharts-label-list text"),
    ];
    expect(valueLabels.length).toBeGreaterThan(0);
    for (const label of valueLabels) {
      expect(label.getAttribute("fill")).toBe("var(--foreground)");
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
