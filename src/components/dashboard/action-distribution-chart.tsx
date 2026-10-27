"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { ActionDistributionItem } from "@/lib/services/overview-service";

interface ActionDistributionChartProps {
  data: ActionDistributionItem[];
  title?: string;
  description?: string;
}

const emptySubscribe = () => () => {};

export function ActionDistributionChart({
  data,
  title = "AI Action Distribution",
  description = "Breakdown of automated clinical and administrative actions performed",
}: ActionDistributionChartProps) {
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
            <Activity className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">No Action Records</p>
            <p className="text-xs text-slate-400">No AI-initiated actions were recorded during this timeframe.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 shadow-xs border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[230px] w-full">
          {isClient ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 35, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}`}
                />
                <YAxis
                  type="category"
                  dataKey="actionLabel"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as ActionDistributionItem;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs space-y-1">
                          <p className="font-semibold text-slate-900">{item.actionLabel}</p>
                          <div className="flex items-center justify-between gap-4 text-slate-600">
                            <span>Count:</span>
                            <span className="font-bold text-slate-900">
                              {item.count.toLocaleString()} actions
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-slate-600">
                            <span>Share:</span>
                            <span className="font-bold text-slate-900">
                              {item.percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {data.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
              Loading actions chart...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
