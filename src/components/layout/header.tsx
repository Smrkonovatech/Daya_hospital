"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bell,
  RefreshCw,
  Database,
  Headphones,
  PhoneCall,
  AlertTriangle,
  UserCheck,
  ChevronDown,
  LogOut,
  SlidersHorizontal,
  PhoneMissed,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onRefresh?: () => void;
}

export function Header({ onRefresh }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = React.useState(false);

  const quickActionsRef = React.useRef<HTMLDivElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const alertsRef = React.useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
        setIsQuickActionsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setIsAlertsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/90 bg-white/95 shadow-2xs backdrop-blur-xs">
      <div className="flex h-[58px] w-full items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4 flex-nowrap">
        {/* ================================================================= */}
        {/* LEFT: DAYA HOSPITAL LOGO ONLY (NO DUPLICATED TEXT OR SUBTITLES)  */}
        {/* ================================================================= */}
        <div className="flex items-center shrink-0">
          <Link
            href="/overview"
            aria-label="Daya Hospital Home"
            className="flex items-center transition-opacity hover:opacity-90"
          >
            <div className="relative h-8 w-auto min-w-[36px] sm:min-w-[120px] flex items-center">
              <Image
                src="/logo.png"
                alt="Daya General Hospital"
                width={132}
                height={32}
                priority
                className="object-contain h-8 w-auto"
              />
            </div>
          </Link>
        </div>

        {/* ================================================================= */}
        {/* CENTRE: THREE COMPACT INTEGRATION INDICATORS                      */}
        {/* ================================================================= */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Indicator 1: Smrko Voice */}
          <div
            className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2 sm:px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs hover:border-slate-300 transition-colors cursor-default"
            title="Smrko Voice: Connected • Latency: 240ms • Malayalam Voice Engine • Last Health Check: Verified"
          >
            <Headphones className="h-3.5 w-3.5 text-[#0C5DB8] shrink-0" />
            <span className="font-semibold text-slate-800 text-[11px] whitespace-nowrap">
              Smrko Voice
            </span>
            <span
              className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
              aria-label="Connected"
            />
          </div>

          {/* Indicator 2: Daya HMS */}
          <div
            className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2 sm:px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs hover:border-slate-300 transition-colors cursor-default"
            title="Daya HMS: Connected • OPD Slot Sync Verified • Protocol: HTTPS REST • Status: Active"
          >
            <Database className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-800 text-[11px] whitespace-nowrap">
              Daya HMS
            </span>
            <span
              className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
              aria-label="Connected"
            />
          </div>

          {/* Indicator 3: IVR Gateway */}
          <div
            className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2 sm:px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs hover:border-slate-300 transition-colors cursor-default"
            title="Hospital IVR Trunk: Connected • 18/30 Active Lines • SIP Rollover Operational"
          >
            <PhoneCall className="h-3.5 w-3.5 text-sky-600 shrink-0" />
            <span className="font-semibold text-slate-800 text-[11px] whitespace-nowrap">
              IVR
            </span>
            <span
              className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
              aria-label="Connected"
            />
            <span className="text-[10px] text-slate-500 font-mono font-semibold ml-0.5 whitespace-nowrap">
              18/30
            </span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT: QUICK ACTIONS, REFRESH, NOTIFICATIONS, AVATAR              */}
        {/* ================================================================= */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* AI Quick Actions Dropdown */}
          <div className="relative" ref={quickActionsRef}>
            <button
              type="button"
              onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 sm:px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              title="Quick Actions"
            >
              <SlidersHorizontal className="h-3 w-3 text-[#0C5DB8]" />
              <span className="hidden md:inline">Quick Actions</span>
              <ChevronDown className="h-2.5 w-2.5 text-slate-400" />
            </button>

            {isQuickActionsOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  AI Operations
                </div>

                <Link
                  href="/actions?status=FAILED"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-red-50 hover:text-red-700 transition-colors"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-xs">View Failed Actions</div>
                    <div className="text-[10px] text-slate-500">Actions rejected or rolled back</div>
                  </div>
                </Link>

                <Link
                  href="/actions?view=follow-up"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                >
                  <UserCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-xs">Open Staff Follow-up Queue</div>
                    <div className="text-[10px] text-slate-500">Pending clinical review</div>
                  </div>
                </Link>

                <Link
                  href="/calls?status=TRANSFERRED"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                >
                  <PhoneMissed className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-xs">Review Missed Calls</div>
                    <div className="text-[10px] text-slate-500">Rollover calls from IVR</div>
                  </div>
                </Link>

                <Link
                  href="/settings?tab=status"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-xs">View Integration Status</div>
                    <div className="text-[10px] text-slate-500">Voice AI, HMS & IVR health</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Refresh Action */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleRefresh}
            title="Refresh operational data"
            className="h-7 w-7 text-slate-600 hover:text-[#0C5DB8]"
          >
            <RefreshCw
              className={cn("h-3 w-3", isRefreshing && "animate-spin text-[#0C5DB8]")}
            />
          </Button>

          {/* Notifications Icon (AI calling alerts only) */}
          <div className="relative" ref={alertsRef}>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setIsAlertsOpen(!isAlertsOpen)}
              className="h-7 w-7 text-slate-600 relative hover:text-slate-900"
              title="AI Calling Alerts (3 unread)"
            >
              <Bell className="h-3 w-3" />
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                3
              </span>
            </Button>

            {isAlertsOpen && (
              <div className="absolute right-0 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-50 text-xs">
                <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                  <span className="font-bold text-slate-800 text-xs">AI Calling Alerts</span>
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[9px] font-semibold text-amber-800">
                    3 Pending
                  </span>
                </div>

                <div className="py-1 space-y-1">
                  <Link
                    href="/calls?intent=EMERGENCY_AMBULANCE"
                    onClick={() => setIsAlertsOpen(false)}
                    className="block rounded-lg p-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-rose-700 text-xs">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>Casualty Transfer Logged</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      Trauma call routed to 24/7 casualty desk (+91 94471 •••••)
                    </p>
                    <span className="text-[9px] text-slate-400">4 mins ago</span>
                  </Link>

                  <Link
                    href="/actions?view=follow-up"
                    onClick={() => setIsAlertsOpen(false)}
                    className="block rounded-lg p-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-amber-700 text-xs">
                      <UserCheck className="h-3 w-3 shrink-0" />
                      <span>Cardiology Slot Follow-up</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      HMS verification pending for Dr. George. Patient awaiting SMS.
                    </p>
                    <span className="text-[9px] text-slate-400">18 mins ago</span>
                  </Link>

                  <Link
                    href="/settings?tab=status"
                    onClick={() => setIsAlertsOpen(false)}
                    className="block rounded-lg p-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-700 text-xs">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      <span>Knowledge Base Grounding</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      12 approved OPD timetables live on Smrko Voice.
                    </p>
                    <span className="text-[9px] text-slate-400">1 hour ago</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Simple Account Icon / Logout Control */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0C5DB8] text-white text-[11px] font-bold shadow-2xs hover:bg-[#0A4D98] transition-colors cursor-pointer"
              aria-label="User Account"
            >
              {(user?.name || "Operations")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50 text-xs">
                <div className="px-2.5 py-1.5 border-b border-slate-100">
                  <div className="font-bold text-slate-900 truncate text-xs">
                    {user?.name || "Operations Lead"}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {user?.email || "ops@dayahospital.com"}
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings?tab=profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block rounded-lg px-2.5 py-1 text-slate-700 hover:bg-slate-50 text-[11px]"
                  >
                    My Profile
                  </Link>
                  <Link
                    href="/settings?tab=privacy"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block rounded-lg px-2.5 py-1 text-slate-700 hover:bg-slate-50 text-[11px]"
                  >
                    Recording Policy
                  </Link>
                  <Link
                    href="/settings?tab=status"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block rounded-lg px-2.5 py-1 text-slate-700 hover:bg-slate-50 text-[11px]"
                  >
                    Integration Status
                  </Link>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-rose-600 hover:bg-rose-50 font-medium transition-colors cursor-pointer text-left text-[11px]"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
