import { usePadronStore } from "../stores/padronStore";
import type { Diagnosis } from "../domain/anemia";

const BANDS: Diagnosis[] = ["Normal", "Anemia Leve", "Anemia Moderada", "Anemia Severa"];

// Derived reporting view: counts per diagnosis + overall average,
// all labels in Spanish. Reads store selectors, holds no local copy.
export function StatisticsView() {
  const pacientes = usePadronStore((s) => s.pacientes).filter((p) => !p.deletedAt);
  const countByDiagnosis = usePadronStore((s) => s.countByDiagnosis);
  const averageHb = usePadronStore((s) => s.averageHb);

  const counts = countByDiagnosis();
  const avg = averageHb();

  return (
    <section>
      <h2 className="text-lg font-semibold">Estadísticas</h2>
      <p className="mt-2 text-sm">
        Total de pacientes: <span>{pacientes.length}</span>
      </p>
      <p className="mt-1 text-sm">
        Promedio de hemoglobina: <span>{avg.toFixed(2)} g/dL</span>
      </p>
      <ul className="mt-3 space-y-1">
        {BANDS.map((band) => (
          <li key={band} className="text-sm">
            <span>{band}</span>: <span>{counts[band]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
