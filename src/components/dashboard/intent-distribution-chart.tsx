"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface IntentItem {
  intent: string;
  intentLabel: string;
  count: number;
  percentage: number;
  color: string;
}

interface IntentDistributionChartProps {
  intents: IntentItem[];
}

export function IntentDistributionChart({ intents }: IntentDistributionChartProps) {
  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle>AI Enquiry Breakdown</CardTitle>
        <CardDescription>
          Distribution of Malayalam caller intents handled by Daya AI
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Multi-segment Progress Bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          {intents.map((item) => (
            <div
              key={item.intent}
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color,
              }}
              title={`${item.intentLabel}: ${item.percentage}% (${item.count} calls)`}
              className="h-full transition-all hover:opacity-85"
            />
          ))}
        </div>

        {/* Intent List Breakdown */}
        <div className="mt-4 space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
          {intents.map((item) => (
            <div
              key={item.intent}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate font-medium text-slate-700">
                  {item.intentLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-slate-500">{item.count} calls</span>
                <span className="font-semibold text-slate-900 w-10 text-right">
                  {item.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
