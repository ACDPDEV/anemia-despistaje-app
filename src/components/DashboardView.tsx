import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";
import type { Diagnosis } from "../domain/anemia";
import { HB_CUTOFF_LABEL } from "../domain/anemia";
import { groupByAgeBand, type AgeBand } from "../lib/ageGroups";
import { formatHb } from "../lib/formatHb";
import { usePadronStore } from "../stores/padronStore";

const BANDS: Diagnosis[] = ["Normal", "Anemia Leve", "Anemia Moderada", "Anemia Severa"];

const AGE_BANDS: AgeBand[] = ["6-23", "24-59"];

export const DIAGNOSIS_BADGE: Record<
  Diagnosis,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Normal: "secondary",
  "Anemia Leve": "outline",
  "Anemia Moderada": "default",
  "Anemia Severa": "destructive",
};

export type HbBandDatum = { band: Diagnosis; count: number };

// Severity hues for chart bars. Severe resolves to --destructive so the
// chart can never drift from the destructive badge; the other three come
// from the severity tokens in index.css (oklch, light + dark). Calm
// (Normal) stays green, Leve amber, Moderada orange.
export const SEVERITY_FILL: Record<Diagnosis, string> = {
  Normal: "var(--color-severity-normal)",
  "Anemia Leve": "var(--color-severity-mild)",
  "Anemia Moderada": "var(--color-severity-moderate)",
  "Anemia Severa": "var(--destructive)",
};

const SEVERITY_RANK: Record<Diagnosis, number> = {
  Normal: 0,
  "Anemia Leve": 1,
  "Anemia Moderada": 2,
  "Anemia Severa": 3,
};

// Pure presentation helper: totals → protagonist triage sentence.
// The zero variant stays calm and always names the denominator so the
// line is true for an empty padron and for a healthy one alike.
export function triageSentence(total: number, moderateSevere: number): string {
  if (moderateSevere === 0) {
    return `Ningún caso moderado o severo de ${total} registrados`;
  }
  return moderateSevere === 1
    ? `1 moderado o severo de ${total} registrados necesita seguimiento`
    : `${moderateSevere} moderados o severos de ${total} registrados necesitan seguimiento`;
}

export type KpiMetric = "total" | "avg" | "anemia" | "modsev";

// Pure presentation helper: metric + empty flag → Spanish trend caption.
// Values stay on existing selectors; no store or domain change.
export function captionFor(metric: KpiMetric, empty: boolean): string {
  if (empty) {
    switch (metric) {
      case "total":
        return "Sin registros en el padrón";
      case "avg":
        return "Sin registros";
      case "anemia":
        return "Sin datos de anemia";
      case "modsev":
        return "Sin casos moderados ni severos";
    }
  }
  switch (metric) {
    case "total":
      return "Pacientes registrados en el padrón";
    case "avg":
      return "Promedio de la muestra actual";
    case "anemia":
      return "Porcentaje con algún grado de anemia";
    case "modsev":
      return "Casos que requieren seguimiento";
  }
}

// Pure mapper: diagnosis counts → chart rows in BANDS order.
export function toHbBandData(
  counts: Record<Diagnosis, number>,
): HbBandDatum[] {
  return BANDS.map((band) => ({ band, count: counts[band] }));
}

// Short XAxis ticks for the Hb chart: full diagnosis names crowd at
// fontSize 11 with interval={0}, so ticks show the short form while the
// legend + sr-only table keep the full names.
export const HB_TICK_SHORT: Record<Diagnosis, string> = {
  Normal: "Normal",
  "Anemia Leve": "Leve",
  "Anemia Moderada": "Moderada",
  "Anemia Severa": "Severa",
};

// Screening overview: KPI cards, Hb distribution bars, and age-group bars.
// All values derive from visible rows only: tombstones (deletedAt set)
// are excluded from total, age bands, and (via selectors) counts/average.
// Spanish labels, English identifiers. The empty state mirrors PadronView:
// a guide line plus a register call-to-action when the shell provides one.
export function DashboardView({
  onEmptyRegister,
}: {
  onEmptyRegister?: () => void;
}) {
  const pacientes = usePadronStore((s) => s.pacientes).filter((p) => !p.deletedAt);
  const countByDiagnosis = usePadronStore((s) => s.countByDiagnosis);
  const averageHb = usePadronStore((s) => s.averageHb);

  const total = pacientes.length;
  const counts = countByDiagnosis();
  const avg = averageHb();
  const isEmpty = total === 0;

  const anemiaCount = total - counts["Normal"];
  const anemiaPct = isEmpty ? null : Math.round((anemiaCount / total) * 100);
  const moderateSevere = counts["Anemia Moderada"] + counts["Anemia Severa"];

  const hbData = toHbBandData(counts);
  const ageCounts = groupByAgeBand(pacientes);
  const ageData = AGE_BANDS.map((band) => ({ band, count: ageCounts[band] }));
  // Detail disclosures: collapsed by default on ALL widths behind
  // explicit toggles so the first screen is sentence + hero + numbers.
  // TWO toggles (not one): band counts belong with their chart, so each
  // pair opens together — "distribución de hemoglobina" (bands + Hb
  // chart) and "riesgo por edad" (age info + age chart). One open pair
  // holds at most 4 focal points (bands, chart, legend, risk line never
  // share a screen). Controlled open state survives React re-renders; no
  // matchMedia override (it stole the user's collapse state on resize).
  const [hbOpen, setHbOpen] = useState(false);
  const [ageOpen, setAgeOpen] = useState(false);
  // Bar hue for each age band follows the worst diagnosis seen in that
  // band, so "Riesgo por grupo de edad" encodes risk instead of reusing a
  // neutral token. Boundary mirrors groupByAgeBand (< 24 → "6-23").
  const ageRisk: Record<AgeBand, Diagnosis> = {
    "6-23": "Normal",
    "24-59": "Normal",
  };
  for (const p of pacientes) {
    const band: AgeBand = p.edadMeses < 24 ? "6-23" : "24-59";
    if (SEVERITY_RANK[p.diagnostico] > SEVERITY_RANK[ageRisk[band]]) {
      ageRisk[band] = p.diagnostico;
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Panel</h2>

      {isEmpty && (
        <p data-testid="empty-guide" className="text-sm text-muted-foreground">
          Registra tu primer paciente para ver el panel
        </p>
      )}

      {isEmpty && onEmptyRegister && (
        <div>
          <Button type="button" onClick={onEmptyRegister}>
            Registrar paciente
          </Button>
        </div>
      )}

      {/* One hero unit (no eyebrow: craft-floor bans the kicker, so the
          triage sentence lives INSIDE this card as the number's body copy).
          Single ramp: hero number dominant, sentence one tier below it,
          caption unchanged. First screen stays sentence + hero + 3 KPIs —
          same content, unified hierarchy. */}
      <Card data-testid="hero-modsev">
        <CardHeader>
          <CardTitle>Moderada + Severa</CardTitle>
          <CardDescription>{captionFor("modsev", isEmpty)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <p
            data-testid="kpi-modsev"
            className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl"
          >
            {moderateSevere}
          </p>
          <p
            data-testid="triage-sentence"
            className="max-w-prose text-base text-muted-foreground text-balance"
          >
            {triageSentence(total, moderateSevere)}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total de pacientes</CardTitle>
            <CardDescription>{captionFor("total", isEmpty)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p data-testid="kpi-total" className="text-xl font-semibold">
              {total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Promedio de hemoglobina</CardTitle>
            <CardDescription>{captionFor("avg", isEmpty)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p data-testid="kpi-avg" className="text-xl font-semibold">
              {isEmpty ? "—" : `${formatHb(avg)} g/dL`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Con anemia</CardTitle>
            <CardDescription>{captionFor("anemia", isEmpty)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p data-testid="kpi-anemia-pct" className="text-xl font-semibold">
              {anemiaPct === null ? "—" : `${anemiaPct}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      <details
        data-testid="hb-disclosure"
        open={hbOpen}
        onToggle={(event) => setHbOpen(event.currentTarget.open)}
        className="flex flex-col gap-6"
      >
        <summary className="cursor-pointer text-sm font-medium text-primary">
          {hbOpen ? "Ocultar distribución de hemoglobina" : "Ver distribución de hemoglobina"}
        </summary>
        {/* Hb pair: the 4 band counts live with their chart (they duplicate
            chart-owned data), so the first screen stays sentence + hero +
            3 KPIs (4 numbers). Stacked on phones, side-by-side from sm:
            bands hold their 2×2 grid in the left column, the chart the
            right one. */}
        <div
          data-testid="hb-pair-grid"
          className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2"
        >
          <div data-testid="band-counts" className="grid grid-cols-2 gap-4">
            {BANDS.map((band) => (
              <Card key={band}>
                <CardHeader>
                  <Badge variant={DIAGNOSIS_BADGE[band]}>{band}</Badge>
                </CardHeader>
                <CardContent>
                  <p
                    className={cn(
                      "text-xl font-semibold",
                      counts[band] === 0 && "text-muted-foreground",
                    )}
                  >
                    {counts[band]}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Distribución de hemoglobina</CardTitle>
              <CardDescription>
                El color indica la gravedad del diagnóstico · {HB_CUTOFF_LABEL}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <div data-testid="hb-chart" className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hbData}>
                    <XAxis
                      dataKey="band"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      interval={0}
                      tickFormatter={(value: string) =>
                        HB_TICK_SHORT[value as Diagnosis] ?? value
                      }
                    />
                    <YAxis hide />
                    <Bar dataKey="count" isAnimationActive={false}>
                      {hbData.map((d) => (
                        <Cell key={d.band} fill={SEVERITY_FILL[d.band]} />
                      ))}
                    <LabelList dataKey="count" position="top" fill="var(--foreground)" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Visible legend dropped (distill): the 4 band cards above
                  already name every band, so chips here only repeated
                  chart-owned data. The sr-only table below stays the
                  canonical AT source with full names. */}
              <table data-testid="hb-data-table" className="sr-only">
                <caption>Distribución de hemoglobina por diagnóstico</caption>
                <tbody>
                  {hbData.map((d) => (
                    <tr key={d.band}>
                      <th scope="row">{d.band}</th>
                      <td>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </details>

      <details
        data-testid="age-disclosure"
        open={ageOpen}
        onToggle={(event) => setAgeOpen(event.currentTarget.open)}
        className="flex flex-col gap-6"
      >
        <summary className="cursor-pointer text-sm font-medium text-primary">
          {ageOpen ? "Ocultar riesgo por edad" : "Ver riesgo por edad"}
        </summary>
        {/* Age pair: the risk encoding (legend + worst-case line) lives
            with its chart in a single card — one focal group, no grid
            needed. */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Riesgo por grupo de edad</CardTitle>
            <CardDescription data-testid="age-legend">
              El color indica el peor diagnóstico observado en el grupo
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <div data-testid="age-chart" className="h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ageData}>
                  <XAxis dataKey="band" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} />
                  <YAxis hide />
                  <Bar dataKey="count" isAnimationActive={false}>
                    {ageData.map((d) => (
                      <Cell key={d.band} fill={SEVERITY_FILL[ageRisk[d.band]]} />
                    ))}
                    <LabelList dataKey="count" position="top" fill="var(--foreground)" />
                    </Bar>
                  </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Visible text carrier for the hue encoding: one compact line
                naming each band's worst case from the same ageRisk source
                the bars and the sr-only table read. Small, muted, theme
                tokens; the sr-only table stays canonical. */}
            <p data-testid="age-risk-text" className="mt-2 text-sm text-muted-foreground">
              {AGE_BANDS.map((band) => `${band}: ${ageRisk[band]}`).join(" · ")}
            </p>
            <table data-testid="age-data-table" className="sr-only">
              <caption>Riesgo por grupo de edad, con el peor caso observado</caption>
              <tbody>
                {ageData.map((d) => (
                  <tr key={d.band}>
                    <th scope="row">{d.band}</th>
                    <td>{d.count}</td>
                    <td>{ageRisk[d.band]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </details>
    </section>
  );
}
