import { Outlet } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { ToastProvider } from "../components/ToastProvider";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <RequireAuth>
      <ToastProvider>
        <div className="min-h-screen bg-background">
          <aside className="fixed inset-y-0 left-0 z-40 w-[254px] overflow-y-auto bg-sidebar">
            <Sidebar />
          </aside>
          <div className="ml-[254px] flex min-h-screen flex-col">
            <Topbar />
            <main className="flex-1 p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </ToastProvider>
    </RequireAuth>
  );
}
