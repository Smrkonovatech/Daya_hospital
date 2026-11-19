"use client";

/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * SMRKOMED dashboard chrome (Figma: SMRKOMED-Dashboard / Desktop - 8, node 2072:3755).
 * White top bar (47px) + scaled 1440x698 design canvas + dark bottom dock (55px).
 */

export const SMRK_FONT = "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif";
const SEGOE = '"Segoe UI", var(--font-inter), Inter, system-ui, sans-serif';

export const CANVAS_WIDTH = 1440;
export const CANVAS_HEIGHT = 698;

const NAV_ITEMS = [
  { label: "Dashboard", icon: "/smrkomed/nav-dashboard.svg", href: "/overview" },
  { label: "Patient Care", icon: "/smrkomed/nav-patient-care.svg", href: "/calls" },
  { label: "Clinical", icon: "/smrkomed/nav-clinical.svg", href: "/actions" },
  { label: "Operations", icon: "/smrkomed/nav-operations.svg", href: "/actions?view=operations" },
  { label: "Communication", icon: "/smrkomed/nav-communication.svg", href: "/calls?view=communication" },
  { label: "Intelligence", icon: "/smrkomed/nav-intelligence.svg", href: "/knowledge-base" },
  { label: "Settings", icon: "/smrkomed/nav-settings.svg", href: "/settings" },
];

function formatRole(role?: string) {
  if (!role) return "DOCTOR";
  return role.replace(/_/g, " ").toUpperCase();
}

export function SmrkTopBar() {
  const { user } = useAuth();
  const [query, setQuery] = React.useState("");

  return (
    <header
      className="relative z-30 flex h-[47px] w-full shrink-0 items-center bg-white px-[50px]"
      style={{ fontFamily: SMRK_FONT }}
    >
      {/* Daya logo */}
      <Link href="/overview" aria-label="Daya Hospital home" className="relative h-[33px] w-[91px] shrink-0 overflow-hidden">
        <img
          alt="Daya Hospital"
          src="/smrkomed/daya-logo.png"
          className="absolute left-[-10.12%] top-[-39.09%] h-[219.87%] w-[120.48%] max-w-none"
        />
      </Link>

      <div className="flex-1" />

      {/* Search */}
      <label className="relative flex h-[31px] w-[376px] shrink-0 items-center gap-[10px] rounded-[53px] pl-[19px] pr-4">
        <span className="absolute inset-0 rounded-[53px] bg-[#ede8ff] opacity-[0.32]" />
        <span className="relative size-[10px] shrink-0">
          <img alt="" src="/smrkomed/icon-search.svg" className="absolute inset-[-5%] block size-[110%] max-w-none" />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patients, appointments, reports.."
          className="relative w-full bg-transparent text-[12px] text-[#2e293e] outline-none placeholder:text-[#838383]"
        />
      </label>

      {/* Hospital selector */}
      <button
        type="button"
        className="ml-[15px] flex h-8 min-h-8 shrink-0 items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-3"
      >
        <img alt="" src="/smrkomed/icon-hospital.svg" className="size-4" />
        <span className="w-[150px] truncate text-left text-[12px] font-medium leading-4 text-[#7b4fe0]">
          HOSPEX Heath E... Kochi
        </span>
        <img alt="" src="/smrkomed/icon-chevron-down.svg" className="size-4" />
      </button>

      {/* Quick actions */}
      <button
        type="button"
        className="ml-[28px] flex h-[31.76px] w-[154px] shrink-0 items-center justify-center gap-[6px] rounded-[19.14px] bg-[#866be3] text-[10.74px] leading-[13.6px] text-white transition-colors hover:bg-[#7559d6]"
      >
        <span className="relative size-[11.25px]">
          <span className="absolute left-1/2 top-0 h-full w-[0.87px] -translate-x-1/2 rounded-[1.93px] bg-white" />
          <span className="absolute left-0 top-1/2 h-[0.76px] w-full -translate-y-1/2 rounded-[1.93px] bg-white" />
        </span>
        Quick actions
      </button>

      {/* Chat / notifications */}
      <button type="button" aria-label="Messages, 2 unread" className="relative ml-[19px] h-[31.4px] w-[28.55px] shrink-0">
        <img alt="" src="/smrkomed/chat-circle.svg" className="absolute bottom-0 left-0 size-[26.65px]" />
        <img alt="" src="/smrkomed/chat-icon.svg" className="absolute left-[7.61px] top-[13.32px] size-[11.42px]" />
        <img alt="" src="/smrkomed/chat-badge.svg" className="absolute right-0 top-0 size-[11.42px]" />
        <span className="absolute right-[3.8px] top-[1.9px] w-[3.8px] text-center text-[4.74px] font-medium leading-[6px] text-white">
          2
        </span>
      </button>

      {/* Avatar + name */}
      <div className="ml-[9.5px] flex shrink-0 items-center gap-[5.1px]">
        <div className="relative size-[26.65px] overflow-hidden rounded-full">
          <img
            alt=""
            src={user?.avatarUrl || "/smrkomed/avatar-photo.png"}
            className="absolute left-[-13.32px] top-[-1.9px] h-[83.5px] w-[47.72px] max-w-none object-cover"
          />
        </div>
        <div className="flex min-w-[60.4px] max-w-[140px] flex-col">
          <span className="truncate text-[11.75px] font-semibold leading-[14.68px] text-[#1f1830]">
            {user?.name ?? "Meera Iyer"}
          </span>
          <span className="truncate text-[9.23px] leading-[13.84px] text-[#6d6680]">{formatRole(user ? user.role : undefined)}</span>
        </div>
      </div>
    </header>
  );
}

export function SmrkBottomDock() {
  const pathname = usePathname();
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : "--:--";
  const date = now
    ? now
        .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" })
        .replace(/\//g, "-")
    : "";

  return (
    <footer
      className="relative z-30 grid h-[55px] w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center bg-[#1a1a1a] px-[50px]"
      style={{ fontFamily: SEGOE }}
    >
      {/* SMRKOMED logo */}
      <div className="flex items-center gap-[9.5px] pl-px">
        <img alt="" src="/smrkomed/smrkomed-mark.svg" className="h-[19.84px] w-[33.54px]" />
        <img alt="SMRKOMED" src="/smrkomed/smrkomed-wordmark.svg" className="mt-px h-[9.93px] w-[113.13px]" />
      </div>

      {/* Nav */}
      <nav aria-label="Primary" className="flex h-[54px] items-center justify-center gap-[12.375px]">
        {NAV_ITEMS.map((item) => {
          const base = item.href.split("?")[0];
          const active =
            item.label === "Dashboard"
              ? pathname === "/overview" || pathname === "/"
              : !item.href.includes("?") && pathname.startsWith(base);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-[63.64px] flex-col items-center justify-center gap-[1.77px] rounded-[12.375px] px-[8.84px] py-[3.54px] transition-colors ${
                active ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <img alt="" src={item.icon} className="size-[17.68px]" />
              <span
                className={`whitespace-nowrap text-center text-[8.84px] font-semibold leading-[13.26px] tracking-[-0.1174px] ${
                  active ? "text-[#f5a524]" : "text-white/72"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Notifications + clock */}
      <div className="flex items-center justify-end gap-[7.85px]">
        <button
          type="button"
          aria-label="Notifications, 8 unread"
          className="relative flex h-[31.4px] items-center rounded-[13.74px] px-[7.85px]"
        >
          <img alt="" src="/smrkomed/nav-bell.svg" className="size-[15.7px]" />
          <span className="absolute left-[17.66px] top-[6.21px] size-[5.89px] rounded-full bg-[#f5a524] shadow-[0_0_0_1.963px_#1a1a1a]" />
        </button>
        <div className="flex flex-col items-end text-right text-[11.775px] leading-[15.7px] text-white/75" suppressHydrationWarning>
          <span className="font-semibold">{time}</span>
          <span>{date}</span>
        </div>
      </div>
    </footer>
  );
}

/** Extra design-px width available beyond 1440 when the screen is wider than the design's aspect ratio. */
const CanvasExtraContext = React.createContext(0);

/**
 * Places a group of absolutely-positioned design elements, shifted right by a fraction
 * of the spare width so the layout spreads edge-to-edge on wide screens (no distortion).
 */
export function CanvasGroup({ spread, children }: { spread: number; children: React.ReactNode }) {
  const extra = React.useContext(CanvasExtraContext);
  return (
    <div className="absolute top-0 h-0 w-0" style={{ left: extra * spread }}>
      {children}
    </div>
  );
}

/**
 * Scales the 1440x698 design canvas to the available height (or width on narrow screens),
 * and widens the canvas to fill any leftover horizontal space.
 */
export function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [{ scale, extra }, setFit] = React.useState({ scale: 1, extra: 0 });

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const s = Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
      setFit({ scale: s, extra: Math.max(0, width / s - CANVAS_WIDTH) });
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
      <div style={{ width: (CANVAS_WIDTH + extra) * scale, height: CANVAS_HEIGHT * scale }} className="relative shrink-0">
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: CANVAS_WIDTH + extra,
            height: CANVAS_HEIGHT,
            transform: `scale(${scale})`,
            fontFamily: SMRK_FONT,
          }}
        >
          <CanvasExtraContext.Provider value={extra}>{children}</CanvasExtraContext.Provider>
        </div>
      </div>
    </div>
  );
}

export function SmrkomedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#fffffb]">
      <SmrkTopBar />
      <ScaledCanvas>{children}</ScaledCanvas>
      <SmrkBottomDock />
    </div>
  );
}
