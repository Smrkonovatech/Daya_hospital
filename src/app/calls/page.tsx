"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Download,
  Eye,
  EyeOff,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Phone,
  PhoneOutgoing,
  Clock,
  RotateCcw,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { InitiateCallDialog } from "@/components/calls/initiate-call-dialog";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/components/ui/toast";
import { callsService, CallFilterParams } from "@/lib/services/calls-service";
import { CallRecord, IntentCategory } from "@/types";
import { maskPhoneNumber, formatDuration, formatRelativeTime } from "@/lib/utils";

function CallHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  // Read initial query params from URL
  const initialStatus = searchParams.get("status") || "ALL";
  const initialFollowUp = searchParams.get("followUp") === "true" ? "YES" : "ALL";
  const initialIntent = searchParams.get("intent") || "ALL";
  const initialAction = searchParams.get("actionType") || searchParams.get("action") || "ALL";

  // Filter States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dateRange, setDateRange] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus);
  const [intentFilter, setIntentFilter] = React.useState<string>(initialIntent);
  const [languageFilter, setLanguageFilter] = React.useState<string>("ALL");
  const [actionTypeFilter, setActionTypeFilter] = React.useState<string>(initialAction);
  const [followUpFilter, setFollowUpFilter] = React.useState<string>(initialFollowUp);
  const [durationRange, setDurationRange] = React.useState<string>("ALL");

  // Sorting state
  const [sortBy, setSortBy] = React.useState<CallFilterParams["sortBy"]>("startTime");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(8);

  // Privacy reveal toggle
  const [revealAllPhones, setRevealAllPhones] = React.useState(false);

  // Outbound call modal
  const [isInitiateOpen, setIsInitiateOpen] = React.useState(false);

  // Data fetching state
  const [calls, setCalls] = React.useState<CallRecord[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Check if any filter is active
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    dateRange !== "ALL" ||
    statusFilter !== "ALL" ||
    intentFilter !== "ALL" ||
    languageFilter !== "ALL" ||
    actionTypeFilter !== "ALL" ||
    followUpFilter !== "ALL" ||
    durationRange !== "ALL";

  // Load data effect
  React.useEffect(() => {
    let isMounted = true;

    callsService
      .getCalls({
        searchQuery,
        dateRange,
        status: statusFilter,
        intent: intentFilter,
        language: languageFilter,
        actionType: actionTypeFilter,
        followUp: followUpFilter,
        durationRange,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: itemsPerPage,
      })
      .then((result) => {
        if (isMounted) {
          setCalls(result.calls);
          setTotalCount(result.totalCount);
          setTotalPages(result.totalPages);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load calls."
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    searchQuery,
    dateRange,
    statusFilter,
    intentFilter,
    languageFilter,
    actionTypeFilter,
    followUpFilter,
    durationRange,
    sortBy,
    sortOrder,
    currentPage,
    itemsPerPage,
  ]);

  const handleClearAllFilters = () => {
    setSearchQuery("");
    setDateRange("ALL");
    setStatusFilter("ALL");
    setIntentFilter("ALL");
    setLanguageFilter("ALL");
    setActionTypeFilter("ALL");
    setFollowUpFilter("ALL");
    setDurationRange("ALL");
    setCurrentPage(1);
    setIsLoading(true);
    showToast({
      type: "info",
      title: "Filters Reset",
      message: "Displaying all hospital call records.",
    });
  };

  const handleSort = (field: CallFilterParams["sortBy"]) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const handleExportCSV = async () => {
    try {
      // Export all matching records (unpaginated)
      const allFiltered = await callsService.getCalls({
        searchQuery,
        dateRange,
        status: statusFilter,
        intent: intentFilter,
        language: languageFilter,
        actionType: actionTypeFilter,
        followUp: followUpFilter,
        durationRange,
        sortBy,
        sortOrder,
        page: 1,
        limit: 1000,
      });

      const csvString = callsService.generateCSV(allFiltered.calls, revealAllPhones);
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `daya_hospital_ai_calls_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast({
        type: "success",
        title: "CSV Export Complete",
        message: `Exported ${allFiltered.totalCount} call records successfully.`,
      });
    } catch {
      showToast({
        type: "error",
        title: "Export Failed",
        message: "Could not generate CSV file.",
      });
    }
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

  const getPrimaryAction = (call: CallRecord) => {
    if (call.actions && call.actions.length > 0) {
      const act = call.actions[0];
      return {
        label: act.type.replace(/_/g, " "),
        status: act.status,
      };
    }
    if (call.callStatus === "TRANSFERRED") {
      return { label: "Staff Escalation", status: "CONFIRMED" };
    }
    return { label: "Knowledge Query", status: "CONFIRMED" };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Call History & Detailed Interaction Logs"
          description="Search, filter, and audit all inbound calls routed to SMRKO VOICE multilingual receptionist."
          badge={
            <Badge variant="teal" size="sm">
              24/7 Audit Records
            </Badge>
          }
          breadcrumbs={[
            { label: "Overview", href: "/overview" },
            { label: "Call History" },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevealAllPhones(!revealAllPhones)}
                className="gap-1.5 text-xs text-slate-700 hover:bg-slate-50"
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
                className="gap-1.5 text-xs text-slate-700 hover:bg-slate-50"
                title="Export filtered call records to CSV"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export CSV</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setIsInitiateOpen(true)}
                className="gap-1.5 text-xs bg-[#0C5DB8] hover:bg-[#0A4D9A] text-white"
                title="Initiate outbound AI telephone call via Exotel"
              >
                <PhoneOutgoing className="h-3.5 w-3.5" />
                <span>Initiate AI Call</span>
              </Button>
            </div>
          }
        />

        {/* Filter Controls Card */}
        <Card className="shadow-2xs border-slate-200">
          <CardContent className="p-4 space-y-3.5">
            {/* Row 1: Search & Outcome Quick Buttons */}
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Call ID, phone (+91...), patient name, or keyword..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0C5DB8] focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-0.5 rounded-lg bg-slate-100 text-xs">
                {[
                  { key: "ALL", label: "All Calls" },
                  { key: "ANSWERED", label: "Answered" },
                  { key: "TRANSFERRED", label: "Transferred" },
                  { key: "MISSED", label: "Missed" },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      setStatusFilter(s.key);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all whitespace-nowrap ${
                      statusFilter === s.key
                        ? "bg-white text-slate-900 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Secondary Dropdown Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-xs">
              {/* Date Range */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => {
                    setDateRange(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full mt-1 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-800 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value="ALL">All Dates</option>
                  <option value="Today">Today (Oct 27)</option>
                  <option value="Yesterday">Yesterday</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                </select>
              </div>

              {/* Intent Category */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  Intent Category
                </label>
                <select
                  value={intentFilter}
                  onChange={(e) => {
                    setIntentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full mt-1 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-800 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value="ALL">All Intents</option>
                  <option value="APPOINTMENT_BOOKING">Appointment Booking</option>
                  <option value="DOCTOR_AVAILABILITY">Doctor Availability</option>
                  <option value="DEPARTMENT_ENQUIRY">Department Info</option>
                  <option value="CONSULTATION_FEES">Consultation Fees</option>
                  <option value="HOSPITAL_TIMINGS">Hospital Timings</option>
                  <option value="EMERGENCY_AMBULANCE">Emergency & Ambulance</option>
                  <option value="INSURANCE_TPA">Insurance / TPA</option>
                  <option value="GENERAL_QUERY">General Enquiry</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  Language
                </label>
                <select
                  value={languageFilter}
                  onChange={(e) => {
                    setLanguageFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full mt-1 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-800 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value="ALL">All Languages</option>
                  <option value="MALAYALAM">Malayalam</option>
                  <option value="MANGLISH">Manglish</option>
                  <option value="ENGLISH">English</option>
                </select>
              </div>

              {/* Action Type */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  Action Taken
                </label>
                <select
                  value={actionTypeFilter}
                  onChange={(e) => {
                    setActionTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full mt-1 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-800 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value="ALL">All Actions</option>
                  <option value="BOOK_APPOINTMENT">Book Appointment</option>
                  <option value="CHECK_DOCTOR_SLOT">Doctor Slot Search</option>
                  <option value="RESCHEDULE_APPOINTMENT">Reschedule</option>
                  <option value="CANCEL_APPOINTMENT">Cancel Appointment</option>
                  <option value="TRANSFER_CALL_TO_STAFF">Staff Transfer</option>
                  <option value="FEE_ENQUIRY">Fee Enquiry</option>
                  <option value="DEPARTMENT_ROUTING">Department Routing</option>
                </select>
              </div>

              {/* Follow-Up Required */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  Follow-up Status
                </label>
                <select
                  value={followUpFilter}
                  onChange={(e) => {
                    setFollowUpFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full mt-1 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-800 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value="ALL">All Follow-ups</option>
                  <option value="YES">Follow-up Needed</option>
                  <option value="NO">No Follow-up Required</option>
                </select>
              </div>

              {/* Duration Range */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  Duration
                </label>
                <select
                  value={durationRange}
                  onChange={(e) => {
                    setDurationRange(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full mt-1 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-800 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value="ALL">Any Duration</option>
                  <option value="LT_1M">&lt; 1 minute</option>
                  <option value="1_3M">1 – 3 minutes</option>
                  <option value="3_5M">3 – 5 minutes</option>
                  <option value="GT_5M">&gt; 5 minutes</option>
                </select>
              </div>
            </div>

            {/* Clear Filters Bar */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500">
                  Showing <strong>{totalCount}</strong> matching records
                </span>
                <button
                  onClick={handleClearAllFilters}
                  className="flex items-center gap-1 text-[#0C5DB8] hover:text-[#0a4d99] font-medium"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Clear All Filters</span>
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Handling */}
        {error && (
          <ErrorState
            title="Failed to Load Call History"
            message={error}
            onRetry={() => {
              setIsLoading(true);
              setCurrentPage(1);
            }}
          />
        )}

        {/* Main Table Card */}
        <Card className="shadow-xs border-slate-200 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                <Phone className="h-9 w-9 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Call Records Found</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  No hospital calling interactions match the current search query and filter criteria.
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAllFilters}
                    className="mt-4 text-xs"
                  >
                    Reset All Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold select-none">
                      {/* 1. Time */}
                      <th
                        scope="col"
                        onClick={() => handleSort("startTime")}
                        className="py-3 px-3.5 cursor-pointer hover:bg-slate-100/80"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Call Time</span>
                          {sortBy === "startTime" ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-[#0C5DB8]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#0C5DB8]" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </th>

                      {/* 2. Masked Caller */}
                      <th
                        scope="col"
                        onClick={() => handleSort("callerNumber")}
                        className="py-3 px-3.5 cursor-pointer hover:bg-slate-100/80"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Caller</span>
                          {sortBy === "callerNumber" && (
                            sortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-[#0C5DB8]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#0C5DB8]" />
                            )
                          )}
                        </div>
                      </th>

                      {/* 3. Duration */}
                      <th
                        scope="col"
                        onClick={() => handleSort("durationSeconds")}
                        className="py-3 px-3.5 cursor-pointer hover:bg-slate-100/80"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Duration</span>
                          {sortBy === "durationSeconds" ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-[#0C5DB8]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#0C5DB8]" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </th>

                      {/* 4. Language */}
                      <th scope="col" className="py-3 px-3.5">
                        Language
                      </th>

                      {/* 5. Primary Intent */}
                      <th scope="col" className="py-3 px-3.5">
                        Primary Intent
                      </th>

                      {/* 6. AI Summary */}
                      <th scope="col" className="py-3 px-3.5 max-w-xs">
                        AI-Generated Summary
                      </th>

                      {/* 7. Action Taken */}
                      <th scope="col" className="py-3 px-3.5">
                        Action Taken
                      </th>

                      {/* 8. Final Status */}
                      <th
                        scope="col"
                        onClick={() => handleSort("callStatus")}
                        className="py-3 px-3.5 cursor-pointer hover:bg-slate-100/80"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Status</span>
                          {sortBy === "callStatus" && (
                            sortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-[#0C5DB8]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#0C5DB8]" />
                            )
                          )}
                        </div>
                      </th>

                      {/* 9. Follow-Up Indicator */}
                      <th scope="col" className="py-3 px-3.5">
                        Follow-Up
                      </th>

                      {/* Action */}
                      <th scope="col" className="py-3 px-3.5 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {calls.map((call) => {
                      const primaryAction = getPrimaryAction(call);
                      return (
                        <tr
                          key={call.id}
                          onClick={() => router.push(`/calls/${call.id}`)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          {/* 1. Time */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
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

                          {/* 2. Masked Caller */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <div>
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {revealAllPhones
                                  ? call.callerNumber
                                  : maskPhoneNumber(call.callerNumber)}
                              </span>
                              {call.callerName && (
                                <p className="text-[11px] text-slate-500 truncate max-w-[140px]">
                                  {call.callerName}
                                </p>
                              )}
                              <p className="text-[9px] text-slate-400 font-mono">
                                ID: {call.id}
                              </p>
                            </div>
                          </td>

                          {/* 3. Duration */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap font-mono text-slate-600 font-medium">
                            {formatDuration(call.durationSeconds)}
                          </td>

                          {/* 4. Language */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <Badge variant="teal" size="sm">
                              {call.language}
                            </Badge>
                          </td>

                          {/* 5. Primary Intent */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <Badge
                              variant={getIntentBadgeVariant(call.intentCategory)}
                              size="sm"
                            >
                              {call.intentCategory.replace(/_/g, " ")}
                            </Badge>
                          </td>

                          {/* 6. AI Summary */}
                          <td className="py-3.5 px-3.5 max-w-xs">
                            <p
                              className="text-xs text-slate-600 line-clamp-2 leading-relaxed"
                              title={call.aiSummary}
                            >
                              {call.aiSummary}
                            </p>
                          </td>

                          {/* 7. Action Taken */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <span className="font-medium text-slate-800">
                              {primaryAction.label}
                            </span>
                            {call.hmsTransactionRef && (
                              <p className="text-[10px] text-blue-700 font-mono">
                                {call.hmsTransactionRef}
                              </p>
                            )}
                          </td>

                          {/* 8. Final Status */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <Badge
                              variant={
                                call.callStatus === "ANSWERED"
                                  ? "teal"
                                  : call.callStatus === "TRANSFERRED"
                                  ? "warning"
                                  : "danger"
                              }
                              size="sm"
                            >
                              {call.callStatus}
                            </Badge>
                          </td>

                          {/* 9. Follow-Up Indicator */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            {call.requiresFollowUp ? (
                              <Badge variant="warning" size="sm" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Required</span>
                              </Badge>
                            ) : call.followUpStatus === "RESOLVED" ? (
                              <Badge variant="success" size="sm" className="gap-1">
                                <UserCheck className="h-3 w-3" />
                                <span>Resolved</span>
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap text-right">
                            <Link
                              href={`/calls/${call.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs text-[#0C5DB8] hover:bg-blue-50 hover:border-blue-300 gap-1"
                              >
                                <span>Details</span>
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Toolbar */}
            {!isLoading && totalCount > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-600 gap-3">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value, 10));
                      setCurrentPage(1);
                    }}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={20}>20</option>
                  </select>
                  <span>per page • Total: <strong>{totalCount}</strong> calls</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="mr-2">
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="h-7 px-2.5 text-xs"
                  >
                    Previous
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="h-7 px-2.5 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <InitiateCallDialog
          isOpen={isInitiateOpen}
          onClose={() => setIsInitiateOpen(false)}
          onCallInitiated={() => {
            setCurrentPage(1);
            callsService
              .getCalls({
                searchQuery,
                dateRange,
                status: statusFilter,
                intent: intentFilter,
                language: languageFilter,
                actionType: actionTypeFilter,
                followUp: followUpFilter,
                durationRange,
                sortBy,
                sortOrder,
                page: 1,
                limit: itemsPerPage,
              })
              .then((result) => {
                setCalls(result.calls);
                setTotalCount(result.totalCount);
                setTotalPages(result.totalPages);
              })
              .catch(() => {});
          }}
        />
      </div>
    </DashboardLayout>
  );
}

function CallHistorySkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </DashboardLayout>
  );
}

export default function CallHistoryPage() {
  return (
    <React.Suspense fallback={<CallHistorySkeleton />}>
      <CallHistoryContent />
    </React.Suspense>
  );
}
