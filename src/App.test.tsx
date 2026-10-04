import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { usePadronStore } from "./stores/padronStore";
import { useRegisterDraftStore } from "./stores/registerDraftStore";
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
  useRegisterDraftStore.getState().clearDraft();
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

  it("navigates back to registro from the empty dashboard call-to-action", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    fireEvent.click(within(nav).getByRole("button", { name: /panel/i }));
    fireEvent.click(screen.getByRole("button", { name: /registrar paciente/i }));
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: /registro/i }).getAttribute(
        "aria-current",
      ),
    ).toBe("page");
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

  it("hides the shortcut line when collapsed but keeps the sync title", () => {
    render(<App />);
    expect(screen.getByTestId("sidebar-shortcuts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /alternar barra lateral/i }));
    expect(screen.queryByTestId("sidebar-shortcuts")).not.toBeInTheDocument();
    // The collapsed chip keeps its composed title tooltip.
    expect(screen.getByTestId("sync-status-chip")).toHaveAttribute(
      "title",
      "Guardado en este equipo · sin sincronizar · Sin sincronizar aún",
    );

    fireEvent.click(screen.getByRole("button", { name: /alternar barra lateral/i }));
    expect(screen.getByTestId("sidebar-shortcuts")).toBeInTheDocument();
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
      "Guardado en este equipo · sin sincronizar",
    );
  });

  it("counts unsynced registrations in the shell chip", () => {
    render(<App />);
    registerPatient();
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "1 por sincronizar",
    );
  });

  it("switches tabs with Alt+1/Alt+2/Alt+3 without browser menu conflicts", () => {
    render(<App />);
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "2", altKey: true });
    expect(screen.getByRole("button", { name: /registrar paciente/i }))
      .toBeInTheDocument();

    fireEvent.keyDown(window, { key: "3", altKey: true });
    expect(screen.getByTestId("kpi-total")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "1", altKey: true });
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it("names the keyboard tab shortcuts once for discoverability", () => {
    render(<App />);
    expect(screen.getByText(/alt\+1 registro/i)).toBeInTheDocument();
  });

  it("shows the shortcut hint visibly in the sidebar footer, not sr-only", () => {
    render(<App />);
    const hint = screen.getByText(/alt\+1 registro/i);
    expect(hint).not.toHaveClass("sr-only");
    // One source of truth: the old sr-only copy is gone, no duplication.
    expect(screen.queryByText(/atajos de teclado/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/alt\+1 registro/i)).toHaveLength(1);
  });

  it("renders the severity-dot brand lockup in the sidebar header", () => {
    const { container } = render(<App />);
    const lockup = screen.getByTestId("brand-lockup");
    expect(lockup).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="sidebar-header"]'),
    ).toContainElement(lockup);
    // Four severity dots, theme tokens only, decorative.
    const dots = lockup.querySelectorAll('span[aria-hidden="true"] > span');
    expect(dots).toHaveLength(4);
  });
});
