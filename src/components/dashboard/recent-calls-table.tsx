"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Clock, Phone, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CallRecord, IntentCategory } from "@/types";
import { maskPhoneNumber, formatDuration, formatRelativeTime } from "@/lib/utils";

interface RecentCallsTableProps {
  calls: CallRecord[];
  onSelectCall: (call: CallRecord) => void;
  title?: string;
  description?: string;
}

export function RecentCallsTable({
  calls,
  onSelectCall,
  title = "Recent AI Calls",
  description = "Latest inbound patient calls routed to the Malayalam voice assistant",
}: RecentCallsTableProps) {
  const getOutcomeBadge = (call: CallRecord) => {
    if (call.callStatus === "ANSWERED") {
      if (call.requiresFollowUp) {
        return (
          <Badge variant="warning" size="sm">
            Needs Follow-up
          </Badge>
        );
      }
      return (
        <Badge variant="teal" size="sm">
          Completed
        </Badge>
      );
    }
    if (call.callStatus === "TRANSFERRED") {
      return (
        <Badge variant="warning" size="sm">
          Transferred to Staff
        </Badge>
      );
    }
    return (
      <Badge variant="danger" size="sm">
        Missed / Dropped
      </Badge>
    );
  };

  const getPrimaryActionLabel = (call: CallRecord) => {
    if (call.actions && call.actions.length > 0) {
      const action = call.actions[0];
      switch (action.type) {
        case "BOOK_APPOINTMENT":
          return "Book Appointment";
        case "CHECK_DOCTOR_SLOT":
          return "Doctor Slot Search";
        case "RESCHEDULE_APPOINTMENT":
          return "Reschedule Appointment";
        case "CANCEL_APPOINTMENT":
          return "Cancel Appointment";
        case "TRANSFER_CALL_TO_STAFF":
          return "Staff Transfer";
        case "FEE_ENQUIRY":
          return "Consultation Fee Info";
        case "DEPARTMENT_ROUTING":
          return "Department Routing";
        default:
          return (action.type as string).replace(/_/g, " ");
      }
    }
    if (call.callStatus === "TRANSFERRED") {
      return "Staff Escalation";
    }
    return "Knowledge Query / FAQ";
  };

  const getIntentBadgeVariant = (
    intent: IntentCategory
  ): "default" | "teal" | "secondary" | "outline" | "success" | "warning" | "danger" | "info" | "urgent" => {
    switch (intent) {
      case "DOCTOR_AVAILABILITY":
      case "APPOINTMENT_BOOKING":
        return "default";
      case "HOSPITAL_TIMINGS":
      case "CONSULTATION_FEES":
      case "INSURANCE_TPA":
        return "teal";
      case "DEPARTMENT_ENQUIRY":
        return "info";
      case "EMERGENCY_AMBULANCE":
        return "urgent";
      default:
        return "secondary";
    }
  };

  return (
    <Card className="shadow-xs border-slate-200">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        <Link href="/calls">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-[#0C5DB8] hover:text-[#0a4d99] hover:bg-blue-50 font-medium"
          >
            <span>View Full Call History</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {!calls || calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <Phone className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">No Recent Calls</p>
            <p className="text-xs text-slate-400">No calls were recorded for this filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th scope="col" className="py-2.5 px-3.5">Time</th>
                  <th scope="col" className="py-2.5 px-3.5">Caller</th>
                  <th scope="col" className="py-2.5 px-3.5">Intent</th>
                  <th scope="col" className="py-2.5 px-3.5">Duration</th>
                  <th scope="col" className="py-2.5 px-3.5">AI Action</th>
                  <th scope="col" className="py-2.5 px-3.5">Final Outcome</th>
                  <th scope="col" className="py-2.5 px-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {calls.slice(0, 7).map((call) => (
                  <tr
                    key={call.id}
                    onClick={() => onSelectCall(call)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Time */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-900 leading-tight">
                            {new Date(call.startTime).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatRelativeTime(call.startTime)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Masked Caller */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div>
                        <span className="font-mono font-medium text-slate-900">
                          {maskPhoneNumber(call.callerNumber)}
                        </span>
                        {call.callerName && (
                          <p className="text-[11px] text-slate-500 truncate max-w-[140px]">
                            {call.callerName}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Intent */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <Badge
                        variant={getIntentBadgeVariant(call.intentCategory)}
                        size="sm"
                      >
                        {call.intentCategory.replace(/_/g, " ")}
                      </Badge>
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-600">
                      {formatDuration(call.durationSeconds)}
                    </td>

                    {/* AI Action */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-medium text-slate-800">
                        {getPrimaryActionLabel(call)}
                      </span>
                    </td>

                    {/* Final Outcome */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {getOutcomeBadge(call)}
                    </td>

                    {/* Link to Details */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCall(call);
                        }}
                        className="h-7 px-2.5 text-xs text-[#0C5DB8] hover:bg-blue-50 hover:border-blue-300 gap-1"
                      >
                        <span>Details</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
