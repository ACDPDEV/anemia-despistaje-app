import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "./ui/sidebar";
import { Sheet, SheetContent } from "./ui/sheet";
import * as auth from "../lib/auth";
import { usePadronStore } from "../stores/padronStore";
import { resetSyncGuardForTests } from "../lib/syncGuard";

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
  resetSyncGuardForTests();
  stubDesktopViewport();
  vi.clearAllMocks();
  menuButtonProps.length = 0;
  mockedAuth.isAuthConfigured.mockReturnValue(true);
});

describe("AppSidebar nav shortcuts", () => {
  it("exposes Alt+1/2/3 on the nav buttons even when collapsed", () => {    render(
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

describe("AppSidebar nav landmark (run-22 P2-1)", () => {
  it("exposes exactly one labelled nav landmark with the visible label non-landmark", () => {
    render(
      <SidebarProvider>
        <AppSidebar active="register" onNavigate={vi.fn()} />
      </SidebarProvider>,
    );

    // ONE landmark, one name: the named <nav> owns navigation.
    const navs = screen.getAllByRole("navigation");
    expect(navs).toHaveLength(1);
    expect(navs[0]).toHaveAccessibleName("Principal");
    // The visible "Menú" text stays for sighted users but never forms a
    // second labelled landmark.
    const menu = screen.getByText("Menú");
    expect(menu).toHaveAttribute("aria-hidden", "true");
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
    expect(help).toHaveTextContent(/alt\+g/i);
    // View-scoped entries are named as intentional scoping, not drift:
    // each view teaches its own scope in its own ¿Cómo funciona?
    expect(help).toHaveTextContent(/cada vista explica lo suyo/i);
  });

  it("names the Alt+G sync shortcut in the shortcuts line", () => {
    render(
      <SidebarProvider>
        <AppSidebar active="register" onNavigate={vi.fn()} />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("sidebar-shortcuts")).toHaveTextContent(
      /alt\+g sincronizar/i,
    );
  });
});

describe("AppSidebar collapsed footer", () => {
  it("keeps a working sync action when collapsed", () => {
    const { add } = usePadronStore.getState();
    add({ nombre: "Ana Torres", edadMeses: 24, nivelHemoglobina: 12.0 });
    render(
      <SidebarProvider defaultOpen={false}>
        <AppSidebar active="register" onNavigate={vi.fn()} />
      </SidebarProvider>,
    );
    // Icon-width: no shortcuts line, no details — but the sync action and
    // the help entry both survive as icon buttons.
    expect(screen.queryByTestId("sidebar-shortcuts")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-help")).not.toBeInTheDocument();
    const action = screen.getByRole("button", { name: /^sincronizar$/i });
    expect(action).toHaveAttribute("aria-keyshortcuts", "Alt+G");
    expect(action.getAttribute("title")).toContain("Alt+G");
    expect(action.getAttribute("title")).toContain("1 por sincronizar");
  });

  it("reveals the same 4 help steps behind the collapsed help control", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <AppSidebar active="register" onNavigate={vi.fn()} />
      </SidebarProvider>,
    );
    expect(screen.queryByTestId("sidebar-help")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sidebar-help-collapsed"));
    const popover = screen.getByTestId("sidebar-help-popover");
    for (const step of [/registra/i, /duplicado/i, /sincroniza/i, /imprime/i]) {
      expect(popover).toHaveTextContent(step);
    }
    expect(popover).toHaveTextContent(/alt\+g/i);
    // The heading owns the popover name (run-26 P3-1): labelledby, not a
    // detached aria-label copy.
    expect(popover).toHaveAttribute(
      "aria-labelledby",
      "sidebar-help-heading",
    );
    expect(screen.getByText("¿Cómo funciona?", { selector: "p" })).toHaveAttribute(
      "id",
      "sidebar-help-heading",
    );

    // Esc closes the popover and returns focus to its button.
    fireEvent.keyDown(popover, { key: "Escape" });
    expect(screen.queryByTestId("sidebar-help-popover")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByTestId("sidebar-help-collapsed"),
    );
  });

  it("returns focus to the trigger when blur closes the popover", () => {
    // run-26 P3-1 focus contract: EVERY close lands focus on the trigger,
    // blur-out-of-wrapper included (gated on actually being open, so an
    // idle tab-past never yanks focus back).
    render(
      <SidebarProvider defaultOpen={false}>
        <AppSidebar active="register" onNavigate={vi.fn()} />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByTestId("sidebar-help-collapsed"));
    expect(screen.getByTestId("sidebar-help-popover")).toBeInTheDocument();

    const wrapper = screen.getByTestId("sidebar-help-popover").parentElement!;
    fireEvent.blur(wrapper, { relatedTarget: document.body });
    expect(screen.queryByTestId("sidebar-help-popover")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByTestId("sidebar-help-collapsed"),
    );
  });

  it("unmounts closed Sheet content so Alt+G never targets a hidden chip", () => {
    // Empirical Base UI check behind the Alt+G first-in-DOM rule: with the
    // phone Sheet closed, its sidebar chip must leave the DOM entirely —
    // only then does the mounted view's phone row win the shell query.
    const { rerender } = render(
      <Sheet open={false}>
        <SheetContent>
          <button type="button" data-sync-action="true">
            Sincronizar
          </button>
        </SheetContent>
      </Sheet>,
    );
    expect(
      document.querySelector('button[data-sync-action="true"]'),
    ).toBeNull();
    // Open: the chip mounts and the query resolves to a working button.
    rerender(
      <Sheet open={true}>
        <SheetContent>
          <button type="button" data-sync-action="true">
            Sincronizar
          </button>
        </SheetContent>
      </Sheet>,
    );
    expect(
      document.querySelector<HTMLButtonElement>(
        'button[data-sync-action="true"]:not([disabled])',
      ),
    ).not.toBeNull();
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
