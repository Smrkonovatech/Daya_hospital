"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import { OutcomeDistributionItem } from "@/lib/services/overview-service";

interface OutcomeDistributionChartProps {
  data: OutcomeDistributionItem[];
  title?: string;
  description?: string;
}

const emptySubscribe = () => () => {};

export function OutcomeDistributionChart({
  data,
  title = "Call Outcome Distribution",
  description = "Proportion of calls completed, transferred to staff, or requiring follow-up",
}: OutcomeDistributionChartProps) {
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const totalCalls = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.value, 0);
  }, [data]);

  if (!data || data.length === 0 || totalCalls === 0) {
    return (
      <Card className="col-span-1 shadow-xs border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <PieChartIcon className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">No Outcome Data</p>
            <p className="text-xs text-slate-400">There are no call outcomes logged for the selected period.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Recharts Donut */}
          <div className="md:col-span-5 h-[200px] w-full relative flex items-center justify-center">
            {isClient ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as OutcomeDistributionItem;
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs space-y-1">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span>{item.name}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span>Volume:</span>
                              <span className="font-bold text-slate-900">
                                {item.value.toLocaleString()} calls
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span>Percentage:</span>
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
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                Loading outcome chart...
              </div>
            )}

            {/* Inner Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                Total
              </span>
              <span className="text-base font-bold text-slate-800">
                {totalCalls.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Outcome Breakdown List */}
          <div className="md:col-span-7 space-y-2">
            {data.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100/60 transition-colors text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate font-medium text-slate-700">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500 font-mono text-[11px]">
                    {item.value.toLocaleString()}
                  </span>
                  <span className="font-bold text-slate-900 w-9 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
