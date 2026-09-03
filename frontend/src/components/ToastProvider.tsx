import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Variant = "info" | "erreur";
type Toast = { id: number; message: string; variant: Variant };
type Ctx = { toast: (message: string, variant?: Variant) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, variant: Variant = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded px-4 py-2 text-sm text-white shadow ${
              t.variant === "erreur" ? "bg-red-600" : "bg-gray-800"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast hors ToastProvider");
  return c;
}
