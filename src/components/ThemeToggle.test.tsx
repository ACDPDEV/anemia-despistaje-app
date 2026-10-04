import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidebarProvider } from "./ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { THEME_STORAGE_KEY } from "../hooks/useTheme";

// matchMedia stub with a configurable dark signal. The hook only reads
// "(prefers-color-scheme: dark)", so one flag is enough.
function stubColorScheme(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-color-scheme: dark") ? dark : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderToggle() {
  return render(
    <SidebarProvider>
      <ThemeToggle />
    </SidebarProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  stubColorScheme(false);
  vi.clearAllMocks();
});

describe("ThemeToggle", () => {
  it("renders a Spanish toggle naming the target mode", () => {
    renderToggle();
    // Light default: pressing offers the dark mode.
    expect(
      screen.getByRole("button", { name: "Modo oscuro" }),
    ).toBeInTheDocument();
  });

  it("flips the .dark class and persists the choice", () => {
    renderToggle();
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Modo oscuro" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Modo claro" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Modo claro" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("re-hydrates the persisted choice across reloads", () => {
    const { unmount } = renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "Modo oscuro" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    unmount();

    // Fresh mount (reload): stored choice wins, no flash of light.
    document.documentElement.classList.remove("dark");
    renderToggle();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(
      screen.getByRole("button", { name: "Modo claro" }),
    ).toBeInTheDocument();
  });

  it("defaults to the OS signal when nothing is stored", () => {
    stubColorScheme(true);
    renderToggle();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(
      screen.getByRole("button", { name: "Modo claro" }),
    ).toBeInTheDocument();
  });

  it("is a keyboard-operable button with a 44px-ish coarse target", () => {
    renderToggle();
    const toggle = screen.getByRole("button", { name: "Modo oscuro" });
    expect(toggle.tagName).toBe("BUTTON");
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    expect(toggle.className).toMatch(/pointer-coarse:min-h-11/);
  });
});
