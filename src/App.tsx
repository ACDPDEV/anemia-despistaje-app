import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { RegisterForm } from "./components/RegisterForm";
import { PadronView } from "./components/PadronView";
import { DashboardView } from "./components/DashboardView";
import { LoginView } from "./components/LoginView";
import { AppSidebar, type TabId } from "./components/app-sidebar";
import { BrandLockup } from "./components/BrandLockup";
import { Card, CardContent, CardHeader } from "./components/ui/card";
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

// Alt+S guard: an armed padron confirm or an open edit row owns the
// keyboard (PadronView two-tap grammar: Enter confirms, Esc disarms), so
// the global submit must stand down. DOM-queried because the padron state
// lives in the unmounted sibling tab, not in this shell.
// - aria-label^="Confirmar eliminación": armed row/bulk delete confirms.
// - input[id^="nombre-"]: open edit rows (row-scoped ids; the register
//   form's own input id is exactly "nombre", so it never self-matches).
// - "Descartar cambios?": armed dirty-discard confirm.
function isPadronGuardArmed(doc: Document): boolean {
  if (doc.querySelector('[aria-label^="Confirmar eliminación"]')) return true;
  if (doc.querySelector('input[id^="nombre-"]')) return true;
  return [...doc.querySelectorAll("button")].some(
    (button) => button.textContent === "Descartar cambios?",
  );
}
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

  // Keyboard shortcuts: Alt+1/Alt+2/Alt+3 switch tabs
  // (Registro/Padrón/Panel); Alt+S submits the register form.
  // preventDefault avoids browser menu conflicts. Alt+S is scoped to the
  // register tab and stands down while a padron guard is armed (see
  // isPadronGuardArmed above).
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
      } else if (event.key === "s" || event.key === "S") {
        if (tab !== "register") return;
        if (isPadronGuardArmed(document)) return;
        event.preventDefault();
        (
          document.getElementById("register-form") as HTMLFormElement | null
        )?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab]);

  if (authConfigured && session === undefined) {
    return (
      <main className="mx-auto w-full max-w-5xl p-6">
        <p role="status" className="text-sm text-muted-foreground">Cargando…</p>
      </main>
    );
  }

  if (authConfigured && !session) {
    // Login card: header owns the brand + page title (h1 stays the page
    // title), body owns the form. No offline-first reassurance line: at
    // this gate sign-in is still required, so that promise would be false
    // here (PRODUCT.md principle 1 applies past the gate, not on it).
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
        <Card>
          <CardHeader>
            <BrandLockup />
            <h1 className="text-2xl font-semibold">Despistaje de Anemia</h1>
          </CardHeader>
          <CardContent>
            <LoginView />
          </CardContent>
        </Card>
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
          {tab === "register" && <RegisterForm />}
          {tab === "padron" && (
            <PadronView onEmptyRegister={() => setTab("register")} />
          )}
          {tab === "dashboard" && (
            <DashboardView onEmptyRegister={() => setTab("register")} />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
