import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";

// Sidebar theme toggle: the only path to PRODUCT's required modo
// oscuro/claro. Icon + Spanish label expanded, icon with tooltip +
// accessible name collapsed; a native button so keyboard comes free.
// The label names the TARGET (what pressing does), matching the
// action-naming grammar of the neighbor Cerrar sesión button.
export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const dark = mode === "dark";
  const label = dark ? "Modo claro" : "Modo oscuro";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={label}
          aria-label={label}
          title={label}
          onClick={toggle}
          className="pointer-coarse:min-h-11"
        >
          {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
