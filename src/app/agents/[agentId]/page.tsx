"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Volume2,
  Play,
  RotateCcw,
  Sparkles,
  Shield,
  ArrowLeft,
  Save,
  CheckCircle2,
  Headphones,
  Send,
  MessageSquare,
  History,
  PhoneCall,
  Loader2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { AgentConfigData, AgentTestTurnResult } from "@/lib/services/agent-service";
import { SARVAM_SPEAKERS, SARVAM_TTS_MODELS } from "@/lib/providers/ai/sarvam/sarvam-capabilities";

function AgentBuilderContent() {
  const params = useParams();
  const agentId = params.agentId as string;
  const { showToast } = useToast();
  const { isAdmin } = useAuth();

  const [agent, setAgent] = React.useState<AgentConfigData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);

  // Voice Preview State
  const [previewText, setPreviewText] = React.useState(
    "നമസ്കാരം, ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. ഒപിഡി ടിക്കറ്റിനും ഡോക്ടർ കൺസൾട്ടേഷനും ഞാൻ സഹായിക്കാം."
  );
  const [isPlayingPreview, setIsPlayingPreview] = React.useState(false);
  const [previewLatency, setPreviewLatency] = React.useState<number | null>(null);

  // Playground State
  const [testInput, setTestInput] = React.useState("");
  const [isTestingTurn, setIsTestingTurn] = React.useState(false);
  const [chatHistory, setChatHistory] = React.useState<
    Array<{ sender: "USER" | "AGENT"; text: string; latency?: number; audio?: string }>
  >([]);

  // Versions State
  const [versions, setVersions] = React.useState<
    Array<{ id: string; versionNumber: number; status: string; changelog?: string; publishedBy: string; publishedAt: string }>
  >([]);

  const fetchAgent = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [agentRes, verRes] = await Promise.all([
        fetch(`/api/v1/agents/${agentId}`),
        fetch(`/api/v1/agents/${agentId}/versions`),
      ]);

      if (agentRes.ok) {
        const json = await agentRes.json();
        if (json.success && json.data) {
          setAgent(json.data);
          if (json.data.greetingMalayalam) {
            setPreviewText(json.data.greetingMalayalam);
          }
        }
      }

      if (verRes.ok) {
        const vJson = await verRes.json();
        if (vJson.success) setVersions(vJson.data || []);
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Failed to load agent configuration." });
    } finally {
      setIsLoading(false);
    }
  }, [agentId, showToast]);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [agentRes, verRes] = await Promise.all([
          fetch(`/api/v1/agents/${agentId}`),
          fetch(`/api/v1/agents/${agentId}/versions`),
        ]);

        if (agentRes.ok && active) {
          const json = await agentRes.json();
          if (json.success && json.data) {
            setAgent(json.data);
            if (json.data.greetingMalayalam) {
              setPreviewText(json.data.greetingMalayalam);
            }
          }
        }

        if (verRes.ok && active) {
          const vJson = await verRes.json();
          if (vJson.success) setVersions(vJson.data || []);
        }
      } catch {
        if (active) {
          showToast({ type: "error", title: "Error", message: "Failed to load agent configuration." });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [agentId, showToast]);

  // Save Draft
  const handleSaveDraft = async () => {
    if (!agent) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/v1/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agent),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Draft Saved",
          message: "Agent draft configuration saved without modifying live calls.",
        });
        setAgent(json.data);
      } else {
        showToast({ type: "error", title: "Save Failed", message: json.error });
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Failed to save agent draft." });
    } finally {
      setIsSaving(false);
    }
  };

  // Publish Agent
  const handlePublish = async () => {
    if (!agent) return;
    try {
      setIsPublishing(true);
      const res = await fetch(`/api/v1/agents/${agent.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changelog: `Published updated voice & prompt configuration`,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Agent Published",
          message: `Agent version ${json.versionNumber} is now active for hospital calling.`,
        });
        await fetchAgent();
      } else {
        showToast({ type: "error", title: "Publish Failed", message: json.error });
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Failed to publish agent." });
    } finally {
      setIsPublishing(false);
    }
  };

  // Live Voice Preview Audio Player
  const handlePlayVoicePreview = async () => {
    if (!agent || !previewText.trim()) return;
    try {
      setIsPlayingPreview(true);
      setPreviewLatency(null);

      const res = await fetch("/api/v1/agents/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: previewText.trim(),
          model: agent.ttsModel,
          speaker: agent.speaker,
          languageCode: agent.defaultLanguage,
          pace: agent.speakingPace,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.audioBase64) {
        setPreviewLatency(json.latencyMs);
        const audio = new Audio(`data:audio/wav;base64,${json.audioBase64}`);
        audio.play();
        showToast({
          type: "info",
          title: "Voice Audio Generated",
          message: `SMRKO VOICE (${agent.ttsModel}) synthesized speech in ${json.latencyMs}ms.`,
        });
      } else {
        showToast({ type: "error", title: "Preview Error", message: json.error || "Synthesis failed." });
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Network request failed for voice preview." });
    } finally {
      setIsPlayingPreview(false);
    }
  };

  // Agent Test Playground Turn
  const handleSendTestQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim() || !agent) return;

    const userText = testInput.trim();
    setTestInput("");
    setChatHistory((prev) => [...prev, { sender: "USER", text: userText }]);

    try {
      setIsTestingTurn(true);
      const res = await fetch("/api/v1/agents/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          userInput: userText,
          language: agent.defaultLanguage,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const turnData: AgentTestTurnResult = json.data;
        setChatHistory((prev) => [
          ...prev,
          {
            sender: "AGENT",
            text: turnData.replyText,
            latency: turnData.latencyBreakdown.totalMs,
            audio: turnData.audioBase64,
          },
        ]);

        if (turnData.audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${turnData.audioBase64}`);
          audio.play();
        }
      } else {
        showToast({ type: "error", title: "Playground Error", message: json.error });
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Failed to simulate agent turn." });
    } finally {
      setIsTestingTurn(false);
    }
  };

  // Rollback Version
  const handleRollback = async (verNum: number) => {
    if (!confirm(`Are you sure you want to rollback to version ${verNum}?`)) return;
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetVersion: verNum }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Rollback Complete",
          message: `Restored version ${verNum}. Published as v${json.versionNumber}.`,
        });
        await fetchAgent();
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Rollback failed." });
    }
  };

  if (isLoading || !agent) {
    return (
      <DashboardLayout>
        <div className="p-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#0C5DB8]" />
          <span>Loading SMRKO VOICE Agent Builder...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title={agent.name}
          description={`Configuring SMRKO VOICE multilingual agent (v${agent.currentVersion}) for Daya Hospital.`}
          badge={
            <Badge
              variant={
                agent.status === "PUBLISHED"
                  ? "default"
                  : agent.status === "DISABLED"
                  ? "danger"
                  : "secondary"
              }
              size="sm"
            >
              {agent.status}
            </Badge>
          }
          breadcrumbs={[
            { label: "Overview", href: "/overview" },
            { label: "AI Voice Agents", href: "/agents" },
            { label: agent.name },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Link href="/agents">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Agents</span>
                </Button>
              </Link>
              {isAdmin && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Save className="h-3.5 w-3.5 text-slate-500" />
                    <span>{isSaving ? "Saving..." : "Save Draft"}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="gap-1.5 text-xs font-semibold shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{isPublishing ? "Publishing..." : "Publish Version"}</span>
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* Builder Tabs */}
        <Tabs defaultValue="voice">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="identity">1. Identity & Purpose</TabsTrigger>
            <TabsTrigger value="voice">2. Voice Selection & Live Preview</TabsTrigger>
            <TabsTrigger value="prompts">3. Structured Prompt Builder</TabsTrigger>
            <TabsTrigger value="behavior">4. Call Behavior & Fallback</TabsTrigger>
            <TabsTrigger value="playground">5. Test Playground</TabsTrigger>
            <TabsTrigger value="versions">6. Versions & Rollback</TabsTrigger>
          </TabsList>

          {/* TAB 1: IDENTITY */}
          <TabsContent value="identity">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[#0C5DB8]" />
                  <span>Agent Identity & Operational Purpose</span>
                </CardTitle>
                <CardDescription>
                  Define the role, supported languages, and primary hospital function.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Agent Name *</label>
                    <Input
                      value={agent.name}
                      onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Operational Purpose</label>
                    <select
                      value={agent.purpose}
                      onChange={(e) => setAgent({ ...agent, purpose: e.target.value as AgentConfigData["purpose"] })}
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 bg-white text-slate-700 text-xs"
                    >
                      <option value="RECEPTIONIST">Main Front Desk Receptionist</option>
                      <option value="APPOINTMENT_BOOKING">Specialty Appointment Booking</option>
                      <option value="DEPARTMENT_ENQUIRY">Department & Doctor Timings Enquiry</option>
                      <option value="AFTER_HOURS">Night & After-Hours Assistant</option>
                      <option value="OUTBOUND_REMINDER">Outbound Patient Reminder Agent</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-slate-700">Description</label>
                  <Input
                    value={agent.description || ""}
                    onChange={(e) => setAgent({ ...agent, description: e.target.value })}
                    placeholder="Short description of this agent's hospital duties"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Default Speaking Language</label>
                    <select
                      value={agent.defaultLanguage}
                      onChange={(e) => setAgent({ ...agent, defaultLanguage: e.target.value })}
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 bg-white text-slate-700 text-xs"
                    >
                      <option value="ml-IN">Malayalam (മലയാളം)</option>
                      <option value="en-IN">English (Indian)</option>
                      <option value="hi-IN">Hindi (हिन्दी)</option>
                      <option value="ta-IN">Tamil (தமிழ்)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Personality Tone</label>
                    <select
                      value={agent.personalityTone}
                      onChange={(e) => setAgent({ ...agent, personalityTone: e.target.value })}
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 bg-white text-slate-700 text-xs"
                    >
                      <option value="EMPATHETIC_PROFESSIONAL">Empathetic & Professional (Recommended)</option>
                      <option value="DIRECT_CLINICAL">Direct & Clinical</option>
                      <option value="WARM_FRIENDLY">Warm & Reassuring</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: VOICE SELECTION & LIVE PREVIEW */}
          <TabsContent value="voice">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Voice Configuration Form */}
              <div className="lg:col-span-2 space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-[#0C5DB8]" />
                      <span>SMRKO VOICE Neural Voice Catalogue</span>
                    </CardTitle>
                    <CardDescription>
                      Select an official verified neural voice model and speaker tuned for Malayalam telephony.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    {/* TTS Model Selection */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-800">1. Text-To-Speech (TTS) Model</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {SARVAM_TTS_MODELS.map((model) => (
                          <div
                            key={model.id}
                            onClick={() => setAgent({ ...agent, ttsModel: model.id })}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              agent.ttsModel === model.id
                                ? "border-[#0C5DB8] bg-blue-50/60 ring-1 ring-[#0C5DB8]"
                                : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-slate-900">{model.name}</span>
                              {model.isVerified && (
                                <Badge variant="teal" size="sm" className="text-[10px]">
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 leading-snug">{model.description}</p>
                            {model.id === "bulbul:v4-flash" && (
                              <p className="text-[10px] text-amber-700 font-medium mt-1">
                                ⚠ Hindi & English only. Not compatible with Malayalam.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Speaker Cards */}
                    <div className="space-y-1.5 pt-2">
                      <label className="font-semibold text-slate-800">2. Speaker Selection</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {SARVAM_SPEAKERS.map((spk) => {
                          const isCompatible = spk.compatibleTtsModels.includes(agent.ttsModel);
                          const isAvailable = spk.isAvailable !== false;
                          const isSelected = agent.speaker === spk.id;
                          return (
                            <div
                              key={spk.id}
                              onClick={() => isCompatible && isAvailable && setAgent({ ...agent, speaker: spk.id })}
                              className={`p-3 rounded-xl border transition-all ${
                                !isCompatible || !isAvailable
                                  ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200"
                                  : isSelected
                                  ? "border-[#0C5DB8] bg-blue-50/70 ring-1 ring-[#0C5DB8] cursor-pointer"
                                  : "border-slate-200 hover:border-slate-300 bg-white cursor-pointer"
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-slate-900 capitalize">{spk.name}</span>
                                <Badge
                                  variant={!isAvailable ? "danger" : isSelected ? "teal" : "outline"}
                                  size="sm"
                                  className="text-[10px]"
                                >
                                  {!isAvailable ? "Unavailable" : spk.gender}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2">{spk.description}</p>
                              {!isAvailable && spk.unavailabilityReason && (
                                <p className="text-[10px] text-red-600 mt-1 font-medium leading-tight">
                                  {spk.unavailabilityReason}
                                </p>
                              )}
                              {isAvailable && (
                                <div className="mt-2 text-[10px] text-[#0C5DB8] font-medium">
                                  Langs: {spk.supportedLanguages.join(", ")}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Speaking Pace */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                        <label className="font-semibold text-slate-800">3. Speaking Pace / Speed</label>
                        <span className="font-bold text-[#0C5DB8]">{agent.speakingPace}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="1.4"
                        step="0.05"
                        value={agent.speakingPace}
                        onChange={(e) => setAgent({ ...agent, speakingPace: parseFloat(e.target.value) })}
                        className="w-full accent-[#0C5DB8] cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>0.8x (Slower)</span>
                        <span>1.15x (Optimized Telephony)</span>
                        <span>1.4x (Fast)</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Live Voice Preview Panel */}
              <div className="space-y-4">
                <Card className="border-blue-200 bg-gradient-to-b from-blue-50/50 to-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-950">
                      <Headphones className="h-4 w-4 text-[#0C5DB8]" />
                      <span>Live Voice Preview Player</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Enter sample text to synthesize and hear the voice in real-time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-700">Sample Text</label>
                      <textarea
                        rows={4}
                        value={previewText}
                        onChange={(e) => setPreviewText(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                        placeholder="Type Malayalam or English text to synthesize..."
                      />
                    </div>

                    {/* Pre-fill Quick Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewText(
                            "നമസ്കാരം, ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. ഒപിഡി ടിക്കറ്റിനും ഡോക്ടർ കൺസൾട്ടേഷനും ഞാൻ സഹായിക്കാം."
                          )
                        }
                        className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md hover:bg-slate-50 text-slate-700"
                      >
                        Malayalam Greeting
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewText(
                            "Hello, welcome to Daya Hospital Thrissur. Dr. Suresh Kumar in Cardiology is available today."
                          )
                        }
                        className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md hover:bg-slate-50 text-slate-700"
                      >
                        English OPD Notice
                      </button>
                    </div>

                    {/* Action Button */}
                    <Button
                      onClick={handlePlayVoicePreview}
                      disabled={isPlayingPreview}
                      variant="default"
                      className="w-full gap-2 mt-2"
                    >
                      {isPlayingPreview ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Synthesizing Audio...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          <span>Generate & Listen Audio</span>
                        </>
                      )}
                    </Button>

                    {previewLatency !== null && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800 flex justify-between items-center">
                        <span className="flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Speech Synthesized
                        </span>
                        <span className="font-bold">{previewLatency} ms</span>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500 pt-1 leading-relaxed border-t border-slate-100">
                      Plays audio using official <strong>SMRKO VOICE ({agent.ttsModel})</strong> neural voice model
                      with speaker <strong>{agent.speaker}</strong> at <strong>{agent.speakingPace}x</strong>.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: STRUCTURED PROMPT BUILDER */}
          <TabsContent value="prompts">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#0C5DB8]" />
                  <span>Structured Clinical Prompt Editor & Safeguards</span>
                </CardTitle>
                <CardDescription>
                  Configure clinical boundary rules, casualty escalation triggers, and full system prompts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {/* Greetings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-800">Primary Malayalam Welcome Greeting *</label>
                    <textarea
                      rows={3}
                      value={agent.greetingMalayalam}
                      onChange={(e) => setAgent({ ...agent, greetingMalayalam: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-800">English Fallback Welcome Greeting *</label>
                    <textarea
                      rows={3}
                      value={agent.greetingEnglish}
                      onChange={(e) => setAgent({ ...agent, greetingEnglish: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 bg-white"
                    />
                  </div>
                </div>

                {/* Complete System Prompt */}
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="font-semibold text-slate-800">Authoritative System Prompt</label>
                    <span className="text-[11px] text-slate-500">
                      {agent.systemPrompt.length} characters
                    </span>
                  </div>
                  <textarea
                    rows={12}
                    value={agent.systemPrompt}
                    onChange={(e) => setAgent({ ...agent, systemPrompt: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 p-3 text-xs font-mono text-slate-800 bg-slate-50 focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    ⚠ Invariant: The agent is strictly barred from diagnosing illnesses or prescribing medication.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: CALL BEHAVIOR & FALLBACK */}
          <TabsContent value="behavior">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-[#0C5DB8]" />
                  <span>Telephony Call Behavior & Escalation</span>
                </CardTitle>
                <CardDescription>
                  Configure max call length, speech silence timeouts, and human handoff routing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Max Call Duration (Seconds)</label>
                    <Input
                      type="number"
                      value={agent.maxDurationSeconds}
                      onChange={(e) =>
                        setAgent({ ...agent, maxDurationSeconds: parseInt(e.target.value) || 600 })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Silence Timeout (ms)</label>
                    <Input
                      type="number"
                      value={agent.silenceTimeoutMs}
                      onChange={(e) =>
                        setAgent({ ...agent, silenceTimeoutMs: parseInt(e.target.value) || 400 })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Fallback on Unknown Question</label>
                    <select
                      value={agent.fallbackBehavior}
                      onChange={(e) => setAgent({ ...agent, fallbackBehavior: e.target.value })}
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 bg-white text-slate-700 text-xs"
                    >
                      <option value="TRANSFER_CASUALTY">Transfer to Casualty (+91 96066 54032)</option>
                      <option value="TRANSFER_RECEPTION">Transfer to Receptionist (Ext 201)</option>
                      <option value="APOLOGY_MESSAGE">Speak polite apology & retry</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <label className="font-medium text-slate-700">Human Staff Handoff Instructions</label>
                  <Input
                    value={agent.humanHandoffInstruction || ""}
                    onChange={(e) => setAgent({ ...agent, humanHandoffInstruction: e.target.value })}
                    placeholder="e.g. Transfer caller to extension 201 when they ask for a human representative."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: TEST PLAYGROUND */}
          <TabsContent value="playground">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chat Simulator */}
              <div className="lg:col-span-2">
                <Card className="flex flex-col h-[520px]">
                  <CardHeader className="pb-2 border-b border-slate-100">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[#0C5DB8]" />
                      <span>Interactive Voice Playground Simulator</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Test turns in Malayalam and English with simulated latency breakdown and speech playback.
                    </CardDescription>
                  </CardHeader>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-slate-50/50">
                    {chatHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                        <Bot className="h-8 w-8 text-slate-300" />
                        <p>No turns simulated yet. Type a test enquiry below (e.g. &apos;ഡോക്ടർ എപ്പോഴാണ് വരിക?&apos;).</p>
                      </div>
                    ) : (
                      chatHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex ${item.sender === "USER" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl p-3 text-xs ${
                              item.sender === "USER"
                                ? "bg-[#0C5DB8] text-white"
                                : "bg-white border border-slate-200 text-slate-900 shadow-sm"
                            }`}
                          >
                            <p className="leading-relaxed">{item.text}</p>
                            {item.latency && (
                              <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                                <span>Turn Latency: {item.latency}ms</span>
                                {item.audio && <Volume2 className="h-3 w-3 text-emerald-600" />}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendTestQuery} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                    <Input
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Type a patient test query in Malayalam or English..."
                      className="text-xs"
                      disabled={isTestingTurn}
                    />
                    <Button type="submit" variant="default" size="sm" disabled={isTestingTurn} className="gap-1.5">
                      {isTestingTurn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span>Send</span>
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Playground Instructions & Triggers */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-slate-900">Test Scenarios</CardTitle>
                    <CardDescription className="text-xs">
                      Click to quickly test key hospital voice bot flows:
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setTestInput("ഡോക്ടറെ കാണാൻ എനിക്ക് അപ്പോയിന്റ്മെന്റ് വേണം.")}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 text-slate-800 text-[11px]"
                    >
                      <span className="font-semibold block text-[#0C5DB8]">Malayalam Appointment</span>
                      &quot;ഡോക്ടറെ കാണാൻ എനിക്ക് അപ്പോയിന്റ്മെന്റ് വേണം.&quot;
                    </button>

                    <button
                      type="button"
                      onClick={() => setTestInput("എനിക്ക് നെഞ്ചുവേദനയുണ്ട്, വളരെ അത്യാഹിതമാണ്!")}
                      className="w-full text-left p-2.5 rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-900 text-[11px]"
                    >
                      <span className="font-semibold block text-red-700">Emergency Casualty Triage</span>
                      &quot;എനിക്ക് നെഞ്ചുവേദനയുണ്ട്, വളരെ അത്യാഹിതമാണ്!&quot;
                    </button>

                    <button
                      type="button"
                      onClick={() => setTestInput("Can I speak with a human receptionist please?")}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 text-slate-800 text-[11px]"
                    >
                      <span className="font-semibold block text-[#0C5DB8]">Human Staff Handoff</span>
                      &quot;Can I speak with a human receptionist please?&quot;
                    </button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 6: VERSIONS & ROLLBACK */}
          <TabsContent value="versions">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <History className="h-4 w-4 text-[#0C5DB8]" />
                  <span>Published Version History & Audit Trail</span>
                </CardTitle>
                <CardDescription>
                  Review immutable snapshots and rollback to any previously verified configuration.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs">
                {versions.length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">No previous published versions recorded.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="p-3">Version</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Changelog</th>
                          <th className="p-3">Published By</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {versions.map((ver) => (
                          <tr key={ver.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-[#0C5DB8]">v{ver.versionNumber}</td>
                            <td className="p-3">
                              <Badge variant={ver.versionNumber === agent.currentVersion ? "default" : "secondary"}>
                                {ver.versionNumber === agent.currentVersion ? "Active" : "Archived"}
                              </Badge>
                            </td>
                            <td className="p-3 text-slate-700">{ver.changelog || "Routine update"}</td>
                            <td className="p-3 text-slate-600">{ver.publishedBy}</td>
                            <td className="p-3 text-slate-500">
                              {new Date(ver.publishedAt).toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              {isAdmin && ver.versionNumber !== agent.currentVersion && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRollback(ver.versionNumber)}
                                  className="h-7 text-[11px] gap-1"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Rollback</span>
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

export default function AgentBuilderPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
          Loading Voice Agent Builder...
        </div>
      }
    >
      <AgentBuilderContent />
    </React.Suspense>
  );
}
