import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { usePadronStore } from "./stores/padronStore";
import { resetSupabaseClientForTests } from "./lib/supabase";
import App from "./App";

function setViewport(width: number, mobileMatch: boolean) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
    writable: true,
  });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobileMatch,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function setDesktopViewport() {
  setViewport(1280, false);
}

function registerPatient(
  name = "Ana Torres",
  age = "24",
  hb = "12.0",
) {
  fireEvent.change(screen.getByLabelText(/nombre/i), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText(/edad/i), {
    target: { value: age },
  });
  fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
    target: { value: hb },
  });
  fireEvent.click(screen.getByRole("button", { name: /registrar/i }));
}

beforeEach(() => {
  // The repo .env carries Supabase credentials, which would flip App into
  // the auth-gated branch. These shell tests cover the offline path, so
  // force the unconfigured state (Vite reads import.meta.env at render).
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  resetSupabaseClientForTests();
  localStorage.clear();
  usePadronStore.getState().reset();
  setDesktopViewport();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("App sidebar shell", () => {
  it("renders sidebar nav with exactly one active entry and no top tabs", () => {
    const { container } = render(<App />);

    const nav = screen.getByRole("navigation");
    const names = ["Registro", "Padrón", "Panel"];
    for (const name of names) {
      expect(
        within(nav).getByRole("button", { name }),
      ).toBeInTheDocument();
    }

    const active = within(nav).getAllByRole("button").filter(
      (button) => button.getAttribute("aria-current") === "page",
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAccessibleName(/registro/i);

    // Single navigation source: no Tabs control remains in the DOM.
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it("navigates through all three views from the sidebar", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");

    fireEvent.click(within(nav).getByRole("button", { name: /padrón/i }));
    expect(screen.getByRole("button", { name: /registrar paciente/i }))
      .toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: /padrón/i }).getAttribute(
        "aria-current",
      ),
    ).toBe("page");

    fireEvent.click(within(nav).getByRole("button", { name: /panel/i }));
    expect(screen.getByTestId("kpi-total")).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: /panel/i }).getAttribute(
        "aria-current",
      ),
    ).toBe("page");

    fireEvent.click(within(nav).getByRole("button", { name: /registro/i }));
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: /registro/i }).getAttribute(
        "aria-current",
      ),
    ).toBe("page");
  });

  it("registers a patient and shows it in padron and panel via sidebar nav", () => {
    render(<App />);

    registerPatient();
    expect(screen.getByText(/paciente registrado/i)).toBeInTheDocument();

    const nav = screen.getByRole("navigation");
    fireEvent.click(within(nav).getByRole("button", { name: /padrón/i }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /panel/i }));
    expect(screen.getByTestId("kpi-total")).toHaveTextContent("1");
    expect(screen.getByText(/12\.00/)).toBeInTheDocument();
  });

  it("navigates back to registro from the empty padron call-to-action", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    fireEvent.click(within(nav).getByRole("button", { name: /padrón/i }));
    fireEvent.click(screen.getByRole("button", { name: /registrar paciente/i }));
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it("collapses to icons and expands back, keeping nav functional", () => {
    const { container } = render(<App />);
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute("data-state")).toBe("expanded");

    fireEvent.click(screen.getByRole("button", { name: /alternar barra lateral/i }));
    expect(
      container.querySelector('[data-slot="sidebar"]')?.getAttribute(
        "data-state",
      ),
    ).toBe("collapsed");

    const nav = screen.getByRole("navigation");
    fireEvent.click(within(nav).getByRole("button", { name: /padrón/i }));
    expect(screen.getByRole("button", { name: /registrar paciente/i }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /alternar barra lateral/i }));
    expect(
      container.querySelector('[data-slot="sidebar"]')?.getAttribute(
        "data-state",
      ),
    ).toBe("expanded");
  });

  it("dismisses the overlay after selecting a view on small screens", () => {
    setViewport(375, true);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /alternar barra lateral/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /padrón/i }),
    );

    expect(
      screen.getByRole("button", { name: /registrar paciente/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps a single full title in the page h1 with a compact sidebar wordmark", () => {
    render(<App />);
    const headings = screen.getAllByRole("heading", { name: /despistaje/i });
    // The page h1 owns the full title; the sidebar keeps a short wordmark.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Despistaje de Anemia",
    );
    expect(headings.filter((h) => h.textContent === "Despistaje de Anemia"))
      .toHaveLength(1);
  });

  it("answers safety from the shell footer when the padron is clean", () => {
    render(<App />);
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "A salvo en este equipo",
    );
  });

  it("counts unsynced registrations in the shell chip", () => {
    render(<App />);
    registerPatient();
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "1 por sincronizar",
    );
  });
});
