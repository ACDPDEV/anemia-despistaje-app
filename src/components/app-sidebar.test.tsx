import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "./ui/sidebar";
import * as auth from "../lib/auth";
import { usePadronStore } from "../stores/padronStore";

vi.mock("../lib/auth", () => ({
  isAuthConfigured: vi.fn(() => true),
  signOut: vi.fn(),
}));

// Passthrough spy on SidebarMenuButton: renders the real button (so DOM
// assertions stay honest) while recording every props object, so the
// tooltip-workaround contract is pinned at the prop level.
const { menuButtonProps } = vi.hoisted(() => ({
  menuButtonProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("./ui/sidebar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ui/sidebar")>();
  function SpySidebarMenuButton(
    props: ComponentProps<typeof actual.SidebarMenuButton>,
  ) {
    menuButtonProps.push(props as Record<string, unknown>);
    return <actual.SidebarMenuButton {...props} />;
  }
  return { ...actual, SidebarMenuButton: SpySidebarMenuButton };
});

const mockedAuth = vi.mocked(auth);

// Sign-out entries are the only SidebarMenuButtons that carry a disabled
// prop (nav items never pass one).
function signOutCalls(): Array<Record<string, unknown>> {
  return menuButtonProps.filter((props) => "disabled" in props);
}

function stubDesktopViewport() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
  stubDesktopViewport();
  vi.clearAllMocks();
  menuButtonProps.length = 0;
  mockedAuth.isAuthConfigured.mockReturnValue(true);
});

describe("AppSidebar nav shortcuts", () => {
  it("exposes Alt+1/2/3 on the nav buttons even when collapsed", () => {
    render(
      <SidebarProvider>
        <AppSidebar active="register" onNavigate={vi.fn()} />
      </SidebarProvider>,
    );

    const expectations: Array<[RegExp, string]> = [
      [/registro/i, "Alt+1"],
      [/padrón/i, "Alt+2"],
      [/panel/i, "Alt+3"],
    ];
    for (const [name, keys] of expectations) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("aria-keyshortcuts", keys);
      // Native title carries the shortcut where the shortcuts line hides.
      expect(button.getAttribute("title")).toContain(keys);
    }
  });
});

describe("AppSidebar footer controls", () => {
  it("exposes the theme toggle with a Spanish target-mode name", () => {
    render(
      <SidebarProvider>
        <AppSidebar active="register" onNavigate={vi.fn()} />
      </SidebarProvider>,
    );
    // matches:false stub above = light default → offers dark.
    const toggle = screen.getByRole("button", { name: "Modo oscuro" });
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(
      screen.getByRole("button", { name: "Modo claro" }),
    ).toBeInTheDocument();
    document.documentElement.classList.remove("dark");
  });

  it("offers one task-ordered help entry covering the jornada", () => {
    render(
      <SidebarProvider>
        <AppSidebar active="register" onNavigate={vi.fn()} />
      </SidebarProvider>,
    );
    const help = screen.getByTestId("sidebar-help");
    expect(help).toHaveTextContent(/¿cómo funciona\?/i);
    for (const step of [/registra/i, /duplicado/i, /sincroniza/i, /imprime/i]) {
      expect(help).toHaveTextContent(step);
    }
    expect(help).toHaveTextContent(/alt\+s/i);
  });
});

describe("AppSidebar sign-out tooltip workaround", () => {
  it("keeps the tooltip while idle, drops it while pending, restores it after", async () => {
    mockedAuth.signOut.mockResolvedValue(undefined);
    render(
      <SidebarProvider>
        <AppSidebar active="register" onNavigate={vi.fn()} />
      </SidebarProvider>,
    );

    // Idle: the tooltip names the action.
    const idle = signOutCalls()[signOutCalls().length - 1];
    expect(idle.tooltip).toBe("Cerrar sesión");
    expect(idle.disabled).toBe(false);

    // Pending: the tooltip steps aside so Base UI TooltipTrigger cannot
    // swallow the native disabled attribute (it marks
    // data-trigger-disabled instead), and the button is REALLY disabled
    // in the DOM — not aria-only, not a wrapper attribute.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockedAuth.signOut.mockImplementationOnce(() => gate);
    fireEvent.click(screen.getByRole("button", { name: /^cerrar sesión$/i }));

    const pending = await screen.findByRole("button", {
      name: /cerrando sesión/i,
    });
    expect(pending).toHaveAttribute("disabled");
    expect(pending).toBeDisabled();
    const pendingProps = signOutCalls()[signOutCalls().length - 1];
    expect(pendingProps.tooltip).toBeUndefined();
    expect(pendingProps.disabled).toBe(true);

    // Settled: the tooltip returns with the idle label.
    release();
    await screen.findByRole("button", { name: /^cerrar sesión$/i });
    const settled = signOutCalls()[signOutCalls().length - 1];
    expect(settled.tooltip).toBe("Cerrar sesión");
    expect(settled.disabled).toBe(false);
  });
});
