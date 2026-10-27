"use client";

import * as React from "react";
import {
  Search,
  ShieldCheck,
  FileCode,
  ExternalLink,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { CallDetailModal } from "@/components/calls/call-detail-modal";
import { MOCK_AI_ACTIONS, MOCK_CALL_RECORDS } from "@/lib/mock-data";
import { AiActionDetail, CallRecord } from "@/types";
import { formatDateTime, maskPhoneNumber } from "@/lib/utils";

export default function AiActionsPage() {
  const [actions, setActions] = React.useState<AiActionDetail[]>(MOCK_AI_ACTIONS);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [selectedAction, setSelectedAction] = React.useState<AiActionDetail | null>(null);
  const [isPayloadModalOpen, setIsPayloadModalOpen] = React.useState(false);
  const [selectedCall, setSelectedCall] = React.useState<CallRecord | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = React.useState(false);

  // Computed summary counts
  const totalActions = actions.length;
  const confirmedCount = actions.filter((a) => a.status === "CONFIRMED").length;
  const followUpCount = actions.filter(
    (a) => a.status === "REQUIRES_STAFF_FOLLOW_UP"
  ).length;
  const failedCount = actions.filter((a) => a.status === "FAILED").length;
  const pendingCount = actions.filter(
    (a) => a.status === "PENDING_VERIFICATION" || a.status === "IN_PROGRESS"
  ).length;

  // Filtered actions
  const filteredActions = React.useMemo(() => {
    return actions.filter((action) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesRef = action.hmsBookingRef?.toLowerCase().includes(query);
        const matchesDoctor = action.doctorName?.toLowerCase().includes(query);
        const matchesPatient = action.patientName?.toLowerCase().includes(query);
        const matchesPhone = action.callerNumber.toLowerCase().includes(query);
        const matchesIdem = action.idempotencyKey.toLowerCase().includes(query);
        const matchesCall = action.callId.toLowerCase().includes(query);
        if (
          !matchesRef &&
          !matchesDoctor &&
          !matchesPatient &&
          !matchesPhone &&
          !matchesIdem &&
          !matchesCall
        ) {
          return false;
        }
      }

      if (statusFilter !== "ALL" && action.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== "ALL" && action.actionType !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [actions, searchQuery, statusFilter, typeFilter]);

  const handleOpenPayload = (action: AiActionDetail) => {
    setSelectedAction(action);
    setIsPayloadModalOpen(true);
  };

  const handleOpenRelatedCall = (callId: string) => {
    const foundCall = MOCK_CALL_RECORDS.find((c) => c.id === callId);
    if (foundCall) {
      setSelectedCall(foundCall);
      setIsCallModalOpen(true);
    }
  };

  const handleManualVerify = (actionId: string) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === actionId
          ? {
              ...a,
              status: "CONFIRMED",
              hmsBookingRef: a.hmsBookingRef || `MANUAL-VERIFY-${Date.now().toString().slice(-5)}`,
              staffNotes: "Manually re-verified with Daya Hospital OPD registrar.",
            }
          : a
      )
    );
    alert(`Action ${actionId} re-verified with Daya HMS.`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                AI Actions & HMS Status Ledger
              </h1>
              <Badge variant="teal" size="sm">
                Idempotency Guard Active
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Audit trail of every doctor availability check, slot booking, reschedule, and staff handoff
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Rule: Appointments only marked confirmed upon HMS HTTP 200 response
            </span>
          </div>
        </div>

        {/* Action Status Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-[#0C5DB8]">
            <CardContent className="p-4">
              <span className="text-[11px] font-semibold uppercase text-slate-500">
                Total HMS Actions
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {totalActions}
                </span>
                {pendingCount > 0 && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                    {pendingCount} in flight
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                Processed via Sarvam agent
              </span>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-600">
            <CardContent className="p-4">
              <span className="text-[11px] font-semibold uppercase text-emerald-700">
                HMS Confirmed
              </span>
              <div className="mt-1 text-2xl font-bold text-emerald-800">
                {confirmedCount}
              </div>
              <span className="text-[11px] text-emerald-600 font-medium">
                Verified with transaction ID
              </span>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <span className="text-[11px] font-semibold uppercase text-amber-700">
                Staff Follow-Up Needed
              </span>
              <div className="mt-1 text-2xl font-bold text-amber-800">
                {followUpCount}
              </div>
              <span className="text-[11px] text-amber-600 font-medium">
                Capacity full / Priority triage
              </span>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500">
            <CardContent className="p-4">
              <span className="text-[11px] font-semibold uppercase text-rose-700">
                Failed / Aborted
              </span>
              <div className="mt-1 text-2xl font-bold text-rose-800">
                {failedCount}
              </div>
              <span className="text-[11px] text-rose-600 font-medium">
                Safely rolled back (no duplicates)
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by HMS Reference, Doctor, Patient UHID, Idempotency key..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
                <span className="text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="REQUIRES_STAFF_FOLLOW_UP">Requires Staff Follow-up</option>
                  <option value="FAILED">Failed</option>
                  <option value="IN_PROGRESS">In Progress</option>
                </select>
              </div>

              {/* Action Type Filter */}
              <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
                <span className="text-slate-500">Action Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                >
                  <option value="ALL">All Action Types</option>
                  <option value="BOOK_APPOINTMENT">Book Appointment</option>
                  <option value="RESCHEDULE_APPOINTMENT">Reschedule</option>
                  <option value="CANCEL_APPOINTMENT">Cancel</option>
                  <option value="CHECK_DOCTOR_SLOT">Check Doctor Slot</option>
                  <option value="TRANSFER_CALL_TO_STAFF">Staff Transfer</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Action Type & ID</th>
                  <th className="py-3.5 px-4">Execution Status</th>
                  <th className="py-3.5 px-4">HMS Booking Reference</th>
                  <th className="py-3.5 px-4">Doctor & Department</th>
                  <th className="py-3.5 px-4">Patient / Slot</th>
                  <th className="py-3.5 px-4">Timestamp (IST)</th>
                  <th className="py-3.5 px-4">Related Call</th>
                  <th className="py-3.5 px-4 text-right">Payload & Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No actions match the current search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredActions.map((act) => (
                    <tr
                      key={act.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Action Type & ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {act.actionType.replace(/_/g, " ")}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {act.id}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            act.status === "CONFIRMED"
                              ? "success"
                              : act.status === "FAILED"
                              ? "danger"
                              : "warning"
                          }
                          size="sm"
                        >
                          {act.status}
                        </Badge>
                        {act.failureReason && (
                          <p className="mt-1 text-[11px] text-rose-600 line-clamp-1 max-w-[200px]" title={act.failureReason}>
                            {act.failureReason}
                          </p>
                        )}
                      </td>

                      {/* HMS Reference */}
                      <td className="py-3.5 px-4">
                        {act.hmsBookingRef ? (
                          <div className="space-y-0.5">
                            <span className="font-mono font-semibold text-[#0C5DB8] bg-[#E8F2FC] px-1.5 py-0.5 rounded text-[11px]">
                              {act.hmsBookingRef}
                            </span>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              <span>HMS Verified</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">
                            No external write ref
                          </span>
                        )}
                      </td>

                      {/* Doctor & Department */}
                      <td className="py-3.5 px-4">
                        {act.doctorName ? (
                          <div>
                            <div className="font-semibold text-slate-800">
                              {act.doctorName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {act.department}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">
                            {act.department || "General Enquiry"}
                          </span>
                        )}
                      </td>

                      {/* Patient & Slot */}
                      <td className="py-3.5 px-4">
                        {act.patientName && (
                          <div className="font-medium text-slate-900">
                            {act.patientName}
                          </div>
                        )}
                        {act.appointmentSlot && (
                          <div className="text-[11px] text-slate-600">
                            {act.appointmentSlot}
                          </div>
                        )}
                        {act.patientUhid && (
                          <div className="text-[10px] font-mono text-slate-400">
                            {act.patientUhid}
                          </div>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-slate-800">
                          {formatDateTime(act.requestedAt)}
                        </div>
                        {act.completedAt && (
                          <div className="text-[10px] text-emerald-600">
                            Completed in 2s
                          </div>
                        )}
                      </td>

                      {/* Related Call */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleOpenRelatedCall(act.callId)}
                          className="flex items-center gap-1 font-mono text-[#0C5DB8] hover:underline text-[11px]"
                        >
                          <span>{act.callId}</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                        <div className="text-[10px] text-slate-400">
                          {maskPhoneNumber(act.callerNumber)}
                        </div>
                      </td>

                      {/* Payload button */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {act.status === "REQUIRES_STAFF_FOLLOW_UP" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleManualVerify(act.id)}
                              className="h-7 text-[11px] px-2 text-emerald-700 hover:bg-emerald-50"
                            >
                              Verify
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPayload(act)}
                            className="h-7 text-xs text-[#0C5DB8]"
                          >
                            <FileCode className="h-3.5 w-3.5 mr-1" />
                            Payload
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Payload Inspection Modal */}
      {selectedAction && (
        <Modal
          isOpen={isPayloadModalOpen}
          onClose={() => setIsPayloadModalOpen(false)}
          maxWidth="2xl"
          title={
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-[#0C5DB8]" />
              <span>HMS Transaction Payload: {selectedAction.id}</span>
            </div>
          }
          description="Exact payload and idempotency key exchanged between Daya AI and Hospital Management System"
        >
          <div className="space-y-4 text-xs">
            {/* Metadata summary */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200">
              <div>
                <span className="text-slate-400 font-medium">Idempotency Key:</span>
                <p className="font-mono font-semibold text-slate-800 break-all">
                  {selectedAction.idempotencyKey}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">HMS Reference:</span>
                <p className="font-mono font-semibold text-[#0C5DB8]">
                  {selectedAction.hmsBookingRef || "N/A (Failed or Read-only)"}
                </p>
              </div>
            </div>

            {/* Request Payload */}
            <div>
              <span className="font-bold text-slate-700 block mb-1">
                HTTP Request Payload (Daya AI &rarr; HMS):
              </span>
              <pre className="rounded-lg bg-slate-900 p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-40">
                {JSON.stringify(selectedAction.payload || { action: selectedAction.actionType }, null, 2)}
              </pre>
            </div>

            {/* Response Payload */}
            {selectedAction.responsePayload && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">
                  HTTP Response Payload (HMS &rarr; Daya AI):
                </span>
                <pre className="rounded-lg bg-slate-900 p-3 text-[11px] font-mono text-sky-400 overflow-x-auto max-h-40">
                  {JSON.stringify(selectedAction.responsePayload, null, 2)}
                </pre>
              </div>
            )}

            {/* Failure reason if any */}
            {selectedAction.failureReason && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800">
                <span className="font-bold block">Failure / Exception Trace:</span>
                <p className="mt-1 font-mono text-[11px]">
                  {selectedAction.failureReason}
                </p>
              </div>
            )}

            {/* Staff notes */}
            {selectedAction.staffNotes && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900">
                <span className="font-bold block">Hospital Staff Audit Notes:</span>
                <p className="mt-1">{selectedAction.staffNotes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPayloadModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Related Call Detail Modal */}
      <CallDetailModal
        call={selectedCall}
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
      />
    </DashboardLayout>
  );
}
