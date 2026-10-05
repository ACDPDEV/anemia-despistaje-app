import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { usePadronStore } from "./stores/padronStore";
import { useRegisterDraftStore } from "./stores/registerDraftStore";
import { resetSupabaseClientForTests } from "./lib/supabase";
import { resetSyncGuardForTests } from "./lib/syncGuard";
import { SyncStatusChip } from "./components/SyncStatusChip";
import { RegisterForm } from "./components/RegisterForm";
import { PadronView } from "./components/PadronView";
import { DashboardView } from "./components/DashboardView";
import { SidebarProvider } from "./components/ui/sidebar";
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
  // Two submit affordances share the register form (primary + phone bar):
  // pin the primary by testid so the helper never ambiguates.
  fireEvent.click(screen.getByTestId("register-submit"));
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
  // The last sync error is module-owned: clear it so a failure in one
  // test never leaks an alert line into the next.
  resetSyncGuardForTests();
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
    // One-decimal Hb voice shared with print and CSV (formatHb).
    expect(screen.getByTestId("kpi-avg")).toHaveTextContent("12.0 g/dL");
  });

  it("shows the phone submit bar on Registro only, never on Padrón/Panel (run-29 P2-1)", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");

    // Registro tab: the bar rides inside the register form.
    expect(screen.getByTestId("register-submit-bar")).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /padrón/i }));
    expect(
      screen.queryByTestId("register-submit-bar"),
    ).not.toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /panel/i }));
    expect(
      screen.queryByTestId("register-submit-bar"),
    ).not.toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /registro/i }));
    expect(screen.getByTestId("register-submit-bar")).toBeInTheDocument();
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
      "A salvo en este equipo · Aún sin sincronizar",
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

  it("submits the register form with Alt+S on the register tab", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Ana Torres" },
    });
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: "12.0" },
    });

    fireEvent.keyDown(window, { key: "s", altKey: true });

    expect(usePadronStore.getState().pacientes).toHaveLength(1);
    expect(screen.getByText(/paciente registrado/i)).toBeInTheDocument();
  });

  it("ignores Alt+S off the register tab", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    fireEvent.click(within(nav).getByRole("button", { name: /panel/i }));
    expect(screen.getByTestId("kpi-total")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "s", altKey: true });

    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("ignores Alt+S while any padron guard owns the keyboard", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Ana Torres" },
    });
    fireEvent.change(screen.getByLabelText(/edad/i), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText(/hemoglobina/i), {
      target: { value: "12.0" },
    });

    // One planted node per guard signal the shell stands down for: armed
    // delete confirm, open edit row, armed dirty-discard confirm.
    const guards: HTMLElement[] = [];
    const confirm = document.createElement("button");
    confirm.setAttribute("aria-label", "Confirmar eliminación de Prueba");
    confirm.textContent = "Confirmar";
    guards.push(confirm);
    const editInput = document.createElement("input");
    editInput.id = "nombre-abc123";
    guards.push(editInput);
    const discard = document.createElement("button");
    discard.textContent = "Descartar cambios?";
    guards.push(discard);

    try {
      for (const guard of guards) {
        document.body.appendChild(guard);
        fireEvent.keyDown(window, { key: "s", altKey: true });
        expect(usePadronStore.getState().pacientes).toHaveLength(0);
        guard.remove();
      }
    } finally {
      for (const guard of guards) guard.remove();
    }

    // Guards gone: the same shortcut submits.
    fireEvent.keyDown(window, { key: "s", altKey: true });
    expect(usePadronStore.getState().pacientes).toHaveLength(1);
  });

  it("exposes Alt+1/2/3 on the nav buttons via aria-keyshortcuts", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    expect(
      within(nav).getByRole("button", { name: /registro/i }),
    ).toHaveAttribute("aria-keyshortcuts", "Alt+1");
    expect(
      within(nav).getByRole("button", { name: /padrón/i }),
    ).toHaveAttribute("aria-keyshortcuts", "Alt+2");
    expect(
      within(nav).getByRole("button", { name: /panel/i }),
    ).toHaveAttribute("aria-keyshortcuts", "Alt+3");
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

  it("names the Alt+G sync shortcut in the footer shortcuts line", () => {
    render(<App />);
    expect(screen.getByTestId("sidebar-shortcuts")).toHaveTextContent(
      /alt\+g sincronizar/i,
    );
    // run-5 P2 (clarify): the shortcuts line names the phone tap path too.
    expect(screen.getByTestId("sidebar-shortcuts")).toHaveTextContent(
      /en teléfono, botón sincronizar/i,
    );
  });

  it("fires the sync with Alt+G when pending work exists", async () => {
    render(<App />);
    registerPatient();
    expect(screen.getByTestId("sync-status-chip")).toHaveTextContent(
      "1 por sincronizar",
    );

    fireEvent.keyDown(window, { key: "g", altKey: true });

    // Offline-first shell: no Supabase credentials here, so the sync path
    // runs and reports the unconfigured cause — proving Alt+G fired it.
    // The error is module-owned: the sidebar chip AND the Registro phone
    // row announce the identical string.
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) {
      expect(alert).toHaveTextContent(/no está configurada/i);
    }
  });

  it("ignores Alt+G while any padron guard owns the keyboard", () => {
    render(<App />);
    registerPatient();

    // Same planted-guard grammar as the Alt+S test: armed delete confirm,
    // open edit row, armed dirty-discard confirm.
    const guards: HTMLElement[] = [];
    const confirm = document.createElement("button");
    confirm.setAttribute("aria-label", "Confirmar eliminación de Prueba");
    confirm.textContent = "Confirmar";
    guards.push(confirm);
    const editInput = document.createElement("input");
    editInput.id = "nombre-abc123";
    guards.push(editInput);
    const discard = document.createElement("button");
    discard.textContent = "Descartar cambios?";
    guards.push(discard);

    try {
      for (const guard of guards) {
        document.body.appendChild(guard);
        fireEvent.keyDown(window, { key: "g", altKey: true });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        guard.remove();
      }
    } finally {
      for (const guard of guards) guard.remove();
    }
  });

  it("ignores Alt+G with a clean padron (no sync action to fire)", () => {
    render(<App />);
    expect(
      screen.queryByRole("button", { name: /sincronizar/i }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "g", altKey: true });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(usePadronStore.getState().pacientes).toHaveLength(0);
  });

  it("keeps a working sync button when collapsed", async () => {
    render(<App />);
    registerPatient();
    fireEvent.click(screen.getByRole("button", { name: /alternar barra lateral/i }));
    expect(screen.queryByTestId("sidebar-shortcuts")).not.toBeInTheDocument();

    // Collapsed chip keeps its icon action beside the Registro phone
    // row: two Sincronizar buttons, both Alt+G, both data-sync-action.
    const actions = screen.getAllByRole("button", { name: /^sincronizar$/i });
    expect(actions).toHaveLength(2);
    const action = within(screen.getByTestId("sync-status-chip")).getByRole(
      "button",
      { name: /^sincronizar$/i },
    );
    expect(action).toHaveAttribute("aria-keyshortcuts", "Alt+G");
    expect(action.getAttribute("title")).toContain("Alt+G");

    fireEvent.click(action);
    // Offline-first shell: no Supabase credentials here, so the sync path
    // runs and the failure surfaces the collapsed way — the composed title
    // carries the cause and the actions become retries. Both mounted
    // surfaces (collapsed chip + Registro phone row) share the module
    // error, so both flip to Reintentar with the identical alert.
    const retries = await screen.findAllByRole("button", { name: /reintentar/i });
    expect(retries).toHaveLength(2);
    const retry = retries[0];
    expect(retry).toHaveAttribute("aria-keyshortcuts", "Alt+G");
    expect(screen.getByTestId("sync-status-chip")).toHaveAttribute(
      "title",
      expect.stringMatching(/no está configurada/i),
    );
  });

  it("keeps the help steps behind a collapsed help control", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /alternar barra lateral/i }));
    expect(screen.queryByTestId("sidebar-help")).not.toBeInTheDocument();

    const help = screen.getByTestId("sidebar-help-collapsed");
    expect(help).toHaveAttribute("aria-label", expect.stringMatching(/cómo funciona/i));
    fireEvent.click(help);

    const popover = screen.getByTestId("sidebar-help-popover");
    for (const step of [/registra/i, /duplicado/i, /sincroniza/i, /imprime/i]) {
      expect(popover).toHaveTextContent(step);
    }
    expect(popover).toHaveTextContent(/alt\+g/i);
    // run-5 P2 (clarify): the shared steps name the tap path for phones.
    expect(popover).toHaveTextContent(/botón sincronizar/i);
  });

  it("fires a sync with Alt+G from the Padrón tab (phone row mounted)", async () => {
    render(<App />);
    registerPatient();
    fireEvent.click(screen.getByRole("button", { name: /^padrón$/i }));

    // The Padrón tab mounts the phone-only sync row beside the sidebar
    // chip; both carry data-sync-action and the shell query resolves.
    expect(screen.getByTestId("padron-sync-phone")).toHaveTextContent(
      "1 por sincronizar",
    );
    expect(
      document.querySelector(
        'button[data-sync-action="true"]:not([disabled])',
      ),
    ).not.toBeNull();

    fireEvent.keyDown(window, { key: "g", altKey: true });

    // Offline-first shell: no Supabase credentials here, so the sync path
    // runs and reports the unconfigured cause — proving Alt+G fired it.
    // The error is module-owned: the sidebar chip (first in DOM order) and
    // the Padrón phone row announce the identical string.
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) {
      expect(alert).toHaveTextContent(/no está configurada/i);
    }
  });

  it("resolves Alt+G across every mounted sync surface (chip + all 3 phone rows)", async () => {
    // Constructible permutation the tab switcher never shows: every view
    // mounted at once beside the sidebar chip. One dirty row arms all
    // four actions through the same hook + module error.
    usePadronStore.getState().add({
      nombre: "Ana Torres",
      edadMeses: 24,
      nivelHemoglobina: 12.0,
    });
    render(
      <SidebarProvider>
        <SyncStatusChip />
        <RegisterForm />
        <PadronView />
        <DashboardView />
      </SidebarProvider>,
    );
    // All three phone rows render the identical structure beside the chip.
    for (const testId of [
      "register-sync-phone",
      "padron-sync-phone",
      "dashboard-sync-phone",
    ]) {
      expect(screen.getByTestId(testId)).toHaveTextContent("1 por sincronizar");
    }
    // Four enabled actions; the exact shell query resolves to exactly one
    // working button (first in DOM order — the sidebar chip).
    const actions = document.querySelectorAll(
      'button[data-sync-action="true"]:not([disabled])',
    );
    expect(actions).toHaveLength(4);
    const shellTarget = document.querySelector<HTMLButtonElement>(
      'button[data-sync-action="true"]:not([disabled])',
    );
    expect(shellTarget).not.toBeNull();
    expect(shellTarget).not.toBeDisabled();
    fireEvent.click(shellTarget!);
    // One module error, four announcers — identical string everywhere.
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(4);
    for (const alert of alerts) {
      expect(alert).toHaveTextContent(/no está configurada/i);
    }
  });
});
