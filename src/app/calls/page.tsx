"use client";

import * as React from "react";
import {
  Search,
  Download,
  Eye,
  EyeOff,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CallDetailModal } from "@/components/calls/call-detail-modal";
import { MOCK_CALL_RECORDS } from "@/lib/mock-data";
import { CallRecord } from "@/types";
import { maskPhoneNumber, formatDuration, formatDateTime } from "@/lib/utils";

export default function CallHistoryPage() {
  const [calls, setCalls] = React.useState<CallRecord[]>(MOCK_CALL_RECORDS);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [intentFilter, setIntentFilter] = React.useState<string>("ALL");
  const [languageFilter, setLanguageFilter] = React.useState<string>("ALL");
  const [followUpOnly, setFollowUpOnly] = React.useState(false);
  const [revealAllPhones, setRevealAllPhones] = React.useState(false);
  const [selectedCall, setSelectedCall] = React.useState<CallRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 8;

  // Filter logic
  const filteredCalls = React.useMemo(() => {
    return calls.filter((call) => {
      // Search text
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesPhone = call.callerNumber.toLowerCase().includes(query);
        const matchesName = call.callerName?.toLowerCase().includes(query);
        const matchesSummary = call.aiSummary.toLowerCase().includes(query);
        const matchesId = call.id.toLowerCase().includes(query);
        if (!matchesPhone && !matchesName && !matchesSummary && !matchesId) {
          return false;
        }
      }

      // Status
      if (statusFilter !== "ALL" && call.callStatus !== statusFilter) {
        return false;
      }

      // Intent
      if (intentFilter !== "ALL" && call.intentCategory !== intentFilter) {
        return false;
      }

      // Language
      if (languageFilter !== "ALL" && call.language !== languageFilter) {
        return false;
      }

      // Follow-up only
      if (followUpOnly && !call.requiresFollowUp) {
        return false;
      }

      return true;
    });
  }, [calls, searchQuery, statusFilter, intentFilter, languageFilter, followUpOnly]);

  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage) || 1;
  const paginatedCalls = filteredCalls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenCall = (call: CallRecord) => {
    setSelectedCall(call);
    setIsDetailModalOpen(true);
  };

  const handleExportCSV = () => {
    const headers = [
      "Call ID",
      "External Session ID",
      "Caller Number",
      "Caller Name",
      "Start Time",
      "Duration (s)",
      "Status",
      "Language",
      "Intent Category",
      "AI Summary",
      "HMS Ref",
      "Requires Followup",
    ];
    const rows = filteredCalls.map((c) => [
      c.id,
      c.externalCallId,
      revealAllPhones ? c.callerNumber : maskPhoneNumber(c.callerNumber),
      c.callerName || "",
      c.startTime,
      c.durationSeconds,
      c.callStatus,
      c.language,
      c.intentCategory,
      `"${c.aiSummary.replace(/"/g, '""')}"`,
      c.hmsTransactionRef || "",
      c.requiresFollowUp ? "YES" : "NO",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `daya_ai_calls_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Call History & Interaction Logs
            </h1>
            <p className="text-xs text-slate-500">
              Audit log of all inbound Malayalam voice calls routed from Daya Hospital IVR
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevealAllPhones(!revealAllPhones)}
              className="gap-1.5 text-xs text-slate-700"
              title="Toggle privacy masking for authorized audit"
            >
              {revealAllPhones ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                  <span>Mask Numbers</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  <span>Reveal Numbers (Audit)</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 text-xs text-slate-700"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Filters Bar Card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by phone, patient name, keyword, or call ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-0.5 rounded-lg bg-slate-100 text-xs">
                {["ALL", "ANSWERED", "TRANSFERRED", "MISSED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setCurrentPage(1);
                    }}
                    className={`rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                      statusFilter === status
                        ? "bg-white text-[#0C5DB8] shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {status === "ALL" ? "All Calls" : status}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropdown Filters Row */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs border-t border-slate-100">
              {/* Intent Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Enquiry Intent:</span>
                <select
                  value={intentFilter}
                  onChange={(e) => {
                    setIntentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                >
                  <option value="ALL">All Intents</option>
                  <option value="APPOINTMENT_BOOKING">Appointment Booking</option>
                  <option value="DOCTOR_AVAILABILITY">Doctor Availability</option>
                  <option value="CONSULTATION_FEES">Consultation Fees</option>
                  <option value="DEPARTMENT_ENQUIRY">Department Enquiry</option>
                  <option value="INSURANCE_TPA">Insurance & TPA</option>
                  <option value="EMERGENCY_AMBULANCE">Emergency / Ambulance</option>
                  <option value="GENERAL_QUERY">General Hospital Query</option>
                </select>
              </div>

              {/* Language Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Language:</span>
                <select
                  value={languageFilter}
                  onChange={(e) => {
                    setLanguageFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                >
                  <option value="ALL">All Languages</option>
                  <option value="MALAYALAM">Malayalam (മലയാളം)</option>
                  <option value="MANGLISH">Manglish</option>
                  <option value="ENGLISH">English</option>
                </select>
              </div>

              {/* Follow-up checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium ml-auto">
                <input
                  type="checkbox"
                  checked={followUpOnly}
                  onChange={(e) => {
                    setFollowUpOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
                />
                <span>Follow-up Required Only</span>
              </label>

              {(searchQuery ||
                statusFilter !== "ALL" ||
                intentFilter !== "ALL" ||
                languageFilter !== "ALL" ||
                followUpOnly) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setIntentFilter("ALL");
                    setLanguageFilter("ALL");
                    setFollowUpOnly(false);
                    setCurrentPage(1);
                  }}
                  className="text-xs text-[#0C5DB8] hover:underline"
                >
                  Reset filters
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Call Records Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Status & Call ID</th>
                  <th className="py-3.5 px-4">Caller Information</th>
                  <th className="py-3.5 px-4">Date & Time (IST)</th>
                  <th className="py-3.5 px-4">Enquiry Intent</th>
                  <th className="py-3.5 px-4">AI Structured Summary</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">HMS Action</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCalls.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No calls matching the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedCalls.map((call) => (
                    <tr
                      key={call.id}
                      onClick={() => handleOpenCall(call)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      {/* Status & ID */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <Badge
                            variant={
                              call.callStatus === "ANSWERED"
                                ? "success"
                                : call.callStatus === "TRANSFERRED"
                                ? "warning"
                                : "danger"
                            }
                            size="sm"
                          >
                            {call.callStatus}
                          </Badge>
                          <div className="font-mono text-[10px] text-slate-400">
                            {call.id}
                          </div>
                        </div>
                      </td>

                      {/* Caller */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {maskPhoneNumber(call.callerNumber, revealAllPhones)}
                        </div>
                        {call.callerName && (
                          <div className="text-[11px] text-slate-500">
                            {call.callerName}
                          </div>
                        )}
                        <Badge variant="teal" size="sm" className="mt-1">
                          {call.language}
                        </Badge>
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {formatDateTime(call.startTime)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {call.callSource === "IVR_ROLLOVER"
                            ? "IVR Rollover"
                            : call.callSource === "DIRECT_HOTLINE"
                            ? "Direct Hotline"
                            : "Off-Hours"}
                        </div>
                      </td>

                      {/* Intent */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">
                          {call.intentCategory.replace(/_/g, " ")}
                        </span>
                        {call.requiresFollowUp && (
                          <div className="mt-1">
                            <Badge variant="warning" size="sm">
                              Follow-up: {call.followUpStatus}
                            </Badge>
                          </div>
                        )}
                      </td>

                      {/* Summary */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="line-clamp-2 text-slate-600 leading-snug">
                          {call.aiSummary}
                        </p>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                        {formatDuration(call.durationSeconds)}
                      </td>

                      {/* HMS Action */}
                      <td className="py-3.5 px-4">
                        {call.hmsTransactionRef ? (
                          <div className="space-y-0.5">
                            <Badge variant="default" size="sm" className="font-mono">
                              {call.hmsTransactionRef}
                            </Badge>
                            <div className="text-[10px] text-emerald-700 font-semibold">
                              ✓ HMS Confirmed
                            </div>
                          </div>
                        ) : call.actions.length > 0 ? (
                          <div className="text-[11px] text-slate-600">
                            {call.actions[0].type.replace(/_/g, " ")}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Review Action */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCall(call);
                          }}
                          className="h-7 text-xs text-[#0C5DB8] font-semibold"
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
            <div>
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {filteredCalls.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPage * itemsPerPage, filteredCalls.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-800">
                {filteredCalls.length}
              </span>{" "}
              calls
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-8 text-xs"
              >
                Previous
              </Button>
              <span className="px-2 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Call Detail Modal */}
      <CallDetailModal
        call={selectedCall}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onUpdateFollowUp={(callId, notes, resolved) => {
          setCalls((prev) =>
            prev.map((c) =>
              c.id === callId
                ? {
                    ...c,
                    followUpNotes: notes,
                    requiresFollowUp: !resolved,
                    followUpStatus: resolved ? "RESOLVED" : "IN_PROGRESS",
                  }
                : c
            )
          );
        }}
      />
    </DashboardLayout>
  );
}
