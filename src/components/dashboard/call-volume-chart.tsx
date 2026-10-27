"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface CallVolumeChartProps {
  data: {
    hour: string;
    offered: number;
    answered: number;
    transferred: number;
  }[];
}

const emptySubscribe = () => () => {};

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <Card className="col-span-1 xl:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>24/7 Call Volume & Routing Trends</CardTitle>
          <CardDescription>
            Hourly distribution of calls offered from IVR vs AI answered vs transferred to hospital staff
          </CardDescription>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0C5DB8]" />
            <span className="text-slate-600">Offered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#18A99D]" />
            <span className="text-slate-600">AI Handled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
            <span className="text-slate-600">Staff Transferred</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[280px] w-full">
          {isClient ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="offeredGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0C5DB8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0C5DB8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="answeredGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18A99D" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#18A99D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="hour"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs space-y-1">
                          <p className="font-semibold text-slate-800">{label}</p>
                          {payload.map((entry, index) => (
                            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                              <span className="capitalize" style={{ color: entry.color }}>
                                {entry.name}:
                              </span>
                              <span className="font-bold text-slate-900">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="offered"
                  name="Offered"
                  stroke="#0C5DB8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#offeredGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="answered"
                  name="AI Handled"
                  stroke="#18A99D"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#answeredGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
              Loading call trends...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
