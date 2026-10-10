import React from "react";
import { cn } from "@/utils/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg" | "xl";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-3.5 text-base",
        size === "xl" && "px-8 py-6 text-lg",
        variant === "primary" &&
          "bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-orange-900/30 hover:from-amber-300 hover:to-orange-400",
        variant === "secondary" &&
          "border border-slate-600/70 bg-slate-800/70 text-slate-100 hover:border-slate-500 hover:bg-slate-700/70",
        variant === "ghost" && "text-slate-300 hover:bg-slate-800/60 hover:text-white",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-500",
        variant === "success" && "bg-emerald-600 text-white hover:bg-emerald-500",
        className,
      )}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-xl shadow-black/20 backdrop-blur",
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-slate-600/70 bg-slate-950/60 px-3 py-2.5 text-slate-100",
        "placeholder:text-slate-500 focus:border-amber-400/70 focus:outline-none",
        className,
      )}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={cn("mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400", className)} />;
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "my-8 w-full rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl",
          wide ? "max-w-3xl" : "max-w-md",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 text-2xl leading-none text-slate-400 hover:text-white">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-amber-400" />
      {label ?? "Загрузка…"}
    </div>
  );
}

export function PageTitle({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="text-xl">
            ←
          </Button>
        )}
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
