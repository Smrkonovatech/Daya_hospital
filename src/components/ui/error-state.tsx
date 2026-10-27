import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  errorCode?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Failed to load hospital data",
  message = "An error occurred while communicating with the integration gateway. Please verify your connection or retry.",
  errorCode,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50/40 p-8 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3 ring-4 ring-rose-50">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-rose-900">{title}</h3>
      <p className="mt-1 text-xs text-rose-700/80 max-w-md leading-relaxed">
        {message}
      </p>
      {errorCode && (
        <span className="mt-2 inline-block rounded bg-rose-100 px-2 py-0.5 font-mono text-[10px] text-rose-800 font-semibold">
          Error: {errorCode}
        </span>
      )}
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-1.5 text-xs border-rose-300 text-rose-800 hover:bg-rose-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry Operation</span>
          </Button>
        </div>
      )}
    </div>
  );
}
