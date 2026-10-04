import { useState } from "react";
import { RegisterForm } from "./components/RegisterForm";
import { PadronView } from "./components/PadronView";
import { DashboardView } from "./components/DashboardView";
import { AppSidebar, type TabId } from "./components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";

// Shell wiring the three views through the sidebar.
// Spanish labels, English identifiers. TabId is the single nav source.
export default function App() {
  const [tab, setTab] = useState<TabId>("register");

  return (
    <SidebarProvider>
      <AppSidebar active={tab} onNavigate={setTab} />
      <SidebarInset>
        <header className="flex items-center gap-2 p-4">
          <SidebarTrigger />
          <h1 className="text-2xl font-semibold">Despistaje de Anemia</h1>
        </header>
        <div className="mx-auto w-full max-w-5xl p-6">
          {tab === "register" && <RegisterForm />}
          {tab === "padron" && (
            <PadronView onEmptyRegister={() => setTab("register")} />
          )}
          {tab === "dashboard" && <DashboardView />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
