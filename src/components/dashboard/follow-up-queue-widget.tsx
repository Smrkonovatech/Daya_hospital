"use client";

import * as React from "react";
import { UserCheck, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CallRecord } from "@/types";
import { maskPhoneNumber, formatRelativeTime } from "@/lib/utils";

interface FollowUpQueueWidgetProps {
  calls: CallRecord[];
  onSelectCall: (call: CallRecord) => void;
  onResolveFollowUp?: (callId: string) => void;
}

export function FollowUpQueueWidget({
  calls,
  onSelectCall,
  onResolveFollowUp,
}: FollowUpQueueWidgetProps) {
  const followUpCalls = calls.filter((c) => c.requiresFollowUp);

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>Staff Follow-Up Queue</CardTitle>
            <Badge variant="warning" size="sm">
              {followUpCalls.length} Pending
            </Badge>
          </div>
          <CardDescription>
            Calls where AI could not complete HMS action or staff intervention is required
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {followUpCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-lg border border-slate-100">
            <UserCheck className="h-8 w-8 text-emerald-500 mb-2" />
            <p className="text-xs font-semibold text-slate-700">All Follow-ups Cleared</p>
            <p className="text-[11px] text-slate-400">No unresolved patient requests currently pending.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {followUpCalls.map((call) => (
              <div
                key={call.id}
                className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    {call.callerName || maskPhoneNumber(call.callerNumber)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatRelativeTime(call.startTime)}
                  </span>
                </div>

                <p className="text-slate-600 text-[11px]">
                  {call.followUpNotes || call.aiSummary}
                </p>

                {call.assignedStaff && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-900 font-medium">
                    <UserCheck className="h-3 w-3 text-amber-700" />
                    <span>Assigned to: {call.assignedStaff}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectCall(call)}
                    className="h-6 text-[11px] px-2 text-[#0C5DB8]"
                  >
                    Review Call
                  </Button>

                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => onResolveFollowUp?.(call.id)}
                    className="h-6 text-[11px] px-2 gap-1 text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200"
                  >
                    <Check className="h-3 w-3" />
                    Mark Resolved
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
