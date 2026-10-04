import { ClipboardList, LayoutDashboard, LogOut, Users, type LucideIcon } from "lucide-react";
import { useSidebar } from "./ui/sidebar";
import { isAuthConfigured, signOut } from "../lib/auth";
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
// only shortcut source of truth), plus logout when auth is configured
// (offline-first local mode shows no logout).
export function AppSidebar({ active, onNavigate }: AppSidebarProps) {
  const { setOpenMobile } = useSidebar();
  const authConfigured = isAuthConfigured();

  const handleNavigate = (id: TabId) => {
    onNavigate(id);
    setOpenMobile(false);
  };

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
        <p className="px-2 text-[11px] text-muted-foreground">
          Atajos: Alt+1 Registro · Alt+2 Padrón · Alt+3 Panel
        </p>
        <SyncStatusChip />
        {authConfigured && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Cerrar sesión"
                onClick={() => void signOut()}
              >
                <LogOut />
                <span>Cerrar sesión</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
