import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";
import type { Diagnosis } from "../domain/anemia";
import { groupByAgeBand, type AgeBand } from "../lib/ageGroups";
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

// Screening overview: KPI cards, Hb distribution bars, and age-group bars.
// All values derive from visible rows only: tombstones (deletedAt set)
// are excluded from total, age bands, and (via selectors) counts/average.
// Spanish labels, English identifiers.
export function DashboardView() {
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
      <p
        data-testid="triage-sentence"
        className="max-w-prose text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
      >
        {triageSentence(total, moderateSevere)}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total de pacientes</CardTitle>
            <CardDescription>{captionFor("total", isEmpty)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p data-testid="kpi-total" className="text-2xl font-semibold">
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
            <p data-testid="kpi-avg" className="text-2xl font-semibold">
              {isEmpty ? "—" : `${avg.toFixed(2)} g/dL`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Con anemia</CardTitle>
            <CardDescription>{captionFor("anemia", isEmpty)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p data-testid="kpi-anemia-pct" className="text-2xl font-semibold">
              {anemiaPct === null ? "—" : `${anemiaPct}%`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Moderada + Severa</CardTitle>
            <CardDescription>{captionFor("modsev", isEmpty)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p data-testid="kpi-modsev" className="text-2xl font-semibold">
              {moderateSevere}
            </p>
          </CardContent>
        </Card>
      </div>

      <div data-testid="band-counts" className="grid grid-cols-2 gap-4">
        {BANDS.map((band) => (
          <Card key={band}>
            <CardHeader>
              <Badge variant={DIAGNOSIS_BADGE[band]}>{band}</Badge>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-2xl font-semibold",
                  counts[band] === 0 && "text-muted-foreground",
                )}
              >
                {counts[band]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribución de hemoglobina</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <div data-testid="hb-chart" className="h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hbData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="band" tick={{ fontSize: 11 }} interval={0} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="count" isAnimationActive={false}>
                  {hbData.map((d) => (
                    <Cell key={d.band} fill={SEVERITY_FILL[d.band]} />
                  ))}
                  <LabelList dataKey="count" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            data-testid="hb-legend"
            aria-label="Leyenda de severidad"
            className="mt-2 flex flex-wrap gap-1.5"
          >
            {BANDS.map((band) => (
              <Badge key={band} variant={DIAGNOSIS_BADGE[band]}>
                {band}
              </Badge>
            ))}
          </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Riesgo por grupo de edad</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <div data-testid="age-chart" className="h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="band" />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="count" isAnimationActive={false}>
                  {ageData.map((d) => (
                    <Cell key={d.band} fill={SEVERITY_FILL[ageRisk[d.band]]} />
                  ))}
                  <LabelList dataKey="count" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            data-testid="age-legend"
            aria-label="Leyenda de severidad"
            className="mt-2 flex flex-wrap gap-1.5"
          >
            {BANDS.map((band) => (
              <Badge key={band} variant={DIAGNOSIS_BADGE[band]}>
                {band}
              </Badge>
            ))}
          </div>
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
    </section>
  );
}
