import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { usePadronStore } from "./stores/padronStore";
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
  localStorage.clear();
  usePadronStore.getState().reset();
  setDesktopViewport();
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

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    expect(
      container.querySelector('[data-slot="sidebar"]')?.getAttribute(
        "data-state",
      ),
    ).toBe("collapsed");

    const nav = screen.getByRole("navigation");
    fireEvent.click(within(nav).getByRole("button", { name: /padrón/i }));
    expect(screen.getByRole("button", { name: /registrar paciente/i }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    expect(
      container.querySelector('[data-slot="sidebar"]')?.getAttribute(
        "data-state",
      ),
    ).toBe("expanded");
  });

  it("dismisses the overlay after selecting a view on small screens", () => {
    setViewport(375, true);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /padrón/i }),
    );

    expect(
      screen.getByRole("button", { name: /registrar paciente/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
