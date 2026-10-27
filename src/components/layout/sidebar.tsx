"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PhoneCall,
  Activity,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Headphones,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_USER } from "@/lib/mock-data";

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const navItems = [
  {
    name: "Overview",
    href: "/overview",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: "Call History",
    href: "/calls",
    icon: PhoneCall,
    badge: "1,184",
  },
  {
    name: "AI Actions",
    href: "/actions",
    icon: Activity,
    badge: "9 alert",
    badgeVariant: "warning" as const,
  },
  {
    name: "Knowledge Base",
    href: "/knowledge-base",
    icon: BookOpen,
    badge: "5",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    badge: null,
  },
];

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className="flex h-16 items-center border-b border-slate-100 px-4 justify-between">
          <Link
            href="/overview"
            onClick={onCloseMobile}
            className="flex items-center gap-2 overflow-hidden"
          >
            <div className="relative h-9 w-auto min-w-[34px] flex items-center">
              <Image
                src="/logo.png"
                alt="Daya General Hospital"
                width={165}
                height={30}
                priority
                className={cn(
                  "object-contain transition-all duration-200",
                  collapsed && !mobileOpen ? "w-8 object-left" : "w-[165px]"
                )}
              />
            </div>
          </Link>

          {/* Desktop collapse toggle */}
          {onToggleCollapse && !mobileOpen && (
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors hidden md:flex cursor-pointer"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Mobile close button */}
          {mobileOpen && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors md:hidden cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Hospital AI Assistant Badge */}
        <div className="px-3 pt-3">
          <div
            className={cn(
              "flex items-center rounded-lg bg-[#EAF7F6] border border-[#18A99D]/20 text-[#0E7A71] p-2 text-xs",
              collapsed && !mobileOpen ? "justify-center" : "gap-2"
            )}
          >
            <Headphones className="h-4 w-4 shrink-0 text-[#18A99D]" />
            {(!collapsed || mobileOpen) && (
              <div className="truncate">
                <p className="font-semibold leading-tight text-[#0E7A71]">
                  Sarvam AI Calling
                </p>
                <p className="text-[11px] text-[#128278] truncate">
                  Malayalam Voice Engine
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              item.href === "/overview"
                ? pathname === "/" || pathname === "/overview"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onCloseMobile}
                title={collapsed && !mobileOpen ? item.name : undefined}
                className={cn(
                  "group flex items-center rounded-lg px-3 py-2.5 text-xs font-medium transition-colors relative cursor-pointer",
                  isActive
                    ? "bg-[#0C5DB8] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  collapsed && !mobileOpen && "justify-center px-2"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                    isActive ? "text-white" : "text-slate-500",
                    (!collapsed || mobileOpen) && "mr-3"
                  )}
                />

                {(!collapsed || mobileOpen) && (
                  <span className="flex-1 truncate">{item.name}</span>
                )}

                {(!collapsed || mobileOpen) && item.badge && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      isActive
                        ? "bg-white/20 text-white"
                        : item.badgeVariant === "warning"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Active Indicator Bar on collapsed view */}
                {collapsed && !mobileOpen && isActive && (
                  <div className="absolute right-0 h-6 w-1 rounded-l-md bg-[#0C5DB8]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile & Role Section */}
      <div className="border-t border-slate-100 p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50",
            collapsed && !mobileOpen && "justify-center p-1"
          )}
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0C5DB8] text-xs font-semibold text-white ring-2 ring-[#0C5DB8]/20">
            {MOCK_USER.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>

          {(!collapsed || mobileOpen) && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="truncate text-xs font-semibold text-slate-900">
                  {MOCK_USER.name}
                </p>
                <ShieldCheck className="h-3.5 w-3.5 text-[#0C5DB8] shrink-0" />
              </div>
              <p className="truncate text-[11px] text-slate-500">
                Hospital Administrator
              </p>
            </div>
          )}

          {(!collapsed || mobileOpen) && (
            <button
              title="Logout"
              onClick={() => alert("Session logged out safely.")}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out select-none z-30 shrink-0",
          collapsed ? "w-18" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative flex flex-col w-72 bg-white shadow-2xl z-50">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
