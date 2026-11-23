import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Toast = {
  id: number;
  title: string;
  body?: string;
  tone?: "default" | "error" | "success" | "gold";
  action?: { label: string; onClick: () => void };
  duration?: number;
};

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = seq++;
      setToasts((list) => [...list.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.duration ?? (t.action ? 7000 : 4000));
    },
    [dismiss],
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      {createPortal(
        <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex max-w-md flex-col gap-2 px-3 pt-3 md:left-auto md:right-4 md:mx-0 md:w-96">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`glass pointer-events-auto flex animate-rise items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl ${
                t.tone === "error" ? "border-danger/40" : t.tone === "success" ? "border-accent/40" : t.tone === "gold" ? "border-gold/50" : "border-white/10"
              }`}
              onClick={() => dismiss(t.id)}
            >
              <div className="min-w-0 flex-1">
                <div className={`text-[15px] font-semibold ${t.tone === "gold" ? "text-gold-bright" : ""}`}>{t.title}</div>
                {t.body && <div className="mt-0.5 text-sm text-mist">{t.body}</div>}
              </div>
              {t.action && (
                <button
                  className="btn btn-primary h-9 shrink-0 px-3.5 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
