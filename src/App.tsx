import { useState } from "react";
import { RegisterForm } from "./components/RegisterForm";
import { PadronView } from "./components/PadronView";
import { DashboardView } from "./components/DashboardView";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./components/ui/tabs";

type TabId = "register" | "padron" | "dashboard";

const TABS: { id: TabId; label: string }[] = [
  { id: "register", label: "Registro" },
  { id: "padron", label: "Padrón" },
  { id: "dashboard", label: "Dashboard" },
];

// Shell wiring the three views through shadcn Tabs.
// Spanish labels, English identifiers.
export default function App() {
  const [tab, setTab] = useState<TabId>("register");

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Despistaje de Anemia</h1>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as TabId)}
        className="mt-4"
      >
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="register">
          <RegisterForm />
        </TabsContent>
        <TabsContent value="padron">
          <PadronView onEmptyRegister={() => setTab("register")} />
        </TabsContent>
        <TabsContent value="dashboard">
          <DashboardView />
        </TabsContent>
      </Tabs>
    </main>
  );
}
