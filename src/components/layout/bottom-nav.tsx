"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PhoneCall,
  Activity,
  BookOpen,
  Bot,
  Settings,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string | number | null;
  badgeVariant?: "default" | "warning";
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    shortLabel: "Overview",
    icon: LayoutDashboard,
    href: "/overview",
  },
  {
    label: "Call History",
    shortLabel: "Calls",
    icon: PhoneCall,
    href: "/calls",
    badge: "1.2k",
  },
  {
    label: "AI Actions",
    shortLabel: "Actions",
    icon: Activity,
    href: "/actions",
    badge: "9",
    badgeVariant: "warning",
  },
  {
    label: "AI Voice Agents",
    shortLabel: "Agents",
    icon: Bot,
    href: "/agents",
  },
  {
    label: "Knowledge Base",
    shortLabel: "Knowledge",
    icon: BookOpen,
    href: "/knowledge-base",
  },
  {
    label: "Settings",
    shortLabel: "Settings",
    icon: Settings,
    href: "/settings",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const timeString = now
    ? now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    })
    : "--:--";

  const dateString = now
    ? now
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
      .replace(/\//g, "-")
    : "";

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 md:h-[56px] w-full items-center justify-between border-t border-slate-800 bg-[#161618] px-3 sm:px-6 shadow-[0_-4px_16px_rgba(0,0,0,0.3)] backdrop-blur-md"
    >
      {/* Left Brand Mark (Figma SMRKOMED / Daya) */}
      <div className="hidden lg:flex items-center gap-2.5 min-w-[140px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/smrkomed/smrkomed-mark.svg"
          alt=""
          className="h-5 w-auto"
          aria-hidden="true"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/smrkomed/smrkomed-wordmark.svg"
          alt="SMRKOMED"
          className="h-2.5 w-auto opacity-80"
        />
      </div>

      {/* Center 5 Navigation Items */}
      <div className="flex flex-1 items-center justify-around sm:justify-center sm:gap-2 md:gap-3 max-w-2xl mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/overview"
              ? pathname === "/overview" || pathname === "/"
              : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex flex-col items-center justify-center rounded-xl px-2.5 sm:px-3.5 py-1 transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-white/12 text-[#f5a524]"
                  : "text-slate-400 hover:bg-white/6 hover:text-slate-200"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "h-4 w-4 md:h-[18px] md:w-[18px] transition-transform duration-150 group-hover:scale-105",
                    isActive ? "text-[#f5a524]" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                {item.badge && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white",
                      item.badgeVariant === "warning" ? "bg-amber-500" : "bg-[#0C5DB8]"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "mt-0.5 text-[10px] md:text-[11px] font-medium tracking-tight",
                  isActive
                    ? "text-[#f5a524] font-semibold"
                    : "text-slate-400 group-hover:text-slate-200"
                )}
              >
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Right Notifications & IST Clock */}
      <div className="hidden sm:flex items-center justify-end gap-3 min-w-[140px]">
        <Link
          href="/actions?view=follow-up"
          title="Requires Staff Attention"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#f5a524] ring-2 ring-[#161618]" />
        </Link>

        <div
          className="flex flex-col items-end text-right text-[11px] leading-tight text-slate-300 font-mono"
          suppressHydrationWarning
        >
          <span className="font-semibold text-white tracking-wide">{timeString} IST</span>
          <span className="text-[10px] text-slate-400">{dateString}</span>
        </div>
      </div>
    </nav>
  );
}