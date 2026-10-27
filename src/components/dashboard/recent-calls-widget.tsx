"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Phone, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CallRecord } from "@/types";
import { maskPhoneNumber, formatDuration, formatRelativeTime } from "@/lib/utils";

interface RecentCallsWidgetProps {
  calls: CallRecord[];
  onSelectCall: (call: CallRecord) => void;
}

export function RecentCallsWidget({ calls, onSelectCall }: RecentCallsWidgetProps) {
  return (
    <Card className="col-span-1 xl:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>Recent Live AI Calls</CardTitle>
          <CardDescription>
            Latest inbound patient queries handled by the Malayalam voice assistant
          </CardDescription>
        </div>
        <Link href="/calls">
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-[#0C5DB8]">
            View All Calls
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
          {calls.slice(0, 5).map((call) => (
            <div
              key={call.id}
              onClick={() => onSelectCall(call)}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer gap-2"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`mt-0.5 rounded-lg p-2 shrink-0 ${
                    call.callStatus === "ANSWERED"
                      ? "bg-emerald-50 text-emerald-600"
                      : call.callStatus === "TRANSFERRED"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-rose-50 text-rose-600"
                  }`}
                >
                  <Phone className="h-4 w-4" />
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-slate-900">
                      {maskPhoneNumber(call.callerNumber)}
                    </span>
                    {call.callerName && (
                      <span className="text-xs text-slate-500 font-medium">
                        ({call.callerName})
                      </span>
                    )}
                    <Badge variant="teal" size="sm">
                      {call.language}
                    </Badge>
                    {call.requiresFollowUp && (
                      <Badge variant="warning" size="sm">
                        Follow-up Needed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-1">
                    {call.aiSummary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:justify-end shrink-0 pl-9 sm:pl-0 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{formatDuration(call.durationSeconds)}</span>
                </div>

                <span className="text-[11px] text-slate-400">
                  {formatRelativeTime(call.startTime)}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCall(call);
                  }}
                  className="h-7 px-2.5 text-xs text-[#0C5DB8]"
                >
                  Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
