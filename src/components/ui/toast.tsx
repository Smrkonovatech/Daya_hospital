"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = React.useCallback(
    ({ type, title, message }: Omit<ToastMessage, "id">) => {
      const id = `toast_${Date.now()}_${Math.random().toString().slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);

      // Auto dismiss after 4.5 seconds
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toasts, dismissToast }}>
      {children}
      {/* Toast viewport */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4 sm:p-0">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />,
    info: <Info className="h-4 w-4 text-sky-600 shrink-0" />,
  };

  const borders = {
    success: "border-emerald-200 bg-emerald-50/90 text-emerald-950",
    error: "border-rose-200 bg-rose-50/90 text-rose-950",
    warning: "border-amber-200 bg-amber-50/90 text-amber-950",
    info: "border-sky-200 bg-sky-50/90 text-sky-950",
  }[toast.type];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3.5 shadow-lg backdrop-blur-xs text-xs transition-all",
        borders
      )}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-[11px] opacity-80 leading-normal">
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="opacity-60 hover:opacity-100 p-0.5 rounded transition-opacity"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
