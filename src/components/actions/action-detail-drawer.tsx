"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Clock,
  UserCheck,
  FileCode,
  RefreshCw,
  Phone,
  Eye,
  EyeOff,
  CalendarCheck,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { AiActionDetail } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { maskPhoneNumber, formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { actionsService } from "@/lib/services/actions-service";

interface ActionDetailDrawerProps {
  action: AiActionDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onActionUpdated?: (updated: AiActionDetail) => void;
}

export function ActionDetailDrawer({
  action,
  isOpen,
  onClose,
  onActionUpdated,
}: ActionDetailDrawerProps) {
  if (!isOpen || !action) return null;

  return (
    <ActionDetailDrawerContent
      key={action.id}
      action={action}
      onClose={onClose}
      onActionUpdated={onActionUpdated}
    />
  );
}

function ActionDetailDrawerContent({
  action,
  onClose,
  onActionUpdated,
}: {
  action: AiActionDetail;
  onClose: () => void;
  onActionUpdated?: (updated: AiActionDetail) => void;
}) {
  const { showToast } = useToast();
  const [currentAction, setCurrentAction] = React.useState<AiActionDetail>(action);
  const [revealPhone, setRevealPhone] = React.useState(false);
  const [isVerifyingHms, setIsVerifyingHms] = React.useState(false);

  // Staff review form state
  const [reviewNote, setReviewNote] = React.useState(action.staffNotes || "");
  const [assignedStaff, setAssignedStaff] = React.useState(action.assignedStaff || "");
  const [isSavingReview, setIsSavingReview] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleSaveNote = async () => {
    if (!reviewNote.trim()) {
      showToast({
        type: "warning",
        title: "Note Empty",
        message: "Please enter staff notes before saving.",
      });
      return;
    }

    setIsSavingReview(true);
    try {
      const updated = await actionsService.updateStaffReview(currentAction.id, {
        reviewerName: "Dr. Anjali Menon",
        reviewerId: "staff_anjali",
        notes: reviewNote.trim(),
        assignedStaff: assignedStaff.trim() || undefined,
      });

      if (updated) {
        setCurrentAction(updated);
        onActionUpdated?.(updated);
        showToast({
          type: "success",
          title: "Note Saved",
          message: "Internal audit note recorded successfully.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Save Failed",
        message: "Could not save staff note.",
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleAssignStaff = async (staffName: string) => {
    setIsSavingReview(true);
    try {
      const updated = await actionsService.updateStaffReview(currentAction.id, {
        reviewerName: "Dr. Anjali Menon",
        reviewerId: "staff_anjali",
        assignedStaff: staffName,
      });

      if (updated) {
        setAssignedStaff(staffName);
        setCurrentAction(updated);
        onActionUpdated?.(updated);
        showToast({
          type: "success",
          title: "Staff Assigned",
          message: `Follow-up assigned to ${staffName}.`,
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Assignment Failed",
        message: "Could not assign staff member.",
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleToggleReviewed = async () => {
    setIsSavingReview(true);
    try {
      const newReviewed = !currentAction.isReviewed;
      const updated = await actionsService.updateStaffReview(currentAction.id, {
        reviewerName: "Dr. Anjali Menon",
        reviewerId: "staff_anjali",
        markReviewed: newReviewed,
      });

      if (updated) {
        setCurrentAction(updated);
        onActionUpdated?.(updated);
        showToast({
          type: "success",
          title: newReviewed ? "Action Reviewed" : "Review Cleared",
          message: newReviewed
            ? `Action #${currentAction.id} marked as reviewed.`
            : `Review mark cleared from #${currentAction.id}.`,
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Update Failed",
        message: "Could not update review status.",
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleResolveFollowUp = async () => {
    setIsSavingReview(true);
    try {
      const updated = await actionsService.updateStaffReview(currentAction.id, {
        reviewerName: "Dr. Anjali Menon",
        reviewerId: "staff_anjali",
        notes: reviewNote.trim() || "Clinical follow-up resolved with patient.",
        markResolved: true,
      });

      if (updated) {
        setCurrentAction(updated);
        onActionUpdated?.(updated);
        showToast({
          type: "success",
          title: "Follow-Up Resolved",
          message: `Follow-up resolution logged for action #${currentAction.id}.`,
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Resolution Failed",
        message: "Could not resolve follow-up.",
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleAuthoritativeHmsVerify = async () => {
    setIsVerifyingHms(true);
    try {
      const res = await actionsService.verifyWithHms(
        currentAction.id,
        "Dr. Anjali Menon"
      );

      if (res.action) {
        setCurrentAction(res.action);
        onActionUpdated?.(res.action);
      }

      if (res.success) {
        showToast({
          type: "success",
          title: "HMS Verified Active",
          message: res.message,
        });
      } else {
        showToast({
          type: "error",
          title: "HMS Verification Failed",
          message: res.message,
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Verification Error",
        message: "Failed to communicate with Daya Hospital HMS adapter.",
      });
    } finally {
      setIsVerifyingHms(false);
    }
  };

  const statusVariant =
    currentAction.status === "CONFIRMED"
      ? "teal"
      : currentAction.status === "FAILED"
      ? "danger"
      : currentAction.status === "REQUIRES_STAFF_FOLLOW_UP"
      ? "urgent"
      : currentAction.status === "PENDING_VERIFICATION"
      ? "warning"
      : currentAction.status === "IN_PROGRESS"
      ? "info"
      : "secondary";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 z-10 overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-slate-900">
                {currentAction.id}
              </span>
              <Badge variant={statusVariant} size="sm">
                {currentAction.status.replace(/_/g, " ")}
              </Badge>
              {currentAction.isReviewed && (
                <Badge variant="success" size="sm" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Reviewed
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {currentAction.actionType.replace(/_/g, " ")} &bull;{" "}
              {formatDateTime(currentAction.requestedAt)}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* Section 1: Linked Call Details */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#0C5DB8]" />
                1. Linked Call Details
              </span>
              <Link
                href={`/calls/${currentAction.callId}`}
                className="text-xs text-[#0C5DB8] hover:underline flex items-center gap-1 font-semibold"
                target="_blank"
              >
                <span>Open Full Call Record</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">Linked Call ID:</span>
                <p className="font-mono font-semibold text-slate-800">
                  {currentAction.callId}
                </p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium">Caller Number:</span>
                <div className="flex items-center gap-2 mt-0.5 font-mono">
                  <span className="font-semibold text-slate-900">
                    {revealPhone
                      ? currentAction.callerNumber
                      : maskPhoneNumber(currentAction.callerNumber)}
                  </span>
                  <button
                    onClick={() => setRevealPhone(!revealPhone)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={revealPhone ? "Mask phone number" : "Reveal full number for audit"}
                  >
                    {revealPhone ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {currentAction.patientName && (
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">Patient Name:</span>
                  <p className="font-semibold text-slate-800">
                    {currentAction.patientName}
                  </p>
                </div>
              )}

              {currentAction.patientUhid && (
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">Patient UHID:</span>
                  <p className="font-mono font-semibold text-[#0C5DB8]">
                    {currentAction.patientUhid}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: What the caller requested vs What the AI attempted */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Activity className="h-3.5 w-3.5 text-[#18A99D]" />
              2. Clinical Dialogue Synthesis
            </span>

            <div className="space-y-2">
              <div>
                <span className="font-semibold text-slate-500 text-[11px] uppercase">
                  What the caller requested:
                </span>
                <p className="mt-1 rounded bg-slate-50 p-2.5 text-slate-800 border border-slate-100 leading-relaxed">
                  {currentAction.callerRequestSummary || "Caller requested outpatient assistance."}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-500 text-[11px] uppercase">
                  What the AI voice assistant attempted:
                </span>
                <p className="mt-1 rounded bg-[#EAF7F6]/60 p-2.5 text-[#0E7A71] border border-[#18A99D]/20 leading-relaxed font-medium">
                  {currentAction.aiAttemptSummary || "AI processed outpatient enquiry against Daya knowledge base."}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Sanitized Action Payload Summary */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5 text-[#0C5DB8]" />
                3. Sanitized Action Payload Summary
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-semibold">
                Protected: Secrets & Tokens Stripped
              </span>
            </div>

            <pre className="rounded-lg bg-slate-900 p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-40 leading-relaxed">
              {JSON.stringify(currentAction.sanitizedPayload || currentAction.payload || {}, null, 2)}
            </pre>
          </div>

          {/* Section 4: HMS Result Summary & Booking Reference */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <CalendarCheck className="h-3.5 w-3.5 text-[#0C5DB8]" />
              4. HMS Outcome & Reference Tokens
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">HMS Booking Reference:</span>
                <div className="mt-0.5">
                  {currentAction.hmsBookingRef ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#0C5DB8] bg-[#E8F2FC] px-2 py-0.5 rounded">
                        {currentAction.hmsBookingRef}
                      </span>
                      <span title="HMS Verified">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No external write token</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 font-medium">HMS Transaction ID:</span>
                <p className="mt-0.5 font-mono text-slate-700">
                  {currentAction.hmsTransactionId || "N/A"}
                </p>
              </div>

              {currentAction.doctorName && (
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">Doctor:</span>
                  <p className="font-semibold text-slate-900">{currentAction.doctorName}</p>
                </div>
              )}

              {currentAction.department && (
                <div>
                  <span className="text-[11px] text-slate-400 font-medium">Department:</span>
                  <p className="font-medium text-slate-700">{currentAction.department}</p>
                </div>
              )}

              {currentAction.appointmentSlot && (
                <div className="col-span-2">
                  <span className="text-[11px] text-slate-400 font-medium">Allocated Slot:</span>
                  <p className="font-semibold text-slate-800">{currentAction.appointmentSlot}</p>
                </div>
              )}
            </div>

            {currentAction.hmsResultSummary && (
              <div className="mt-2 rounded bg-slate-50 p-2.5 text-slate-700 border border-slate-100">
                <span className="font-bold text-slate-600 block text-[10px] uppercase mb-0.5">
                  HMS Result Summary:
                </span>
                <p>{currentAction.hmsResultSummary}</p>
              </div>
            )}
          </div>

          {/* Section 5: Timing, Processing Status & Idempotency */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Clock className="h-3.5 w-3.5 text-slate-600" />
              5. Timing, Gateway Status & Idempotency
            </span>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-400">Initiated At:</span>
                <p className="font-mono text-slate-800 font-medium">
                  {formatDateTime(currentAction.timingDetails?.initiatedAt || currentAction.requestedAt)}
                </p>
              </div>

              <div>
                <span className="text-slate-400">Completed At:</span>
                <p className="font-mono text-slate-800 font-medium">
                  {currentAction.completedAt ? formatDateTime(currentAction.completedAt) : "Pending"}
                </p>
              </div>

              <div>
                <span className="text-slate-400">Processing Latency:</span>
                <p className="font-mono font-semibold text-slate-900">
                  {currentAction.timingDetails?.latencyMs
                    ? `${currentAction.timingDetails.latencyMs}ms`
                    : "—"}
                </p>
              </div>

              <div>
                <span className="text-slate-400">Retry Count:</span>
                <p className="font-mono font-semibold text-slate-900">
                  {currentAction.retryAttempts || 0} attempts
                </p>
              </div>

              <div className="col-span-2">
                <span className="text-slate-400">Idempotency Key:</span>
                <p className="font-mono text-slate-700 text-[10px] bg-slate-50 p-1.5 rounded border border-slate-100 break-all">
                  {currentAction.idempotencyKey}
                </p>
              </div>
            </div>
          </div>

          {/* Section 6: Staff-Safe Error Details (when failed / follow-up required) */}
          {(currentAction.status === "FAILED" ||
            currentAction.status === "REQUIRES_STAFF_FOLLOW_UP" ||
            currentAction.errorDetails ||
            currentAction.failureReason) && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4 shadow-2xs space-y-2">
              <span className="font-bold text-rose-950 uppercase text-[11px] tracking-wide flex items-center gap-1.5 border-b border-rose-200 pb-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                6. Staff-Safe Error Details & Triage Notice
              </span>

              <div className="space-y-1 text-xs text-rose-900">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-rose-950">Error Code:</span>
                  <span className="font-mono font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded text-[10px]">
                    {currentAction.errorDetails?.code || "HMS_ERROR"}
                  </span>
                </div>
                <p className="leading-relaxed">
                  {currentAction.errorDetails?.safeMessage ||
                    currentAction.failureReason ||
                    "Action requires manual hospital staff verification."}
                </p>
              </div>
            </div>
          )}

          {/* Section 7: Staff Clinical Follow-Up & Audit Trail */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wide flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-[#0C5DB8]" />
                7. Staff Clinical Follow-Up & Audit Trail
              </span>
              <Button
                variant={currentAction.isReviewed ? "outline" : "default"}
                size="sm"
                onClick={handleToggleReviewed}
                disabled={isSavingReview}
                className="h-7 text-xs"
              >
                {currentAction.isReviewed ? "Clear Reviewed" : "Mark as Reviewed"}
              </Button>
            </div>

            {/* Note & Staff Assigner */}
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Assign Staff Member:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={assignedStaff}
                    onChange={(e) => handleAssignStaff(e.target.value)}
                    disabled={isSavingReview}
                    className="w-full rounded border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-[#0C5DB8] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    <option value="Sister Mary (Cardiology Triage)">Sister Mary (Cardiology Triage)</option>
                    <option value="Sister Bindu (Home Care)">Sister Bindu (Home Care)</option>
                    <option value="Srikanth M. (OP Registrar)">Srikanth M. (OP Registrar)</option>
                    <option value="Remya S. (Senior Medical Social Worker)">Remya S. (Medical Social Worker)</option>
                    <option value="Sreejith K. (OP Desk)">Sreejith K. (OP Desk)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Internal Reviewer Observation / Clinical Notes:
                </label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Record patient communication outcome, token booking instruction, or alternative doctor slot..."
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0C5DB8] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  {/* Authoritative HMS check */}
                  {currentAction.hmsBookingRef && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAuthoritativeHmsVerify}
                      disabled={isVerifyingHms}
                      className="h-8 text-xs text-emerald-700 hover:bg-emerald-50 gap-1.5"
                      title="Re-query Daya HMS to verify booking token authoritative status"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isVerifyingHms ? "animate-spin" : ""}`} />
                      <span>{isVerifyingHms ? "Verifying..." : "Verify with HMS"}</span>
                    </Button>
                  )}

                  {currentAction.status === "REQUIRES_STAFF_FOLLOW_UP" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResolveFollowUp}
                      disabled={isSavingReview}
                      className="h-8 text-xs text-[#0C5DB8] hover:bg-blue-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Resolve Follow-Up
                    </Button>
                  )}
                </div>

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveNote}
                  disabled={isSavingReview}
                  className="h-8 text-xs"
                >
                  {isSavingReview ? "Saving..." : "Save Note"}
                </Button>
              </div>
            </div>

            {/* Audit History */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <span className="font-semibold text-slate-500 text-[10px] uppercase">
                Audit Trail & Review History:
              </span>
              {(!currentAction.reviewHistory || currentAction.reviewHistory.length === 0) ? (
                <p className="text-slate-400 italic text-[11px]">
                  No staff actions recorded yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {currentAction.reviewHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded border border-slate-100 bg-slate-50/70 p-2 text-[11px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {entry.reviewerName}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {formatDateTime(entry.timestamp)}
                        </span>
                      </div>
                      <Badge variant="outline" size="sm" className="text-[10px]">
                        {entry.action.replace(/_/g, " ")}
                      </Badge>
                      {entry.notes && (
                        <p className="text-slate-600 mt-1 pl-1.5 border-l-2 border-slate-300">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Daya Hospital Clinical Governance Guard Active
          </span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
