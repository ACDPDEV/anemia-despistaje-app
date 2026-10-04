import { useState } from "react";
import { ClipboardList, LayoutDashboard, LogOut, Users, type LucideIcon } from "lucide-react";
import { useSidebar } from "./ui/sidebar";
import { isAuthConfigured, signOut } from "../lib/auth";
import { toSpanishErrorMessage } from "../lib/errorMessages";
import { SyncStatusChip } from "./SyncStatusChip";
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
// status chip, one visible line naming the Alt+1/2/3 tab shortcuts (the
// only shortcut source of truth, hidden when collapsed to icon width),
// plus logout when auth is configured (offline-first local mode shows no
// logout). Sign-out failure stays inline with a retry; success clears via
// App.tsx onAuthStateChange.
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
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={active === item.id}
                    aria-current={active === item.id ? "page" : undefined}
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
            Atajos: Alt+1 Registro · Alt+2 Padrón · Alt+3 Panel
          </p>
        )}
        <SyncStatusChip collapsed={collapsed} />
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
