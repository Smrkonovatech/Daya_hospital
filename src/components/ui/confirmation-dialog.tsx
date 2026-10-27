"use client";

import * as React from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmationDialogProps) {
  const Icon = variant === "danger" ? AlertTriangle : HelpCircle;
  const iconStyles = {
    danger: "bg-rose-100 text-rose-600",
    warning: "bg-amber-100 text-amber-600",
    default: "bg-[#E8F2FC] text-[#0C5DB8]",
  }[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="space-y-4 text-xs">
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 shrink-0 ${iconStyles}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">
              {title}
            </h3>
            <p className="text-slate-500 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className={variant === "default" ? "bg-[#0C5DB8]" : ""}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
