"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Search,
  Eye,
  EyeOff,
  UserCheck,
  CalendarCheck,
  Database,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/components/ui/toast";
import { CallRecord } from "@/types";
import { callsService } from "@/lib/services/calls-service";
import { maskPhoneNumber, formatDuration, formatDateTime } from "@/lib/utils";

interface CallDetailClientProps {
  callId: string;
}

export default function CallDetailClient({ callId }: CallDetailClientProps) {
  const { showToast } = useToast();

  const [call, setCall] = React.useState<CallRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Privacy reveal toggle
  const [revealPhone, setRevealPhone] = React.useState(false);

  // Transcript search
  const [transcriptSearch, setTranscriptSearch] = React.useState("");

  // Audio player state
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackProgress, setPlaybackProgress] = React.useState(0);
  const [audioSpeed, setAudioSpeed] = React.useState(1);

  // Staff Review Form
  const [reviewNotes, setReviewNotes] = React.useState("");
  const [isSavingReview, setIsSavingReview] = React.useState(false);

  // Load call
  React.useEffect(() => {
    let isMounted = true;

    callsService
      .getCallById(callId)
      .then((data) => {
        if (isMounted) {
          if (!data) {
            setError(`Call record #${callId} could not be found.`);
          } else {
            setCall(data);
            setReviewNotes(data.followUpNotes || "");
          }
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load call session."
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [callId]);

  // Audio simulation timer
  React.useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setPlaybackProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1.5 * audioSpeed;
        });
      }, 500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, audioSpeed]);

  const handleToggleReviewed = async () => {
    if (!call) return;
    setIsSavingReview(true);
    try {
      const updated = await callsService.updateCallReview(call.id, {
        isReviewed: !call.isReviewed,
        reviewerName: "Dr. Anjali Menon",
        reviewerId: "staff_anjali",
        notes: reviewNotes || (call.isReviewed ? "Marked as unreviewed" : "Marked as reviewed by staff"),
      });
      if (updated) {
        setCall(updated);
        showToast({
          type: "success",
          title: updated.isReviewed ? "Call Reviewed" : "Review Cleared",
          message: updated.isReviewed
            ? `Call #${call.id} has been marked as reviewed.`
            : `Review status removed from #${call.id}.`,
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Update Failed",
        message: "Failed to update review status.",
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleToggleFollowUp = async () => {
    if (!call) return;
    setIsSavingReview(true);
    try {
      const newStatus = !call.requiresFollowUp;
      const updated = await callsService.updateCallReview(call.id, {
        requiresFollowUp: newStatus,
        followUpStatus: newStatus ? "PENDING" : "RESOLVED",
        reviewerName: "Dr. Anjali Menon",
        reviewerId: "staff_anjali",
        notes: newStatus
          ? "Clinical follow-up requested by supervisor"
          : "Follow-up completed and resolved with patient",
      });
      if (updated) {
        setCall(updated);
        showToast({
          type: "success",
          title: newStatus ? "Follow-Up Required" : "Follow-Up Completed",
          message: newStatus
            ? `Call #${call.id} is flagged for staff follow-up.`
            : `Call #${call.id} follow-up marked completed.`,
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Update Failed",
        message: "Could not update follow-up status.",
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!call) return;
    if (!reviewNotes.trim()) {
      showToast({
        type: "warning",
        title: "Note Empty",
        message: "Please enter internal notes before saving.",
      });
      return;
    }
    setIsSavingReview(true);
    try {
      const updated = await callsService.updateCallReview(call.id, {
        reviewerName: "Dr. Anjali Menon",
        reviewerId: "staff_anjali",
        notes: reviewNotes.trim(),
      });
      if (updated) {
        setCall(updated);
        showToast({
          type: "success",
          title: "Review Note Saved",
          message: "Internal clinical note appended to audit trail.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Failed to Save Note",
        message: "Internal review note could not be saved.",
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  // Filtered transcript search
  const transcriptList = call?.transcript || [];
  const filteredTranscript = !transcriptSearch.trim()
    ? transcriptList
    : transcriptList.filter(
        (entry) =>
          entry.text.toLowerCase().includes(transcriptSearch.toLowerCase().trim()) ||
          (entry.malayalamText &&
            entry.malayalamText.includes(transcriptSearch.trim())) ||
          entry.speakerName
            .toLowerCase()
            .includes(transcriptSearch.toLowerCase().trim())
      );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl md:col-span-2" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !call) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Link href="/calls">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Call History</span>
            </Button>
          </Link>
          <ErrorState
            title="Call Record Not Found"
            message={error || "The requested call session could not be retrieved."}
            onRetry={() => window.location.reload()}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="space-y-2">
          <Link href="/calls">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-slate-600 hover:text-slate-900 -ml-2 h-7"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Call History</span>
            </Button>
          </Link>

          <PageHeader
            title={`Call Details: ${call.id}`}
            description="Clinical and administrative audit record of inbound AI interaction, HMS transactions, and staff notes."
            badge={
              <div className="flex items-center gap-2">
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
                {call.isReviewed && (
                  <Badge variant="success" size="sm" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Reviewed
                  </Badge>
                )}
                {call.requiresFollowUp && (
                  <Badge variant="urgent" size="sm" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Follow-Up Required
                  </Badge>
                )}
              </div>
            }
            breadcrumbs={[
              { label: "Overview", href: "/overview" },
              { label: "Call History", href: "/calls" },
              { label: call.id },
            ]}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevealPhone(!revealPhone)}
                  className="gap-1.5 text-xs"
                  title="Toggle caller phone masking for clinical audit"
                >
                  {revealPhone ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                      <span>Mask Number</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      <span>Reveal Number (Audit)</span>
                    </>
                  )}
                </Button>

                <Button
                  variant={call.isReviewed ? "outline" : "default"}
                  size="sm"
                  onClick={handleToggleReviewed}
                  disabled={isSavingReview}
                  className="gap-1.5 text-xs"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{call.isReviewed ? "Mark as Unreviewed" : "Mark as Reviewed"}</span>
                </Button>
              </div>
            }
          />
        </div>

        {/* Top Grid: Section A (Call Information) + Section B (AI Summary) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section A: Call Information */}
          <Card className="border-slate-200 shadow-2xs lg:col-span-1">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-[#0C5DB8]" />
                <span>A. Call Information</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Telephony routing and caller identification
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Internal Call ID:</span>
                <p className="font-mono font-bold text-slate-900">{call.id}</p>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Sarvam Session ID:</span>
                <span className="font-mono text-slate-700">
                  {call.externalCallId || "—"}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Call Time:</span>
                <span className="text-slate-800 font-medium">
                  {formatDateTime(call.startTime)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Call Duration:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatDuration(call.durationSeconds)} ({call.durationSeconds}s)
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 items-center">
                <span className="text-slate-500 font-medium">Caller Number:</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-slate-900">
                    {revealPhone ? call.callerNumber : maskPhoneNumber(call.callerNumber)}
                  </span>
                  {!revealPhone && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded">
                      Masked
                    </span>
                  )}
                </div>
              </div>

              {call.callerName && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Patient Name:</span>
                  <span className="font-semibold text-slate-800">
                    {call.callerName}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Spoken Language:</span>
                <Badge variant="outline" size="sm" className="font-semibold">
                  {call.language}
                </Badge>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Routing Source:</span>
                <span className="font-medium text-slate-700">
                  {call.callSource === "IVR_ROLLOVER"
                    ? "PBX Rollover (Queue Busy)"
                    : call.callSource === "DIRECT_HOTLINE"
                    ? "Direct AI Hot-line"
                    : "After-Hours Auto Rollover"}
                </span>
              </div>

              <div className="flex justify-between py-1 items-center">
                <span className="text-slate-500 font-medium">Current Outcome:</span>
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
              </div>
            </CardContent>
          </Card>

          {/* Section B: AI Conversation Summary */}
          <Card className="border-slate-200 shadow-2xs lg:col-span-2">
            <CardHeader className="pb-3 border-b border-slate-100 bg-[#F5F8FC]/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#18A99D]" />
                  <span>B. AI Conversation Summary</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">AI Confidence:</span>
                  <Badge variant="teal" size="sm" className="font-mono">
                    {Math.round(call.aiConfidence * 100)}%
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-xs">
                Clinical synthesis generated by Sarvam AI Malayalam Engine
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="rounded-lg bg-white p-4 border border-slate-200/80 shadow-2xs space-y-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Primary Intent & Patient Request:
                  </h4>
                  <p className="text-xs text-slate-800 font-medium bg-[#F5F8FC] p-2.5 rounded border border-slate-100">
                    {call.intentCategory.replace(/_/g, " ")} — {call.aiSummary}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Assistant Actions & Information Provided:
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {call.actions.length > 0
                      ? call.actions.map((a) => a.description).join("; ")
                      : "The AI agent addressed caller hospital enquiries according to verified Daya knowledge bases."}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Resolution Status:</span>
                    <Badge
                      variant={
                        call.requiresFollowUp
                          ? "warning"
                          : call.callStatus === "ANSWERED"
                          ? "success"
                          : "secondary"
                      }
                      size="sm"
                    >
                      {call.requiresFollowUp
                        ? "Pending Staff Follow-up"
                        : call.callStatus === "ANSWERED"
                        ? "Fully Resolved by AI"
                        : "Escalated to Staff Desk"}
                    </Badge>
                  </div>

                  {call.hmsTransactionRef && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span className="text-slate-400">HMS Ref:</span>
                      <span className="font-mono font-bold text-[#0C5DB8]">
                        {call.hmsTransactionRef}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Clinical Verification Notice */}
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-950">Clinical Governance Policy</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Do not infer successful appointment booking from transcript dialogue alone. Verified hospital bookings require an official confirmation token in Section E (HMS Results).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section C: Conversation Transcript */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#0C5DB8]" />
                  <span>C. Conversation Transcript</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Full chronological audio transcription with bilingual speaker tagging
                </CardDescription>
              </div>

              {/* Transcript Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search dialogue phrases..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0C5DB8] focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {call.transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FileText className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">
                  Transcript Unavailable
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mt-0.5">
                  Audio transcript for this call was not captured or processing was interrupted.
                </p>
              </div>
            ) : filteredTranscript.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No dialogue turns matching &quot;{transcriptSearch}&quot;
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
                {filteredTranscript.map((entry) => {
                  const isAgent = entry.speaker === "agent";
                  return (
                    <div
                      key={entry.id}
                      className={`flex gap-3 rounded-lg p-3 text-xs transition-colors ${
                        isAgent
                          ? "bg-[#EAF7F6]/60 border border-[#18A99D]/20 ml-4 md:ml-10"
                          : "bg-white border border-slate-200 mr-4 md:mr-10"
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        <Badge
                          variant={isAgent ? "teal" : "outline"}
                          size="sm"
                          className="font-bold tracking-tight text-[10px]"
                        >
                          {isAgent ? "Daya AI (Sarvam)" : "Caller / Patient"}
                        </Badge>
                      </div>

                      <div className="flex-1 space-y-1">
                        {/* Malayalam Original Script */}
                        {entry.malayalamText && (
                          <p className="font-malayalam text-slate-900 leading-relaxed text-xs">
                            {entry.malayalamText}
                          </p>
                        )}
                        {/* English translation / phonetic */}
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {entry.text}
                        </p>
                      </div>

                      {entry.timestampMs !== undefined && (
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 mt-0.5">
                          {formatDuration(Math.floor(entry.timestampMs / 1000))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section D: Call Audio Recording */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-[#0C5DB8]" />
              <span>D. Call Audio Recording</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Protected playback via short-lived authenticated server tokens. Provider credentials never exposed.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {!call.recordingUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600">
                <VolumeX className="h-5 w-5 text-slate-400 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-700">Audio Recording Not Available</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    No authorized voice recording exists for this interaction. Voice recording may be disabled by patient consent preference or the session was interrupted before carrier stream commit.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="h-9 w-9 rounded-full p-0 flex items-center justify-center shrink-0"
                      title={isPlaying ? "Pause" : "Play Recording"}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsPlaying(false);
                        setPlaybackProgress(0);
                      }}
                      className="h-8 w-8 p-0 flex items-center justify-center text-slate-600"
                      title="Reset playback"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>

                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold text-slate-800">
                        {isPlaying ? "Playing Inbound Voice Stream..." : "Ready for Secure Playback"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Source: /api/calls/{call.id}/recording (Token Signed)
                      </p>
                    </div>
                  </div>

                  {/* Speed Controls */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <span className="text-[11px] text-slate-500 mr-1">Speed:</span>
                    {[1, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setAudioSpeed(speed)}
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                          audioSpeed === speed
                            ? "bg-[#0C5DB8] text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#0C5DB8] h-1.5 transition-all duration-300"
                      style={{ width: `${playbackProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>
                      {formatDuration(
                        Math.floor((call.durationSeconds * playbackProgress) / 100)
                      )}
                    </span>
                    <span>{formatDuration(call.durationSeconds)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section E: AI Actions & HMS Results */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-[#0C5DB8]" />
              <span>E. AI Actions & Hospital Management System (HMS) Results</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Verified clinical actions committed to Daya Hospital Management System (HMS)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {call.actions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No external HMS transaction triggered during this interaction.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">Action Type</th>
                      <th className="py-2.5 px-4">Time Initiated</th>
                      <th className="py-2.5 px-4">Execution Status</th>
                      <th className="py-2.5 px-4">Safe Request Summary</th>
                      <th className="py-2.5 px-4">HMS Transaction Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {call.actions.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {act.type.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {formatDateTime(act.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              act.status === "CONFIRMED"
                                ? "teal"
                                : act.status === "FAILED"
                                ? "urgent"
                                : "warning"
                            }
                            size="sm"
                          >
                            {act.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs">
                          {act.description}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#0C5DB8]">
                          {act.hmsReference || call.hmsTransactionRef || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section F: Staff Review & Audit Trail */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#0C5DB8]" />
                  <span>F. Staff Clinical Review & Follow-Up Audit</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Hospital staff verification, internal notes, and supervisor audit history
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={call.requiresFollowUp ? "destructive" : "outline"}
                  size="sm"
                  onClick={handleToggleFollowUp}
                  disabled={isSavingReview}
                  className="h-8 text-xs gap-1.5"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>
                    {call.requiresFollowUp ? "Mark Follow-Up Cleared" : "Require Follow-Up"}
                  </span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Notes editor */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                Internal Reviewer Notes
              </label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add clinical observation, patient follow-up resolution, or token booking instructions..."
                className="w-full rounded-lg border border-slate-200 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0C5DB8] focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
              />
              <div className="flex justify-end">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isSavingReview}
                  className="text-xs h-8"
                >
                  {isSavingReview ? "Saving..." : "Save Internal Note"}
                </Button>
              </div>
            </div>

            {/* Review History Audit Trail */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Review History & Audit Trail
              </h4>

              {(!call.reviewHistory || call.reviewHistory.length === 0) ? (
                <div className="text-xs text-slate-400 py-2 italic">
                  No staff reviews recorded yet for this session.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50">
                  {call.reviewHistory.map((rev) => (
                    <div key={rev.id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {rev.reviewerName}
                          </span>
                          <Badge variant="outline" size="sm">
                            {rev.action.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatDateTime(rev.timestamp)}
                        </span>
                      </div>
                      {rev.notes && (
                        <p className="text-slate-600 text-[11px] pl-2 border-l-2 border-slate-300">
                          {rev.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
