import { useState } from "react";
import { RegisterForm } from "./components/RegisterForm";
import { PadronView } from "./components/PadronView";
import { StatisticsView } from "./components/StatisticsView";

type View = "registro" | "padron" | "estadisticas";

const VIEWS: { id: View; label: string }[] = [
  { id: "registro", label: "Registro" },
  { id: "padron", label: "Padrón" },
  { id: "estadisticas", label: "Estadísticas" },
];

// Minimal shell wiring the three Phase 3 views. Sync lands in Unit 3.
export default function App() {
  const [view, setView] = useState<View>("registro");

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Despistaje de Anemia</h1>
      <nav className="mt-4 flex gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={`rounded px-4 py-2 text-sm ${
              view === v.id ? "bg-blue-600 text-white" : "border text-gray-700"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <div className="mt-6">
        {view === "registro" && <RegisterForm />}
        {view === "padron" && <PadronView />}
        {view === "estadisticas" && <StatisticsView />}
      </div>
    </main>
  );
}
