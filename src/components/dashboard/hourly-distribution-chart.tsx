"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { HourlyDistributionItem } from "@/lib/services/overview-service";

interface HourlyDistributionChartProps {
  data: HourlyDistributionItem[];
  title?: string;
  description?: string;
}

const emptySubscribe = () => () => {};

export function HourlyDistributionChart({
  data,
  title = "Hourly Call Distribution (24 Hours)",
  description = "Volume pattern across day/night shifts showing peak hospital rush hours",
}: HourlyDistributionChartProps) {
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
            <Clock className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">No Hourly Data</p>
            <p className="text-xs text-slate-400">Hourly call distribution data is not available for this selection.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 shadow-xs border-slate-200">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-2">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0C5DB8]" />
            <span className="text-slate-600">Offered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#18A99D]" />
            <span className="text-slate-600">AI Handled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
            <span className="text-slate-600">Transferred</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[240px] w-full">
          {isClient ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="hour"
                  stroke="#94A3B8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs space-y-1">
                          <p className="font-semibold text-slate-800">Hour: {label}</p>
                          {payload.map((entry, index) => (
                            <div key={`p-${index}`} className="flex items-center justify-between gap-4">
                              <span style={{ color: entry.color }}>{entry.name}:</span>
                              <span className="font-bold text-slate-900">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="offered" name="Offered" fill="#0C5DB8" radius={[2, 2, 0, 0]} />
                <Bar dataKey="handled" name="AI Handled" fill="#18A99D" radius={[2, 2, 0, 0]} />
                <Bar dataKey="transferred" name="Transferred" fill="#F59E0B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
              Loading hourly call distribution...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
