import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[#E8F2FC] text-[#0C5DB8] ring-[#0C5DB8]/20",
        secondary:
          "bg-[#F1F5F9] text-[#475569] ring-[#CBD5E1]/60",
        outline:
          "bg-white text-[#334155] ring-[#CBD5E1]",
        teal:
          "bg-[#EAF7F6] text-[#0E7A71] ring-[#18A99D]/25 font-semibold",
        success:
          "bg-emerald-50 text-emerald-700 ring-emerald-600/20 font-semibold",
        warning:
          "bg-amber-50 text-amber-700 ring-amber-600/25 font-semibold",
        danger:
          "bg-rose-50 text-rose-700 ring-rose-600/20 font-semibold",
        info:
          "bg-sky-50 text-sky-700 ring-sky-600/20 font-semibold",
        urgent:
          "bg-red-100 text-red-800 ring-red-600/30 animate-pulse font-bold",
      },
      size: {
        default: "text-xs px-2 py-0.5",
        sm: "text-[11px] px-1.5 py-0.2",
        lg: "text-xs px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
