import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { RegisterForm } from "./components/RegisterForm";
import { PadronView } from "./components/PadronView";
import { DashboardView } from "./components/DashboardView";
import { LoginView } from "./components/LoginView";
import { AppSidebar, type TabId } from "./components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";
import {
  getSession,
  isAuthConfigured,
  onAuthStateChange,
} from "./lib/auth";

// Shell wiring the three views through the sidebar.
// Spanish labels, English identifiers. TabId is the single nav source.
// Auth gating: when Supabase credentials exist, unauthenticated users see
// LoginView and the shell only after sign-in; without credentials the shell
// renders directly (offline-first: fully usable with no auth).
export default function App() {
  const [tab, setTab] = useState<TabId>("register");
  const authConfigured = isAuthConfigured();
  const [session, setSession] = useState<Session | null | undefined>(
    authConfigured ? undefined : null,
  );

  useEffect(() => {
    if (!authConfigured) {
      setSession(null);
      return;
    }
    let alive = true;
    getSession()
      .then((s) => {
        if (alive) setSession(s);
      })
      .catch(() => {
        if (alive) setSession(null);
      });
    const unsubscribe = onAuthStateChange((_event, s) => setSession(s));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [authConfigured]);

  // Keyboard shortcut: Alt+1/Alt+2/Alt+3 switch tabs
  // (Registro/Padrón/Panel). preventDefault avoids browser menu conflicts.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "1") {
        event.preventDefault();
        setTab("register");
      } else if (event.key === "2") {
        event.preventDefault();
        setTab("padron");
      } else if (event.key === "3") {
        event.preventDefault();
        setTab("dashboard");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (authConfigured && session === undefined) {
    return (
      <main className="mx-auto w-full max-w-5xl p-6">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </main>
    );
  }

  if (authConfigured && !session) {
    return (
      <main className="mx-auto w-full max-w-md p-6">
        <h1 className="mb-4 text-2xl font-semibold">Despistaje de Anemia</h1>
        <LoginView />
      </main>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar active={tab} onNavigate={setTab} />
      <SidebarInset>
        <header className="flex items-center gap-2 p-4">
          <SidebarTrigger />
          <h1 className="text-2xl font-semibold">Despistaje de Anemia</h1>
        </header>
        <div className="mx-auto w-full max-w-5xl p-6">
          {/* Discoverability hint for the Alt+1/2/3 tab shortcuts (one place). */}
          <p className="sr-only">
            Atajos de teclado: Alt+1 Registro, Alt+2 Padrón, Alt+3 Panel.
          </p>
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
