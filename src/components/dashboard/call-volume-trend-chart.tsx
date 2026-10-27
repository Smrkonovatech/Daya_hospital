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
import { PhoneCall } from "lucide-react";
import { TimePointTrend } from "@/lib/services/overview-service";

interface CallVolumeTrendChartProps {
  data: TimePointTrend[];
  title?: string;
  description?: string;
}

const emptySubscribe = () => () => {};

export function CallVolumeTrendChart({
  data,
  title = "AI Call Volume Over Time",
  description = "Timeline trend of calls offered vs AI answered vs completed calls",
}: CallVolumeTrendChartProps) {
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!data || data.length === 0) {
    return (
      <Card className="col-span-1 shadow-xs border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <PhoneCall className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">No Call Volume Data</p>
            <p className="text-xs text-slate-400">There is no inbound call volume recorded for this time interval.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 shadow-xs border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0C5DB8]" />
            <span className="text-slate-600">Offered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#18A99D]" />
            <span className="text-slate-600">Completed</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[240px] w-full">
          {isClient ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="volOffered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0C5DB8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0C5DB8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="volCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18A99D" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#18A99D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
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
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs space-y-1">
                          <p className="font-semibold text-slate-800">{label}</p>
                          {payload.map((entry, index) => (
                            <div key={`p-${index}`} className="flex items-center justify-between gap-4">
                              <span style={{ color: entry.color }}>
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
                  fill="url(#volOffered)"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#18A99D"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#volCompleted)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
              Loading call volume trend...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
