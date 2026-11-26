"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  Sparkles,
  ShieldAlert,
  Layers,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  PhoneForwarded,
  Cpu,
  Clock,
  Terminal,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export function SarvamVoiceAgentSettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/config/voice-agent");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Error loading Voice Agent settings",
        message: err?.message || "Failed to load settings",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchMode(mode: "SARVAM_CORE_CUSTOM" | "SARVAM_VOICE_AGENTS") {
    setUpdating(true);
    try {
      const res = await fetch("/api/v1/config/voice-agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engineMode: mode }),
      });
      const json = await res.json();
      if (json.success) {
        showToast({
          type: "success",
          title: "Engine Mode Updated",
          message: mode === "SARVAM_CORE_CUSTOM"
            ? "Reverted cleanly to baseline Sarvam Core Custom WebSocket pipeline."
            : "Switched to Sarvam Voice Agents (Samvaad) development runtime.",
        });
        fetchConfig();
      } else {
        throw new Error(json.error || "Update failed");
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Mode Switch Failed",
        message: err?.message,
      });
    } finally {
      setUpdating(false);
    }
  }

  if (loading || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-[#0C5DB8]" />
          Loading Sarvam Voice Agents integration settings...
        </CardContent>
      </Card>
    );
  }

  const isCoreMode = data.engineMode === "SARVAM_CORE_CUSTOM";

  return (
    <div className="space-y-6">
      {/* Top Banner: Engine Mode Overview */}
      <Card className="border-[#0C5DB8]/20 bg-gradient-to-r from-blue-50/50 via-white to-purple-50/30">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#0C5DB8]" />
              <h3 className="font-semibold text-slate-900 text-lg">
                Sarvam Voice Agents / Samvaad Integration (Phase 10)
              </h3>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Phase 10 Architecture
              </Badge>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Architectural migration path to Sarvam Voice Agents with instant zero-risk rollback to Core Custom STT/TTS pipeline.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <label className="text-xs font-medium text-slate-500 block mb-1">Active Conversational Engine</label>
              <Badge className={isCoreMode ? "bg-emerald-600 text-white" : "bg-purple-600 text-white"}>
                {isCoreMode ? "Sarvam Core (Custom Pipeline)" : "Sarvam Voice Agents (Samvaad)"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option A: Sarvam Core Custom Pipeline (Current Default Safe) */}
        <Card className={`border-2 transition-all ${isCoreMode ? "border-emerald-500 bg-emerald-50/10 shadow-sm" : "border-slate-200 opacity-80"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                <Cpu className="h-5 w-5 text-emerald-600" />
                Sarvam Core Custom Pipeline
              </CardTitle>
              {isCoreMode && (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  Active Production Baseline
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-slate-600">
              Low-level WebSocket pipeline: Sarvam Saaras:v4 STT + 105b LLM + Bulbul:v3 TTS (Kavitha/Ratan).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded border border-slate-200">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Telephony Gateway:</span>
                <span className="font-semibold text-slate-700">Railway WebSocket (/exotel/voicebot)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Passthru Routing:</span>
                <span className="font-semibold text-emerald-700">Active (Phase 9.5 Verified)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Emergency Casualty:</span>
                <span className="font-semibold text-emerald-700">Automated (+919606654032)</span>
              </div>
            </div>

            <Button
              variant={isCoreMode ? "outline" : "default"}
              size="sm"
              disabled={isCoreMode || updating}
              onClick={() => handleSwitchMode("SARVAM_CORE_CUSTOM")}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {isCoreMode ? "Currently Active Engine" : "Rollback to Sarvam Core"}
            </Button>
          </CardContent>
        </Card>

        {/* Option B: Sarvam Voice Agents / Samvaad */}
        <Card className={`border-2 transition-all ${!isCoreMode ? "border-purple-500 bg-purple-50/10 shadow-sm" : "border-slate-200 opacity-80"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Sarvam Voice Agents (Samvaad)
              </CardTitle>
              {!isCoreMode && (
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                  Active (Dev Runtime)
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-slate-600">
              Agentic turn-taking platform with external tool calling, native Malayalam interruptibility, and BYOT.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded border border-slate-200">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Workspace ID:</span>
                <span className="font-mono text-slate-700">{data.workspaceId?.slice(0, 18)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Organization ID:</span>
                <span className="font-mono text-slate-700">{data.orgId?.slice(0, 18)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Pilot Agent:</span>
                <span className="font-semibold text-purple-700">{data.pilotDeployment?.name?.split("(")[0]}</span>
              </div>
            </div>

            <Button
              variant={!isCoreMode ? "outline" : "default"}
              size="sm"
              disabled={!isCoreMode || updating}
              onClick={() => handleSwitchMode("SARVAM_VOICE_AGENTS")}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {!isCoreMode ? "Currently Active Engine" : "Activate Sarvam Voice Agents (Dev Mode)"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pilot Agent Specifications & Telephony BYOT Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pilot Agent Details */}
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50 pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Bot className="h-5 w-5 text-[#0C5DB8]" />
              Daya Hospital Pilot Voice Agent
            </CardTitle>
            <CardDescription className="text-xs">
              Configured Malayalam-first persona ("Daya Sahayi") with strict healthcare guardrails.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500 text-xs">Primary Language:</span>
              <span className="font-semibold text-slate-800 text-xs">Malayalam (ml-IN)</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500 text-xs">Secondary Language:</span>
              <span className="font-semibold text-slate-800 text-xs">English (en-IN)</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500 text-xs">Synthesized Voice:</span>
              <span className="font-semibold text-slate-800 text-xs">kavitha (Bulbul:v3 Female)</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500 text-xs">Medical Prescriptions:</span>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                STRICTLY PROHIBITED (Guardrailed)
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-xs">Connected Tools:</span>
              <Badge className="bg-blue-100 text-blue-800">5 Smrkomed APIs Connected</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Exotel BYOT & Human Transfer Assessment */}
        <Card className="shadow-sm">
          <CardHeader className="bg-amber-50/50 pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <PhoneForwarded className="h-5 w-5 text-amber-600" />
              Exotel BYOT & Transfer Compatibility
            </CardTitle>
            <CardDescription className="text-xs text-amber-800/80">
              Telephony status on Exotel Singapore account (smrkonova1 / 08047291658).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Sarvam Exotel Transfer Limitation:</span>
              </div>
              <p>
                Unlike Vobiz or Plivo, Sarvam's official guide states that <strong>Exotel requires extra applets in your Exotel App or enablement through Sarvam Support</strong> to execute a live call transfer.
              </p>
              <p className="font-medium text-amber-950">
                Live carrier calls are currently safe on Smrkomed's Core pipeline with Passthru routing (+919606654032).
              </p>
            </div>

            <div className="text-xs text-slate-500 space-y-1">
              <div><strong>ExoPhone:</strong> 08047291658 (Singapore api.exotel.com)</div>
              <div><strong>Voicebot Applet:</strong> 1393239</div>
              <div><strong>Auth Header:</strong> X-API-Key (Voice Agents platform standard)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smrkomed Tool APIs Connected */}
      <Card className="shadow-sm">
        <CardHeader className="bg-slate-50 pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-800">
            <Layers className="h-5 w-5 text-teal-600" />
            Smrkomed Control Plane Tool Endpoints
          </CardTitle>
          <CardDescription className="text-xs">
            Authenticated REST endpoints provided by Smrkomed for Sarvam Voice Agents to interact with hospital data.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded border flex items-center justify-between">
              <div>
                <span className="font-mono text-blue-700 font-semibold">GET /api/v1/voice-agent/context</span>
                <p className="text-slate-500 mt-0.5">On-start tenant hours, policies & departments</p>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Online</Badge>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border flex items-center justify-between">
              <div>
                <span className="font-mono text-blue-700 font-semibold">POST /api/v1/voice-agent/check-availability</span>
                <p className="text-slate-500 mt-0.5">Doctor OPD session availability check</p>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Online</Badge>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border flex items-center justify-between">
              <div>
                <span className="font-mono text-blue-700 font-semibold">POST /api/v1/voice-agent/book-appointment</span>
                <p className="text-slate-500 mt-0.5">Books confirmed appointment in HMS</p>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Online</Badge>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border flex items-center justify-between">
              <div>
                <span className="font-mono text-blue-700 font-semibold">POST /api/v1/voice-agent/emergency-escalate</span>
                <p className="text-slate-500 mt-0.5">Casualty override triage alert</p>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Online</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

