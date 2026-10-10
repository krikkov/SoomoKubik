import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export type ToastKind = "success" | "info" | "warning" | "danger";
type ToastItem = { id: number; text: string; kind: ToastKind };
type ToastFn = (text: string, kind?: ToastKind, ms?: number) => void;

const ToastContext = createContext<ToastFn>(() => {});

/** Короткие уведомления, исчезающие сами через несколько секунд */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback<ToastFn>((text, kind = "info", ms = 3000) => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-2), { id, text, kind }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), ms);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "toast-in pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-center text-sm font-semibold shadow-2xl backdrop-blur",
              t.kind === "success" && "border-emerald-500/50 bg-emerald-950/90 text-emerald-200",
              t.kind === "info" && "border-sky-500/50 bg-slate-900/95 text-sky-200",
              t.kind === "warning" && "border-amber-500/50 bg-amber-950/90 text-amber-200",
              t.kind === "danger" && "border-rose-500/50 bg-rose-950/90 text-rose-200",
            )}
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
