import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Panel</h2>

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
        <CardContent>
          <div data-testid="hb-chart" className="flex justify-center">
            <BarChart width={320} height={200} data={hbData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="band" tick={{ fontSize: 11 }} interval={0} />
              <YAxis hide />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-chart-1)" isAnimationActive={false}>
                <LabelList dataKey="count" position="top" />
              </Bar>
            </BarChart>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riesgo por grupo de edad</CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="age-chart" className="flex justify-center">
            <BarChart width={320} height={200} data={ageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="band" />
              <YAxis hide />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-chart-2)" isAnimationActive={false}>
                <LabelList dataKey="count" position="top" />
              </Bar>
            </BarChart>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
