import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePadronStore } from "../stores/padronStore";
import { StatisticsView } from "./StatisticsView";

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
});

describe("StatisticsView", () => {
  it("renders Spanish labels with correct counts and average for a populated padron", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    add({ nombre: "Luis Paz", edadMeses: 30, nivelHemoglobina: 6.5 });

    render(<StatisticsView />);
    expect(screen.getByText(/estadísticas/i)).toBeInTheDocument();
    expect(screen.getByText(/total de pacientes/i)).toBeInTheDocument();
    expect(screen.getByText(/promedio de hemoglobina/i)).toBeInTheDocument();
    // All four Spanish band labels must be present
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Anemia Leve")).toBeInTheDocument();
    expect(screen.getByText("Anemia Moderada")).toBeInTheDocument();
    expect(screen.getByText("Anemia Severa")).toBeInTheDocument();
    // Average of 12.0 and 6.5 = 9.25
    expect(screen.getByText(/9\.25/)).toBeInTheDocument();
  });

  it("reports zeros without errors for an empty padron", () => {
    render(<StatisticsView />);
    expect(screen.getByText(/total de pacientes/i)).toBeInTheDocument();
    const zeros = screen.getAllByText("0");
    // total + 4 bands = at least 5 zero counts
    expect(zeros.length).toBeGreaterThanOrEqual(5);
  });
});
