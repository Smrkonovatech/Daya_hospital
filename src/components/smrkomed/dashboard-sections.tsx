"use client";

/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import Link from "next/link";
import { CanvasGroup } from "./smrkomed-shell";

/**
 * SMRKOMED Dashboard sections — ported from Figma "Desktop - 8" (node 2072:3755).
 * All coordinates are on the 1440x698 canvas (Figma y minus the 47px top bar).
 */

const A = (name: string) => `/smrkomed/${name}`;
const TILE_BG = "linear-gradient(107.18deg, rgba(199,135,255,0.1) 0%, rgba(149,120,255,0.1) 102.48%)";
const MINI_BG = "linear-gradient(97.96deg, rgba(199,135,255,0.1) 0%, rgba(149,120,255,0.1) 102.48%)";
const fmt = (n: number) => String(n);

/* ------------------------------------------------------------------ */
/* Decorative background glows                                         */
/* ------------------------------------------------------------------ */

function RotatedGlow({
  src,
  left,
  top,
  boxW,
  boxH,
  rotate,
  innerW,
  innerH,
  inset,
}: {
  src: string;
  left: number | string;
  top: number;
  boxW: number;
  boxH: number;
  rotate: number;
  innerW: number;
  innerH: number;
  inset: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute flex items-center justify-center"
      style={{ left, top, width: boxW, height: boxH }}
    >
      <div className="flex-none" style={{ transform: `rotate(${rotate}deg)` }}>
        <div className="relative" style={{ width: innerW, height: innerH }}>
          <div className="absolute" style={{ inset }}>
            <img alt="" src={src} className="block size-full max-w-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BackgroundGlows() {
  return (
    <>
      <RotatedGlow src={A("bg-ellipse-left.svg")} left={-185} top={-246} boxW={713.2} boxH={334.81} rotate={86.34} innerW={291.014} innerH={696.059} inset="-16.42% -39.28%" />
      <CanvasGroup spread={0.5}>
      <RotatedGlow src={A("bg-ellipse-top.svg")} left={625} top={-178} boxW={510.97} boxH={359.05} rotate={66.11} innerW={180.556} innerH={478.874} inset="-55.42% -146.99%" />
      <RotatedGlow src={A("bg-ellipse-bottom.svg")} left={561.9} top={594.2} boxW={507.69} boxH={321.68} rotate={86.34} innerW={291.014} innerH={490.13} inset="-23.32% -39.28%" />
      </CanvasGroup>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Left KPI tiles                                                      */
/* ------------------------------------------------------------------ */

type Spark = {
  variant: "up" | "down";
  /** sparkline box (local coords) */
  x: number;
  y: number;
  h: number;
  start: [number, number];
  end: [number, number];
};

export interface KpiTileProps {
  label: React.ReactNode;
  value: number;
  delta: string;
  top: number;
  deltaTop: number;
  spark: Spark;
  href?: string;
}

export function KpiTile({ label, value, delta, top, deltaTop, spark, href }: KpiTileProps) {
  const body = (
    <>
      <img alt="" src={A("kpi-icon-circle.svg")} className="absolute left-4 top-[11px] size-7" />
      <p className="absolute left-[50px] top-[13px] w-[67px] text-[10px] leading-3 text-[#866ce3]">{label}</p>
      <p className="absolute left-4 top-[67.5px] -translate-y-1/2 text-[36px] leading-none text-[#483660]">{fmt(value)}</p>

      {spark.variant === "up" ? (
        <div className="absolute" style={{ left: spark.x, top: spark.y, width: 79, height: spark.h }}>
          <div className="absolute inset-[-0.8%_-0.43%_-0.64%_-0.51%]">
            <img alt="" src={A("spark-up.svg")} className="block size-full max-w-none" />
          </div>
        </div>
      ) : (
        <div className="absolute -scale-y-100" style={{ left: spark.x, top: spark.y, width: 79, height: spark.h }}>
          <div className="absolute inset-[-1.88%_-0.27%_-1.69%_-0.37%]">
            <img alt="" src={A("spark-down.svg")} className="block size-full max-w-none" />
          </div>
        </div>
      )}
      <img alt="" src={A("spark-dot.svg")} className="absolute size-[6px]" style={{ left: spark.start[0], top: spark.start[1] }} />
      <img alt="" src={A("spark-dot.svg")} className="absolute size-[6px]" style={{ left: spark.end[0], top: spark.end[1] }} />

      <p className="absolute right-4 w-[79px] text-right text-[8px] leading-3 text-[#2ec16b]" style={{ top: deltaTop }}>
        {delta}
      </p>
    </>
  );

  const cls = "absolute left-[50px] block h-[93px] w-[215px] rounded-[9px] transition-shadow hover:shadow-[0_4px_18px_rgba(134,107,227,0.18)]";
  return href ? (
    <Link href={href} className={cls} style={{ top, backgroundImage: TILE_BG }}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={{ top, backgroundImage: TILE_BG }}>
      {body}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: title, call ring, illustration, status pills                  */
/* ------------------------------------------------------------------ */

function Trend({ dir, value, color, x, y, arrowX, arrowY, arrow }: {
  dir: "up" | "down";
  value: string;
  color: string;
  x: number;
  y: number;
  arrowX: number;
  arrowY: number;
  arrow: string;
}) {
  return (
    <>
      <p className="absolute text-[10.606px] font-light leading-[13.257px] tracking-[-0.1174px]" style={{ left: x, top: y, color }}>
        {value}
      </p>
      <img
        alt=""
        src={A(arrow)}
        className={`absolute h-[8.838px] w-[6.187px] ${dir === "down" ? "-scale-y-100" : ""}`}
        style={{ left: arrowX, top: arrowY }}
      />
    </>
  );
}

export interface HeroRingProps {
  total: number;
  completed: number;
  transferred: number;
  dropped: number;
  completedPct: number;
  transferredPct: number;
  droppedPct: number;
  totalDeltaPct: number;
}

/** Ring group. Local origin = Figma (382, 122). */
export function HeroRing({
  total,
  completed,
  transferred,
  dropped,
  completedPct,
  transferredPct,
  droppedPct,
  totalDeltaPct,
}: HeroRingProps) {
  return (
    <div className="absolute left-[382px] top-[75px] h-[380px] w-[530px]">
      {/* Glass donut */}
      <div className="absolute left-[63.47px] top-[0.43px] flex h-[378.567px] w-[393.974px] items-center justify-center">
        <div className="flex-none rotate-90 -scale-y-100">
          <div className="relative h-[393.974px] w-[378.567px]">
            <div className="absolute inset-[-14.75%_-15.35%]">
              <img alt="" src={A("ring-donut.svg")} className="block size-full max-w-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Progress arcs */}
      <div className="absolute left-[318.5px] top-[69px] h-[24.746px] w-[38.003px]">
        <div className="absolute inset-[-8.93%_-5.81%_-8.93%_-5.82%]">
          <img alt="" src={A("ring-arc-small.svg")} className="block size-full max-w-none" />
        </div>
      </div>
      <div className="absolute left-[356.5px] top-[93.75px] h-[89.264px] w-[38.003px]">
        <div className="absolute inset-[-6.93%_-16.28%]">
          <img alt="" src={A("ring-arc-right.svg")} className="block size-full max-w-none" />
        </div>
      </div>
      <div className="absolute left-[125.83px] top-[53.98px] size-[267.792px]">
        <div className="absolute inset-[-5.12%]">
          <img alt="" src={A("ring-arc-main.svg")} className="block size-full max-w-none" />
        </div>
      </div>

      {/* Total */}
      <p className="absolute left-[258.8px] top-[80.49px] h-[156.43px] w-[163.5px] -translate-x-1/2 text-center text-[56.563px] leading-[185.642px] text-[#483660]">
        {fmt(total)}
      </p>
      <p className="absolute left-[240.2px] top-[213.06px] w-[89.264px] -translate-x-1/2 text-center text-[8.838px] leading-[12.373px] text-[#848486]">
        Total Calls Received
      </p>
      <Trend dir="up" value={`${totalDeltaPct}%`} color="#2ec16b" x={291.1} y={212.18} arrowX={313.2} arrowY={213.95} arrow="arrow-up-12.svg" />

      {/* Completed by AI */}
      <p className="absolute left-[55px] top-[80.96px] w-[55.08px] -translate-x-full text-right text-[10px] leading-[12.373px] text-[#2e293e]">
        Completed by AI
      </p>
      <Trend dir="up" value={`${completedPct}%`} color="#2ec16b" x={27.07} y={109.99} arrowX={49.48} arrowY={111.77} arrow="arrow-up-34.svg" />
      <img alt="" src={A("bubble-completed.svg")} className="absolute left-[62.06px] top-[81.62px] size-[42.488px]" />
      <p className="absolute left-[83.3px] top-[81.62px] flex h-[42.488px] -translate-x-1/2 items-center text-[11.489px] text-white">
        {fmt(completed)}
      </p>

      {/* Dropped / Busy */}
      <p className="absolute left-[400.4px] top-[11.67px] w-[46.68px] text-[10px] leading-[12.373px] text-[#2e293e]">Dropped Busy</p>
      <Trend dir="down" value={`${droppedPct}%`} color="#ea9022" x={400.4} y={37.06} arrowX={419} arrowY={39.71} arrow="arrow-down-6.svg" />
      <img alt="" src={A("bubble-dropped.svg")} className="absolute left-[363px] top-[17.48px] size-[31.404px]" />
      <p className="absolute left-[378.7px] top-[17.48px] flex h-[31.404px] -translate-x-1/2 items-center text-[11.489px] text-white">
        {fmt(dropped)}
      </p>

      {/* Transferred to staff */}
      <p className="absolute left-[470px] top-[101px] w-[59px] text-[10px] leading-[12.373px] text-[#2e293e]">Transferred to staff</p>
      <Trend dir="down" value={`${transferredPct}%`} color="#2ec16b" x={470.2} y={128.23} arrowX={487.9} arrowY={129.86} arrow="arrow-down-5.svg" />
      <img alt="" src={A("bubble-transferred.svg")} className="absolute left-[424.77px] top-[102.17px] size-[31.404px]" />
      <p className="absolute left-[440.47px] top-[102.17px] flex h-[31.404px] -translate-x-1/2 items-center text-[11.489px] text-white">
        {fmt(transferred)}
      </p>
    </div>
  );
}

export function HeroTitle() {
  return (
    <div className="absolute left-[293px] top-[37px] w-[240px] font-semibold text-[#2e293e]">
      <p className="text-[20px] leading-[25px]">Daya Hospital</p>
      <p className="text-[16px] leading-[25px]">AI Calling operations</p>
    </div>
  );
}

export function AssistantIllustration() {
  return (
    <picture>
      <source srcSet={A("hero-illustration.webp")} type="image/webp" />
      <img
        alt=""
        src={A("hero-illustration.png")}
        decoding="async"
        className="pointer-events-none absolute left-[276px] top-[229px] z-[1] h-[223px] w-[297px] max-w-none object-cover"
      />
    </picture>
  );
}

const RANGES = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days"];

export function StatusPills({ range, onRangeChange, aiActive = true }: { range: string; onRangeChange: (r: string) => void; aiActive?: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="absolute left-[829px] top-[39px] flex h-[33px] w-[101px] items-center justify-center gap-2 rounded-[16.5px] bg-white/46">
        <img alt="" src={A("dot-green.svg")} className={`size-2 ${aiActive ? "" : "grayscale"}`} />
        <span className="text-[12px] capitalize leading-[15px] tracking-[-0.1328px] text-black">{aiActive ? "AI Active" : "AI Paused"}</span>
      </div>

      <div className="absolute left-[938px] top-[39px] z-20">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-[33px] min-w-[106px] items-center gap-2 rounded-[16.5px] bg-white/46 pl-[15px] pr-[24px]"
        >
          <img alt="" src={A("icon-calendar.svg")} className="h-[13px] w-[15px]" />
          <span className="whitespace-nowrap text-[12px] capitalize leading-[15px] tracking-[-0.1328px] text-black">{range}</span>
          <img alt="" src={A("pill-chevron.svg")} className="absolute right-[8.5px] top-[13.5px] h-[9px] w-[5.2px] rotate-90" />
        </button>
        {open && (
          <ul role="listbox" className="absolute right-0 top-[37px] w-[130px] overflow-hidden rounded-xl border border-[#ede8ff] bg-white py-1 shadow-[0_8px_24px_rgba(134,107,227,0.18)]">
            {RANGES.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  role="option"
                  aria-selected={r === range}
                  onClick={() => {
                    onRangeChange(r);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#f5f1ff] ${r === range ? "font-semibold text-[#866be3]" : "text-[#2e293e]"}`}
                >
                  {r}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Mini stat column                                                    */
/* ------------------------------------------------------------------ */

const PercentValue = ({ value }: { value: number }) => (
  <>
    <span className="text-[36px]">{value}</span>
    <span className="text-[16px]">%</span>
  </>
);

export function MiniStats({ appointmentsPct, growthPct, deltaVsYesterday, hourly }: {
  appointmentsPct: number;
  growthPct: number;
  deltaVsYesterday: number;
  hourly: number[];
}) {
  const max = Math.max(...hourly, 1);
  return (
    <>
      {/* Appointments */}
      <div className="absolute left-[927px] top-[90px] h-[110px] w-[116px] rounded-[9px]" style={{ backgroundImage: MINI_BG }}>
        <p className="absolute left-1/2 top-[11px] w-[56px] -translate-x-1/2 text-center text-[8px] leading-3 text-[#866ce3]">Appointments</p>
        <div className="absolute left-0 top-[16.19px] h-[58.815px] w-[115.615px]">
          <div className="absolute inset-[-0.42%_-0.38%_-0.21%_-0.42%]">
            <img alt="" src={A("mini-spark-12.svg")} className="block size-full max-w-none" />
          </div>
        </div>
        <img alt="" src={A("spark-dot.svg")} className="absolute left-[18px] top-[43px] size-[6px]" />
        <p className="absolute left-1/2 top-[79.5px] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center leading-none text-[#483660]">
          <PercentValue value={appointmentsPct} />
        </p>
      </div>

      {/* Growth vs yesterday */}
      <div className="absolute left-[927px] top-[209px] h-[111px] w-[116px] rounded-[9px]" style={{ backgroundImage: MINI_BG }}>
        <p className="absolute left-1/2 top-[9px] w-[56px] -translate-x-1/2 text-center text-[8px] leading-3 text-[#866ce3]">
          {fmt(deltaVsYesterday)} more than
          <br />
          Yesterday
        </p>
        <div className="absolute left-0 top-[44.83px] h-[31.17px] w-[116px]">
          <div className="absolute inset-[-1.6%_-0.13%_-1.59%_0]">
            <img alt="" src={A("mini-spark-40.svg")} className="block size-full max-w-none" />
          </div>
        </div>
        <img alt="" src={A("spark-dot.svg")} className="absolute left-[48px] top-[42px] size-[6px]" />
        <p className="absolute left-[29px] top-[85.5px] -translate-y-1/2 whitespace-nowrap leading-none text-[#483660]">
          <PercentValue value={growthPct} />
        </p>
      </div>

      {/* AI calls today */}
      <div className="absolute left-[927px] top-[330px] h-[111px] w-[116px] rounded-[9px]" style={{ backgroundImage: MINI_BG }}>
        <p className="absolute left-1/2 top-[10px] w-[66px] -translate-x-1/2 text-center text-[8px] leading-3 text-[#866ce3]">AI Calls Today</p>
        <div className="absolute bottom-[15px] left-[23px] flex items-end gap-[5px]">
          {hourly.map((v, i) => (
            <span
              key={i}
              className="w-[2px] rounded-[2px]"
              style={{
                height: Math.max(4, Math.round((v / max) * 61)),
                background: i === hourly.length - 1 ? "#866be3" : "rgba(134,107,227,0.5)",
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Right column: alert list + staff attention                          */
/* ------------------------------------------------------------------ */

export interface AlertItem {
  label: string;
  count: number;
  tone: "red" | "amber" | "green";
  href: string;
}

const ALERT_ROWS_TOP = [37.75, 77.75, 117.75, 160.75];

export function AlertList({ items }: { items: AlertItem[] }) {
  return (
    <>
      {items.slice(0, 4).map((item, i) => (
        <div
          key={item.label}
          className="absolute left-[1059px] flex h-[30px] w-[331px] items-center rounded-[14.384px] bg-white/7"
          style={{ top: ALERT_ROWS_TOP[i] }}
        >
          <span className="relative ml-[11px] flex size-[17.08px] items-center justify-center">
            <img alt="" src={A(`alert-dot-${item.tone}.svg`)} className="absolute inset-0 size-full" />
            <span className="relative text-[10.916px] leading-[12.735px] text-white">{item.count}</span>
          </span>
          <span className="ml-[11.9px] whitespace-nowrap text-[12.329px] leading-[14.384px] text-[#866be3]">{item.label}</span>
          <Link
            href={item.href}
            className="absolute left-[286.8px] text-[10.275px] leading-[14.384px] text-[#866be3] underline decoration-from-font underline-offset-auto hover:text-[#6c4fd1]"
          >
            View
          </Link>
        </div>
      ))}
    </>
  );
}

export interface StaffTask {
  time: string;
  patient: string;
  task: string;
  assignee: string;
  avatar: 1 | 2 | 3 | 4;
  href: string;
  /** Figma nudges the divider/task column right on rows with a long patient name. */
  shift?: number;
}

const AVATARS: Record<StaffTask["avatar"], { size: [number, number]; maskPos: string; maskSize: string; inset: string }> = {
  1: { size: [36, 37], maskPos: "0.812px 3.016px", maskSize: "33.177px 33.985px", inset: "0 0 0.32% 0" },
  2: { size: [37, 37], maskPos: "0.517px 1.637px", maskSize: "34.874px 34.874px", inset: "0" },
  3: { size: [38, 38], maskPos: "1.167px 1.021px", maskSize: "36.143px 36.143px", inset: "0" },
  4: { size: [41, 41], maskPos: "1.771px 2.113px", maskSize: "37.939px 37.939px", inset: "0" },
};

function StaffAvatar({ n }: { n: StaffTask["avatar"] }) {
  const a = AVATARS[n];
  return (
    <div className="relative shrink-0 overflow-clip" style={{ width: a.size[0], height: a.size[1] }}>
      <div
        className="absolute"
        style={{
          inset: a.inset,
          maskImage: `url("${A(`staff-${n}-mask.svg`)}")`,
          WebkitMaskImage: `url("${A(`staff-${n}-mask.svg`)}")`,
          maskMode: "alpha",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: a.maskPos,
          WebkitMaskPosition: a.maskPos,
          maskSize: a.maskSize,
          WebkitMaskSize: a.maskSize,
        }}
      >
        <img alt="" src={A(`staff-${n}.svg`)} className="absolute inset-0 block size-full max-w-none" />
      </div>
    </div>
  );
}

const STAFF_ROWS_TOP = [272, 367, 461, 556];

export function StaffAttention({ tasks }: { tasks: StaffTask[] }) {
  return (
    <div
      className="absolute left-[1059px] top-[212px] h-[458px] w-[331px] rounded-[14.024px]"
      style={{ backgroundImage: "linear-gradient(to bottom, rgba(210,198,255,0.27), rgba(144,115,255,0.62))" }}
    >
      <p className="absolute left-[81px] top-[15px] whitespace-nowrap text-[14px] font-semibold leading-[25px] text-[#2e293e]">
        Requires Staff Attention
      </p>

      {tasks.slice(0, 4).map((t, i) => (
        <div
          key={`${t.patient}-${i}`}
          className="absolute left-[21px] h-[87px] w-[278px] rounded-[9px] bg-white/50"
          style={{ top: STAFF_ROWS_TOP[i] - 212 }}
        >
          <p className="absolute left-[33px] top-[16px] whitespace-nowrap text-[12px] leading-[15px] text-[#7c7c7c]">{t.time}</p>
          <p className="absolute left-[18px] top-[36px] w-[92px] truncate text-[12px] font-medium leading-[15px] text-[#2e293e]">{t.patient}</p>
          <Link
            href={t.href}
            className="absolute left-[18px] top-[60px] text-[10px] font-medium leading-[15px] text-[#866be3] underline decoration-from-font hover:text-[#6c4fd1]"
          >
            Review
          </Link>

          <span className="absolute top-[17px] h-[55px] w-px rounded-[4px] bg-[#b8b0fa]" style={{ left: 102 + (t.shift ?? 0) }} />

          <p className="absolute top-[16px] w-[76px] text-[12px] font-medium leading-4 text-[#866be3]" style={{ left: 111 + (t.shift ?? 0) }}>{t.task}</p>
          <p className="absolute top-[59px] text-[10px] leading-[15px] text-[#2e293e]" style={{ left: 111 + (t.shift ?? 0) }}>Assigned to</p>

          <div className="absolute left-[193px] top-[17px] flex w-[66px] flex-col items-center gap-[2px]">
            <StaffAvatar n={t.avatar} />
            <p className="w-full text-center text-[12px] font-medium leading-[19px] text-[#2e293e]">{t.assignee}</p>
          </div>
        </div>
      ))}

      {/* Scroll indicator */}
      <span className="absolute left-[310px] top-[64px] h-[71px] w-[5px] rounded-[2.5px] bg-white/66" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom row cards                                                    */
/* ------------------------------------------------------------------ */

const Y_TICKS = [
  { v: "700", top: 38.56, right: 31.9 },
  { v: "600", top: 59.13, right: 29.86 },
  { v: "500", top: 79.69, right: 30.29 },
  { v: "400", top: 100.25, right: 30.29 },
  { v: "300", top: 120.82, right: 30.72 },
  { v: "200", top: 141.38, right: 30.72 },
  { v: "100", top: 161.94, right: 30.29 },
];
const X_TICKS = [
  { v: "08:00", x: 50.07 },
  { v: "10:00", x: 87.9 },
  { v: "12:00", x: 125.2 },
  { v: "14:00", x: 161.3 },
  { v: "16:00", x: 199.2 },
  { v: "18:00", x: 236.4 },
  { v: "20:00", x: 273.6 },
  { v: "22:00", x: 311 },
];

export function CallVolumeCard({ offered, completed }: { offered: number; completed: number }) {
  return (
    <Link
      href="/calls"
      className="absolute left-[52px] top-[451px] block h-[219px] w-[350px] overflow-hidden rounded-[14.024px]"
      style={{ backgroundImage: "linear-gradient(179.56deg, rgba(255,255,255,0.25) 48.05%, rgba(230,165,251,0.25) 112.92%)" }}
    >
      <p className="absolute left-1/2 top-[12px] -translate-x-1/2 whitespace-nowrap text-center text-[14px] font-semibold leading-[25px] text-[#2e293e]">
        Call Volume Trend
      </p>

      <img alt="" src={A("area-offered.svg")} className="absolute left-[-0.2px] top-[80.12px] h-[136px] w-[350px] max-w-none" />
      <img alt="" src={A("area-completed.svg")} className="absolute left-[-0.2px] top-[97.12px] h-[122px] w-[350px] max-w-none" />

      {Y_TICKS.map((t) => (
        <p
          key={t.v}
          className="absolute -translate-x-full whitespace-nowrap text-right text-[8px] leading-[9.072px] tracking-[-0.0803px] text-[rgba(44,39,59,0.59)]"
          style={{ left: t.right, top: t.top }}
        >
          {t.v}
        </p>
      ))}
      {X_TICKS.map((t) => (
        <p
          key={t.v}
          className="absolute top-[188.23px] -translate-x-1/2 whitespace-nowrap text-center text-[8px] leading-[8.599px] tracking-[-0.0761px] text-[rgba(44,39,59,0.59)]"
          style={{ left: t.x }}
        >
          {t.v}
        </p>
      ))}

      <div className="absolute left-[197px] top-[78px] w-[101px] text-[#9278fe]">
        <p className="text-[10px] leading-[11px]">{fmt(offered)}</p>
        <p className="text-[8px] leading-[11px]">Offered to AI</p>
      </div>
      <div className="absolute left-[81px] top-[114px] w-[108px] text-white">
        <p className="text-[10px] leading-[10px]">{fmt(completed)}</p>
        <p className="text-[8px] leading-[10px]">Completed by AI</p>
      </div>
    </Link>
  );
}

export interface ActionBar {
  label: [string, string];
  value: number;
  color: string;
}

const BAR_X = [51, 114, 170, 229, 294];
const BAR_BASELINE = 168;
const BAR_MAX_H = 113;

export function ActionDistributionCard({ bars }: { bars: ActionBar[] }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <Link
      href="/actions"
      className="absolute left-[423px] top-[451px] block h-[219px] w-[350px] rounded-[14.024px]"
      style={{ backgroundImage: "linear-gradient(147.78deg, rgba(213,208,255,0.25) 3.51%, rgba(255,255,255,0.25) 66.56%)" }}
    >
      <p className="absolute left-[105px] top-[13px] whitespace-nowrap text-[14px] font-semibold leading-[25px] text-[#2e293e]">
        AI Action Distribution
      </p>
      {bars.slice(0, 5).map((b, i) => {
        const h = Math.max(6, Math.round((b.value / max) * BAR_MAX_H));
        const x = BAR_X[i];
        return (
          <React.Fragment key={b.label.join(" ")}>
            <span
              className="absolute w-3 rounded-[6px]"
              style={{ left: x, top: BAR_BASELINE - h, height: h, background: b.color }}
            />
            <p
              className="absolute -translate-x-1/2 whitespace-nowrap text-center text-[8px] leading-[11px]"
              style={{ left: x + 6, top: BAR_BASELINE - h - 13, color: b.color }}
            >
              {fmt(b.value)}
            </p>
            <div
              className="absolute top-[175px] w-[101px] -translate-x-1/2 text-center text-[8px] leading-[11px] text-[#807c8b]"
              style={{ left: x + 6 }}
            >
              <p>{b.label[0]}</p>
              <p>{b.label[1]}</p>
            </div>
          </React.Fragment>
        );
      })}
    </Link>
  );
}

export function CreditUsageCard({ used, total, onAddCredits }: { used: number; total: number; onAddCredits?: () => void }) {
  const pct = Math.round((used / total) * 100);
  return (
    <div className="absolute left-[794px] top-[451px] h-[219px] w-[248px]">
      <div
        className="absolute inset-0 rounded-[14.024px]"
        style={{ backgroundImage: "linear-gradient(to bottom, rgba(210,198,255,0.43), #9073ff)" }}
      />
      {/* color-burn glow, masked to the card shape */}
      <div className="absolute inset-0 overflow-hidden rounded-[14.024px]">
        <div
          className="absolute left-[-8px] top-[67px] size-[264px] mix-blend-color-burn"
          style={{
            maskImage: `url("${A("credit-mask.svg")}")`,
            WebkitMaskImage: `url("${A("credit-mask.svg")}")`,
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "8px -66.998px",
            WebkitMaskPosition: "8px -66.998px",
            maskSize: "248px 219px",
            WebkitMaskSize: "248px 219px",
          }}
        >
          <img alt="" src={A("credit-glow.svg")} className="absolute inset-0 block size-full max-w-none" />
        </div>
      </div>

      <p className="absolute left-[72px] top-[13px] whitespace-nowrap text-[14px] font-semibold leading-[25px] text-[#2e293e]">
        AI Credit Usage
      </p>
      <p className="absolute left-[85px] top-[73px] flex h-[36.37px] w-[80px] items-center justify-center whitespace-nowrap text-white">
        <span className="text-[44.765px] leading-none">{pct}</span>
        <span className="text-[29.843px] leading-none">%</span>
      </p>

      {/* progress */}
      <div className="absolute left-[31px] top-[133px] h-2 w-[194px] rounded-[7px] bg-[rgba(118,16,255,0.21)]" />
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="AI credit usage"
        className="absolute left-[26px] top-[130px] h-[14px] rounded-[7px] bg-white/10"
        style={{ width: Math.round((157 / 0.75) * (pct / 100)) }}
      />

      <p className="absolute left-[26px] top-[185px] w-[69px] whitespace-nowrap text-[8px] leading-3 text-white">
        {used.toLocaleString("en-IN")}/{total} Used
      </p>
      <button
        type="button"
        onClick={onAddCredits}
        className="absolute left-[125px] top-[181px] flex h-[23px] w-[100px] items-center justify-center gap-[6px] rounded-[19.139px] bg-white text-[10px] leading-[13.6px] text-[#866be3] hover:bg-[#f5f1ff]"
      >
        <span className="relative size-[6px]">
          <span className="absolute left-[2.57px] top-0 h-[6px] w-[0.857px] rounded-[1.93px] bg-[#866be3]" />
          <span className="absolute left-0 top-[2.57px] h-[0.857px] w-[6px] rounded-[1.93px] bg-[#866be3]" />
        </span>
        Add Credits
      </button>
    </div>
  );
}
