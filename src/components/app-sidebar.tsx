import { ClipboardList, LayoutDashboard, Users, type LucideIcon } from "lucide-react";
import { useSidebar } from "./ui/sidebar";
import {
  Sidebar,
  SidebarContent,
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
export function AppSidebar({ active, onNavigate }: AppSidebarProps) {
  const { setOpenMobile } = useSidebar();

  const handleNavigate = (id: TabId) => {
    onNavigate(id);
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <span className="truncate px-2 text-sm font-semibold">
          Despistaje de Anemia
        </span>
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
    </Sidebar>
  );
}
