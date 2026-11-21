"use client";

import * as React from "react";
import {
  Phone,
  Volume2,
  CheckCircle2,
  Eye,
  EyeOff,
  Database,
  Languages,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CallRecord } from "@/types";
import { maskPhoneNumber, formatDuration, formatDateTime } from "@/lib/utils";

interface CallDetailModalProps {
  call: CallRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateFollowUp?: (callId: string, notes: string, resolved: boolean) => void;
}

function CallDetailInner({
  call,
  onClose,
  onUpdateFollowUp,
}: {
  call: CallRecord;
  onClose: () => void;
  onUpdateFollowUp?: (callId: string, notes: string, resolved: boolean) => void;
}) {
  const [revealPhone, setRevealPhone] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1);
  const [showMalayalamText, setShowMalayalamText] = React.useState(true);
  const [notes, setNotes] = React.useState(call.followUpNotes || "");

  return (
    <div className="space-y-5">
      {/* Top Info Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 text-xs">
        <div>
          <div className="text-[10px] text-slate-400 font-medium">Caller Number</div>
          <div className="flex items-center gap-1.5 mt-0.5 font-semibold text-slate-900">
            <span>{maskPhoneNumber(call.callerNumber, revealPhone)}</span>
            <button
              type="button"
              onClick={() => setRevealPhone(!revealPhone)}
              title={revealPhone ? "Mask number" : "Reveal full number (authorized staff)"}
              className="text-slate-400 hover:text-slate-700"
            >
              {revealPhone ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-400 font-medium">Start Time (IST)</div>
          <div className="font-semibold text-slate-900 mt-0.5">
            {formatDateTime(call.startTime)}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-400 font-medium">Duration</div>
          <div className="font-semibold text-slate-900 mt-0.5">
            {formatDuration(call.durationSeconds)}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-400 font-medium">Routing Source</div>
          <div className="font-semibold text-slate-900 mt-0.5">
            {call.callSource === "IVR_ROLLOVER"
              ? "IVR Rollover"
              : call.callSource === "DIRECT_HOTLINE"
              ? "Direct Hotline"
              : "Off-Hours Service"}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-400 font-medium">Telephony Provider</div>
          <div className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              {call.provider || "EXOTEL"}
            </span>
            <span className="text-[10px] text-slate-500 font-normal">
              {call.direction === "OUTBOUND" ? "Outbound" : "Inbound"}
            </span>
          </div>
        </div>
      </div>

      {/* Audio Player Simulator */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-[#0C5DB8]" />
            <span className="font-semibold text-slate-800">
              Encrypted Audio Recording (Voice AI Telephony)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Speed:</span>
            {[1, 1.25, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  playbackSpeed === speed
                    ? "bg-[#0C5DB8] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Audio scrub bar */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-8 w-8 text-[#0C5DB8]"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </Button>

          <div className="flex-1">
            <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden cursor-pointer">
              <div
                className="h-full bg-[#0C5DB8] transition-all"
                style={{ width: isPlaying ? "65%" : "30%" }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>{isPlaying ? "01:32" : "00:42"}</span>
              <span>{formatDuration(call.durationSeconds)}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsPlaying(false)}
            className="h-8 w-8 text-slate-400 hover:text-slate-700"
            title="Restart audio"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs: Transcript, AI Summary & Entities, HMS Actions */}
      <Tabs defaultValue="transcript">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <TabsList>
            <TabsTrigger value="transcript">Full Conversation Transcript</TabsTrigger>
            <TabsTrigger value="summary">AI Summary & Clinical Intent</TabsTrigger>
            <TabsTrigger value="actions">
              HMS Actions & Logs ({call.actions.length})
            </TabsTrigger>
          </TabsList>

          <button
            onClick={() => setShowMalayalamText(!showMalayalamText)}
            className="flex items-center gap-1.5 text-xs text-[#0E7A71] font-medium hover:underline cursor-pointer"
          >
            <Languages className="h-3.5 w-3.5" />
            <span>{showMalayalamText ? "Hide Malayalam" : "Show Malayalam"}</span>
          </button>
        </div>

        {/* Tab 1: Transcript */}
        <TabsContent value="transcript" className="space-y-3 max-h-[300px] overflow-y-auto pr-2 pt-1">
          {call.transcript && call.transcript.length > 0 ? (
            call.transcript.map((item) => (
              <div
                key={item.id}
                className={`flex gap-3 text-xs ${
                  item.speaker === "agent" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-xl p-3 space-y-1 ${
                    item.speaker === "agent"
                      ? "bg-[#EAF7F6]/70 border border-[#18A99D]/25 text-slate-900"
                      : "bg-slate-100 border border-slate-200 text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px]">
                    <span className="font-semibold text-slate-700">
                      {item.speakerName}
                    </span>
                    <span className="text-slate-400">
                      {Math.floor(item.timestampMs / 1000)}s
                    </span>
                  </div>

                  {showMalayalamText && item.malayalamText && (
                    <p className="font-medium text-[#0E7A71] leading-relaxed">
                      {item.malayalamText}
                    </p>
                  )}

                  <p className="text-slate-700 leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 p-4 text-center">
              No transcript available for this call interaction.
            </p>
          )}
        </TabsContent>

        {/* Tab 2: AI Summary & Intent */}
        <TabsContent value="summary" className="space-y-4 pt-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                AI Generated Structured Summary
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded ring-1 ring-emerald-600/20">
                {(call.aiConfidence * 100).toFixed(0)}% Confidence
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">{call.aiSummary}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-1">
              <span className="text-slate-400 text-[10px]">Detected Intent</span>
              <p className="font-semibold text-slate-800">{call.intentCategory}</p>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-1">
              <span className="text-slate-400 text-[10px]">HMS Verification Status</span>
              <p className="font-semibold text-slate-800">
                {call.hmsTransactionRef ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified ({call.hmsTransactionRef})
                  </span>
                ) : (
                  <span className="text-slate-500">No HMS write transaction</span>
                )}
              </p>
            </div>
          </div>

          {/* Staff Follow Up Section */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900">Hospital Staff Follow-up</span>
              <Badge variant={call.requiresFollowUp ? "warning" : "secondary"}>
                {call.followUpStatus}
              </Badge>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter hospital staff notes (e.g. called patient back, manual OPD token allocated)..."
              rows={2}
              className="w-full rounded-md border border-amber-300 bg-white p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                {call.assignedStaff ? `Lead: ${call.assignedStaff}` : "Unassigned"}
              </span>
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  onUpdateFollowUp?.(call.id, notes, true);
                  alert("Follow-up status and notes updated.");
                }}
                className="h-7 text-xs bg-[#0C5DB8]"
              >
                Save Notes
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: HMS Actions */}
        <TabsContent value="actions" className="space-y-3 pt-1">
          {call.actions.length === 0 ? (
            <p className="text-xs text-slate-400 p-4 text-center">
              No external actions or HMS requests triggered in this call.
            </p>
          ) : (
            <div className="space-y-2.5">
              {call.actions.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {act.type.replace(/_/g, " ")}
                      </span>
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
                    </div>
                    <p className="text-slate-600">{act.description}</p>
                    {act.hmsReference && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#0C5DB8] font-mono">
                        <Database className="h-3 w-3" />
                        <span>HMS Ref: {act.hmsReference}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {formatDateTime(act.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Footer */}
      <div className="flex items-center justify-end border-t border-slate-100 pt-3">
        <Button variant="outline" size="sm" onClick={onClose} className="h-8">
          Close
        </Button>
      </div>
    </div>
  );
}

export function CallDetailModal({
  call,
  isOpen,
  onClose,
  onUpdateFollowUp,
}: CallDetailModalProps) {
  if (!call) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#E8F2FC] p-2 text-[#0C5DB8]">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900">
                Call Interaction: {call.id}
              </span>
              <Badge
                variant={
                  call.callStatus === "ANSWERED"
                    ? "success"
                    : call.callStatus === "TRANSFERRED"
                    ? "warning"
                    : "danger"
                }
              >
                {call.callStatus}
              </Badge>
              <Badge variant="teal">{call.language}</Badge>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              External Session ID: <span className="font-mono text-slate-700">{call.externalCallId}</span>
            </p>
          </div>
        </div>
      }
    >
      <CallDetailInner
        key={call.id}
        call={call}
        onClose={onClose}
        onUpdateFollowUp={onUpdateFollowUp}
      />
    </Modal>
  );
}
