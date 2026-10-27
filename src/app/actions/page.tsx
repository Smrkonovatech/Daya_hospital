"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  ShieldCheck,
  ExternalLink,
  CalendarCheck,
  AlertTriangle,
  RotateCcw,
  Download,
  Eye,
  EyeOff,
  UserCheck,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  FileCode,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/components/ui/toast";
import { ActionDetailDrawer } from "@/components/actions/action-detail-drawer";
import { actionsService, ActionFilterParams } from "@/lib/services/actions-service";
import { AiActionDetail, ActionStatus } from "@/types";
import { formatDateTime, maskPhoneNumber } from "@/lib/utils";

function ActionsContent() {
  const { showToast } = useToast();

  // Active primary tab
  const [activeTab, setActiveTab] = React.useState<"ALL" | "FOLLOW_UP">("ALL");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dateRange, setDateRange] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");

  // Sorting & Pagination
  const [sortBy, setSortBy] = React.useState<ActionFilterParams["sortBy"]>("requestedAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(8);

  // Privacy reveal
  const [revealPhones, setRevealPhones] = React.useState(false);

  // Drawer state
  const [selectedAction, setSelectedAction] = React.useState<AiActionDetail | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  // Data fetching state
  const [actions, setActions] = React.useState<AiActionDetail[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [summaryCounts, setSummaryCounts] = React.useState({
    total: 0,
    confirmed: 0,
    requiresFollowUp: 0,
    failed: 0,
    inProgress: 0,
    pendingVerification: 0,
    cancelled: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    dateRange !== "ALL" ||
    statusFilter !== "ALL" ||
    typeFilter !== "ALL";

  // Data fetch effect
  React.useEffect(() => {
    let isMounted = true;

    actionsService
      .getActions({
        searchQuery,
        dateRange,
        status: statusFilter,
        actionType: typeFilter,
        onlyFollowUp: activeTab === "FOLLOW_UP",
        sortBy,
        sortOrder,
        page: currentPage,
        limit: itemsPerPage,
      })
      .then((res) => {
        if (isMounted) {
          setActions(res.actions);
          setTotalCount(res.totalCount);
          setTotalPages(res.totalPages);
          setSummaryCounts(res.summaryCounts);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load AI actions."
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    activeTab,
    searchQuery,
    dateRange,
    statusFilter,
    typeFilter,
    sortBy,
    sortOrder,
    currentPage,
    itemsPerPage,
  ]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setDateRange("ALL");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    try {
      const csv = actionsService.generateCSV(actions, revealPhones);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `daya_ai_actions_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast({
        type: "success",
        title: "Export Succeeded",
        message: `Exported ${actions.length} action records to CSV.`,
      });
    } catch {
      showToast({
        type: "error",
        title: "Export Failed",
        message: "Could not export action records to CSV.",
      });
    }
  };

  const handleSort = (field: ActionFilterParams["sortBy"]) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const handleOpenDrawer = (action: AiActionDetail) => {
    setSelectedAction(action);
    setIsDrawerOpen(true);
  };

  const handleActionUpdated = (updated: AiActionDetail) => {
    setActions((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
    if (selectedAction?.id === updated.id) {
      setSelectedAction(updated);
    }
  };

  const getStatusBadgeVariant = (status: ActionStatus) => {
    switch (status) {
      case "CONFIRMED":
        return "teal";
      case "FAILED":
        return "danger";
      case "REQUIRES_STAFF_FOLLOW_UP":
        return "urgent";
      case "PENDING_VERIFICATION":
        return "warning";
      case "IN_PROGRESS":
        return "info";
      default:
        return "secondary";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="AI Actions & HMS Status Ledger"
          description="Track every outpatient enquiry, booking attempt, and staff handoff verified against Daya HMS."
          badge={
            <div className="flex items-center gap-2">
              <Badge variant="teal" size="sm">
                Idempotency Guard Active
              </Badge>
              <Badge variant="outline" size="sm" className="font-semibold text-slate-500">
                Demo Data Mode
              </Badge>
            </div>
          }
          breadcrumbs={[
            { label: "Overview", href: "/overview" },
            { label: "AI Actions" },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevealPhones(!revealPhones)}
                className="gap-1.5 text-xs text-slate-700 hover:bg-slate-50"
                title="Toggle caller number masking for supervisor audit"
              >
                {revealPhones ? (
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
                title="Export filtered records to CSV"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export CSV</span>
              </Button>
            </div>
          }
        />

        {/* Action Status Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-[#0C5DB8] shadow-2xs">
            <CardContent className="p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total AI Actions
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {summaryCounts.total}
                </span>
                {summaryCounts.inProgress > 0 && (
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                    {summaryCounts.inProgress} in flight
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                Attempted by voice agent
              </span>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-600 shadow-2xs">
            <CardContent className="p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                HMS Confirmed
              </span>
              <div className="mt-1 text-2xl font-bold text-emerald-800">
                {summaryCounts.confirmed}
              </div>
              <span className="text-[11px] text-emerald-600 font-medium">
                Verified with HMS token reference
              </span>
            </CardContent>
          </Card>

          <Card
            className={`border-l-4 border-l-amber-500 shadow-2xs cursor-pointer transition-colors ${
              activeTab === "FOLLOW_UP" ? "ring-2 ring-amber-400 bg-amber-50/20" : ""
            }`}
            onClick={() => {
              setActiveTab("FOLLOW_UP");
              setCurrentPage(1);
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                  Requires Staff Follow-Up
                </span>
                <Badge variant="urgent" size="sm" className="h-5 px-1.5 text-[10px]">
                  Queue
                </Badge>
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-800">
                {summaryCounts.requiresFollowUp}
              </div>
              <span className="text-[11px] text-amber-600 font-medium">
                Capacity full / Triage queued
              </span>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500 shadow-2xs">
            <CardContent className="p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                Failed / Rolled Back
              </span>
              <div className="mt-1 text-2xl font-bold text-rose-800">
                {summaryCounts.failed}
              </div>
              <span className="text-[11px] text-rose-600 font-medium">
                Safely aborted (no duplicate writes)
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Primary Tabs: All Actions vs Staff Follow-Up Queue */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
          <button
            onClick={() => {
              setActiveTab("ALL");
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 -mb-[5px] ${
              activeTab === "ALL"
                ? "border-[#0C5DB8] text-[#0C5DB8] bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>All AI Actions ({summaryCounts.total})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("FOLLOW_UP");
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 -mb-[5px] ${
              activeTab === "FOLLOW_UP"
                ? "border-amber-500 text-amber-900 bg-amber-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserCheck className="h-4 w-4 text-amber-600" />
            <span>Staff Follow-Up Queue</span>
            {summaryCounts.requiresFollowUp > 0 && (
              <Badge variant="urgent" size="sm" className="h-4.5 px-1.5 text-[10px]">
                {summaryCounts.requiresFollowUp}
              </Badge>
            )}
          </button>
        </div>

        {/* Filter Controls Card */}
        <Card className="shadow-2xs border-slate-200">
          <CardContent className="p-4 space-y-3.5">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search input */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Action ID, Linked Call (call_901), Doctor, Patient, or HMS Ref..."
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
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-8 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
              {/* Date Filter */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => {
                    setDateRange(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value="ALL">All Dates</option>
                  <option value="Today">Today</option>
                  <option value="Yesterday">Yesterday</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                </select>
              </div>

              {/* Action Category / Type Filter */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Action Category
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value="ALL">All Categories (10)</option>
                  <option value="APPOINTMENT_BOOKING">Appointment Booking</option>
                  <option value="APPOINTMENT_RESCHEDULING">Appointment Rescheduling</option>
                  <option value="APPOINTMENT_CANCELLATION">Appointment Cancellation</option>
                  <option value="APPOINTMENT_AVAILABILITY">Availability Enquiry</option>
                  <option value="HOSPITAL_INFO_PROVIDED">Hospital Info Provided</option>
                  <option value="CONSULTATION_FEE_ENQUIRY">Consultation Fee Enquiry</option>
                  <option value="CALLBACK_REQUESTED">Callback Requested</option>
                  <option value="CALL_TRANSFERRED_TO_STAFF">Staff Transfer</option>
                  <option value="UNRESOLVED_ENQUIRY">Unresolved Enquiry</option>
                  <option value="OTHER_ACTION">Other Action</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Execution Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value="ALL">All Statuses (7)</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="REQUIRES_STAFF_FOLLOW_UP">Requires Staff Follow-up</option>
                  <option value="FAILED">Failed</option>
                  <option value="PENDING_VERIFICATION">Pending Verification</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REQUESTED">Requested</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Items per page */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Rows Per Page
                </label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-[#0C5DB8] focus:outline-none"
                >
                  <option value={8}>8 rows</option>
                  <option value={12}>12 rows</option>
                  <option value={20}>20 rows</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Handling */}
        {error && (
          <ErrorState
            title="Failed to Load AI Actions"
            message={error}
            onRetry={() => {
              setIsLoading(true);
              setCurrentPage(1);
            }}
          />
        )}

        {/* Actions Table Card */}
        <Card className="shadow-xs border-slate-200 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : actions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                <CalendarCheck className="h-9 w-9 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Action Records Found</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  {activeTab === "FOLLOW_UP"
                    ? "No actions currently require staff follow-up triage."
                    : "No hospital AI actions match the current search query and filter criteria."}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
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
                      {/* 1. Timestamp */}
                      <th
                        scope="col"
                        onClick={() => handleSort("requestedAt")}
                        className="py-3 px-3.5 cursor-pointer hover:bg-slate-100/80"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Timestamp</span>
                          {sortBy === "requestedAt" ? (
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

                      {/* 2. Linked Call */}
                      <th scope="col" className="py-3 px-3.5">
                        Linked Call
                      </th>

                      {/* 3. Masked Caller */}
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

                      {/* 4. Action Type */}
                      <th
                        scope="col"
                        onClick={() => handleSort("actionType")}
                        className="py-3 px-3.5 cursor-pointer hover:bg-slate-100/80"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Action Type</span>
                          {sortBy === "actionType" && (
                            sortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-[#0C5DB8]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#0C5DB8]" />
                            )
                          )}
                        </div>
                      </th>

                      {/* 5. Doctor / Dept */}
                      <th scope="col" className="py-3 px-3.5">
                        Doctor & Department
                      </th>

                      {/* 6. Result */}
                      <th
                        scope="col"
                        onClick={() => handleSort("status")}
                        className="py-3 px-3.5 cursor-pointer hover:bg-slate-100/80"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Result</span>
                          {sortBy === "status" && (
                            sortOrder === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-[#0C5DB8]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#0C5DB8]" />
                            )
                          )}
                        </div>
                      </th>

                      {/* 7. HMS Reference */}
                      <th scope="col" className="py-3 px-3.5">
                        HMS Reference
                      </th>

                      {/* 8. Error / Follow-up */}
                      <th scope="col" className="py-3 px-3.5">
                        Follow-Up / Error
                      </th>

                      {/* 9. Action / Detail */}
                      <th scope="col" className="py-3 px-3.5 text-right">
                        Audit Detail
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {actions.map((act) => {
                      const statusVariant = getStatusBadgeVariant(act.status);
                      const hasFollowUp =
                        act.status === "REQUIRES_STAFF_FOLLOW_UP" ||
                        act.errorDetails?.followUpRequired;

                      return (
                        <tr
                          key={act.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          {/* 1. Timestamp */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">
                              {formatDateTime(act.requestedAt)}
                            </div>
                            {act.timingDetails?.latencyMs ? (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Latency: {act.timingDetails.latencyMs}ms
                              </div>
                            ) : null}
                          </td>

                          {/* 2. Linked Call */}
                          <td className="py-3 px-3.5">
                            <Link
                              href={`/calls/${act.callId}`}
                              className="font-mono font-semibold text-[#0C5DB8] hover:underline flex items-center gap-1 text-[11px]"
                              title={`View full call session ${act.callId}`}
                            >
                              <span>{act.callId}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>

                          {/* 3. Masked Caller */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-mono text-slate-800">
                              {revealPhones
                                ? act.callerNumber
                                : maskPhoneNumber(act.callerNumber)}
                            </div>
                            {act.patientName && (
                              <div className="text-[11px] text-slate-500 font-medium truncate max-w-[120px]">
                                {act.patientName}
                              </div>
                            )}
                          </td>

                          {/* 4. Action Type */}
                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-slate-900 leading-tight">
                              {act.actionType.replace(/_/g, " ")}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {act.id}
                            </div>
                          </td>

                          {/* 5. Doctor & Department (Only if returned and necessary) */}
                          <td className="py-3 px-3.5 max-w-[180px]">
                            {act.doctorName ? (
                              <div>
                                <p className="font-semibold text-slate-800 truncate">
                                  {act.doctorName}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {act.department}
                                </p>
                              </div>
                            ) : act.department ? (
                              <p className="text-slate-600 truncate">{act.department}</p>
                            ) : (
                              <span className="text-slate-400 italic">Hospital Wide</span>
                            )}
                          </td>

                          {/* 6. Result (Status Badge) */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <Badge variant={statusVariant} size="sm">
                              {act.status.replace(/_/g, " ")}
                            </Badge>
                          </td>

                          {/* 7. HMS Reference */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {act.hmsBookingRef ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono font-bold text-[#0C5DB8] bg-[#E8F2FC] px-1.5 py-0.5 rounded text-[11px]">
                                  {act.hmsBookingRef}
                                </span>
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                No write ref
                              </span>
                            )}
                          </td>

                          {/* 8. Error / Follow-up Indicator */}
                          <td className="py-3 px-3.5">
                            {hasFollowUp ? (
                              <div className="flex items-center gap-1.5 text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                <span className="text-[11px] font-semibold truncate max-w-[130px]">
                                  {act.assignedStaff ? act.assignedStaff.split(" ")[0] : "Staff Follow-Up"}
                                </span>
                              </div>
                            ) : act.status === "FAILED" ? (
                              <span className="text-rose-600 text-[11px] font-semibold truncate max-w-[130px] block">
                                {act.errorDetails?.code || "Gateway Timeout"}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Resolved</span>
                            )}
                          </td>

                          {/* 9. Action / Detail Button */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDrawer(act)}
                              className="h-7 text-xs text-[#0C5DB8] hover:bg-blue-50"
                            >
                              <FileCode className="h-3.5 w-3.5 mr-1" />
                              Detail
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && actions.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 px-4 py-3 gap-3 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-800">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-slate-800">
                    {Math.min(currentPage * itemsPerPage, totalCount)}
                  </span>{" "}
                  of <span className="font-semibold text-slate-800">{totalCount}</span>{" "}
                  actions
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="h-7 px-2.5 text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-slate-600 px-1 font-mono">
                    {currentPage} / {totalPages}
                  </span>
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
      </div>

      {/* Action Detail Drawer */}
      <ActionDetailDrawer
        action={selectedAction}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onActionUpdated={handleActionUpdated}
      />
    </DashboardLayout>
  );
}

function ActionsSkeleton() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </DashboardLayout>
  );
}

export default function AiActionsPage() {
  return (
    <React.Suspense fallback={<ActionsSkeleton />}>
      <ActionsContent />
    </React.Suspense>
  );
}
