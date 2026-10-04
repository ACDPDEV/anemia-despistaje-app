import { useRef, useState } from "react";
import { CircleHelp, ClipboardList, LayoutDashboard, LogOut, Users, type LucideIcon } from "lucide-react";
import { useSidebar } from "./ui/sidebar";
import { isAuthConfigured, signOut } from "../lib/auth";
import { toSpanishErrorMessage } from "../lib/errorMessages";
import { SyncStatusChip } from "./SyncStatusChip";
import { ThemeToggle } from "./ThemeToggle";
import { BrandLockup } from "./BrandLockup";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { Button } from "./ui/button";

export type TabId = "register" | "padron" | "dashboard";

export type NavItem = {
  id: TabId;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "register", label: "Registro", icon: ClipboardList },
  { id: "padron", label: "Padrón", icon: Users },
  { id: "dashboard", label: "Panel", icon: LayoutDashboard },
];

type AppSidebarProps = {
  active: TabId;
  onNavigate: (id: TabId) => void;
};

// Sole navigation control. Active state derives from the single TabId source.
// The header keeps the compact brand lockup (the page h1 owns the full
// title). The footer answers safety and discoverability: the sync/offline
// status chip (with its own sync action, surviving collapse as an icon
// button), the theme toggle (PRODUCT's required modo oscuro/claro),
// one task-ordered help disclosure (the only help entry point: registrar →
// duplicado → sincronizar → imprimir/exportar plus the Alt shortcuts; a help
// icon button with the SAME steps in a small popover when collapsed, since
// a title tooltip cannot carry 4 lines), one visible line naming the
// Alt+1/2/3/Alt+G shortcuts (the only shortcut source of truth, hidden when
// collapsed to icon width), plus logout when auth is configured
// (offline-first local mode shows no logout). The shortcuts line, help, and
// theme label hide when collapsed to icon width, so each nav button also
// carries aria-keyshortcuts plus a native title with its shortcut:
// collapsed icon buttons keep exposing Alt+1/2/3. Sign-out failure stays inline with a retry; success clears via
// App.tsx onAuthStateChange.

// The 4 jornada steps + shortcuts line, shared verbatim by the expanded
// <details> and the collapsed popover below: one component so the two
// branches can never drift apart.
function HelpSteps() {
  return (
    <>
      <ol className="mt-1 list-decimal space-y-0.5 pl-4">
        <li>Registra al paciente en la pestaña Registro.</li>
        <li>Revisa el aviso de posible duplicado.</li>
        <li>Sincroniza con Alt+G cuando tengas conexión.</li>
        <li>Imprime o exporta desde el Padrón.</li>
      </ol>
      <p className="mt-1">
        Atajos: Alt+1/2/3 cambian de pestaña, Alt+S registra, Alt+G
        sincroniza.
      </p>
    </>
  );
}
export function AppSidebar({ active, onNavigate }: AppSidebarProps) {
  const { setOpenMobile, state } = useSidebar();
  const authConfigured = isAuthConfigured();
  const collapsed = state === "collapsed";
  // Sign-out runs async on shared field devices: while pending the item is
  // disabled with a "Cerrando sesión…" label (same pending pattern as
  // LoginView), and a failure stays visible inline with a retry action
  // (same pattern as SyncStatusChip). Success needs no handling here:
  // App.tsx clears the session through onAuthStateChange.
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  // Collapsed help disclosure: icon-width users get the same 4 steps in a
  // small non-modal popover (a title tooltip cannot carry 4 lines). Toggle
  // + Esc + blur-out-of-wrapper close it; focus stays on the button so
  // screen-reader users meet the freshly revealed steps right after it.
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement>(null);

  const handleNavigate = (id: TabId) => {
    onNavigate(id);
    setOpenMobile(false);
  };

  async function handleSignOut(): Promise<void> {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch (err) {
      setSignOutError(
        err instanceof Error
          ? toSpanishErrorMessage(err.message)
          : "No se pudo cerrar la sesión. Inténtalo de nuevo.",
      );
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <BrandLockup />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Principal">
            <SidebarMenu>
              {NAV_ITEMS.map((item, index) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={active === item.id}
                    aria-current={active === item.id ? "page" : undefined}
                    aria-keyshortcuts={`Alt+${index + 1}`}
                    title={`${item.label} (Alt+${index + 1})`}
                    tooltip={item.label}
                    onClick={() => handleNavigate(item.id)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && (
          <p data-testid="sidebar-shortcuts" className="px-2 text-[11px] text-muted-foreground">
            Atajos: Alt+1 Registro · Alt+2 Padrón · Alt+3 Panel · Alt+G Sincronizar
          </p>
        )}
        <SyncStatusChip collapsed={collapsed} />
        <ThemeToggle />
        {collapsed ? (
          <div
            className="relative flex justify-center py-1"
            onBlur={(e) => {
              // Same disarm-on-leave grammar as the padron confirms: focus
              // leaving the wrapper closes the popover, draft-free.
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setHelpOpen(false);
              }
            }}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="pointer-coarse:min-h-11"
              ref={helpButtonRef}
              data-testid="sidebar-help-collapsed"
              aria-label="¿Cómo funciona?"
              aria-expanded={helpOpen}
              title="¿Cómo funciona?"
              onClick={() => setHelpOpen((open) => !open)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setHelpOpen(false);
              }}
            >
              <CircleHelp aria-hidden="true" />
            </Button>
            {helpOpen && (
              <div
                role="dialog"
                aria-label="¿Cómo funciona?"
                data-testid="sidebar-help-popover"
                className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground shadow-lg"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setHelpOpen(false);
                    helpButtonRef.current?.focus();
                  }
                }}
              >
                <p className="font-medium text-foreground">¿Cómo funciona?</p>
                <HelpSteps />
              </div>
            )}
          </div>
        ) : (
          <details data-testid="sidebar-help" className="px-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center">
              ¿Cómo funciona?
            </summary>
            <HelpSteps />
          </details>
        )}
        {authConfigured && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                // No tooltip while pending: Base UI TooltipTrigger swallows
                // the native disabled attribute (marks data-trigger-disabled
                // instead), so the tooltip must step aside for the pending
                // disable to reach the DOM.
                tooltip={signingOut ? undefined : "Cerrar sesión"}
                disabled={signingOut}
                onClick={() => void handleSignOut()}
              >
                <LogOut />
                <span>{signingOut ? "Cerrando sesión…" : "Cerrar sesión"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        {signOutError && (
          <div className="flex flex-col gap-1 px-2">
            <p role="alert" data-testid="signout-error" className="text-xs text-destructive">
              {signOutError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="pointer-coarse:min-h-11 self-start"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              Reintentar
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
