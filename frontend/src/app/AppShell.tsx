import { Outlet } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { ToastProvider } from "../components/ToastProvider";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <RequireAuth>
      <ToastProvider>
        <div className="grid min-h-screen grid-cols-[220px_1fr]">
          <aside className="border-r bg-gray-50">
            <Sidebar />
          </aside>
          <div className="flex flex-col">
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
