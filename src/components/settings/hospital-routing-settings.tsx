"use client";

import React, { useState, useEffect } from "react";
import {
  PhoneCall,
  ShieldAlert,
  Users,
  Building2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCcw,
  Send,
  Save,
  Plus,
  Trash2,
  HelpCircle,
  Play,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  HospitalRoutingConfig,
  DepartmentDestination,
  EscalationType,
} from "@/lib/services/hospital-routing-service";

interface HospitalRoutingSettingsProps {
  initialHospitalId?: string;
}

export function HospitalRoutingSettings({
  initialHospitalId = "hosp_daya_thrissur",
}: HospitalRoutingSettingsProps) {
  const { showToast } = useToast();
  const [hospitalId, setHospitalId] = useState(initialHospitalId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [changelog, setChangelog] = useState("");

  const [draft, setDraft] = useState<HospitalRoutingConfig | null>(null);
  const [activeVersion, setActiveVersion] = useState<HospitalRoutingConfig | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Simulation state
  const [simEscalationType, setSimEscalationType] = useState<EscalationType>("EMERGENCY");
  const [simDepartmentId, setSimDepartmentId] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  useEffect(() => {
    fetchRoutingData(hospitalId);
  }, [hospitalId]);

  async function fetchRoutingData(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/config/routing?hospitalId=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDraft(json.data.draft);
        setActiveVersion(json.data.activePublished);
        setValidationErrors(json.data.validation?.errors?.map((e: any) => e.message) || []);
        setValidationWarnings(json.data.validation?.warnings?.map((w: any) => w.message) || []);
      }

      const verRes = await fetch(`/api/v1/config/routing/versions?hospitalId=${encodeURIComponent(id)}`);
      const verJson = await verRes.json();
      if (verJson.success && verJson.data) {
        setVersions(verJson.data.versions || []);
        setAuditLogs(verJson.data.auditLogs || []);
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Error Loading Routing Configuration",
        message: err?.message || "Failed to fetch routing data",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/config/routing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (json.success) {
        setDraft(json.data.draft);
        setValidationErrors(json.data.validation?.errors?.map((e: any) => e.message) || []);
        setValidationWarnings(json.data.validation?.warnings?.map((w: any) => w.message) || []);
        showToast({
          type: "success",
          title: "Draft Saved",
          message: "Hospital call routing draft successfully saved.",
        });
      } else {
        throw new Error(json.error || "Failed to save draft");
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Failed to Save Draft",
        message: err?.message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!draft) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/v1/config/routing/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: draft.hospitalId,
          changelog: changelog.trim() || "Published via Hospital Settings",
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast({
          type: "success",
          title: "Version Published",
          message: `Routing configuration version v${json.data.versionNumber} is now live.`,
        });
        setPublishModalOpen(false);
        setChangelog("");
        fetchRoutingData(hospitalId);
      } else {
        throw new Error(json.error || "Failed to publish version");
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Publication Error",
        message: err?.message,
      });
    } finally {
      setPublishing(false);
    }
  }

  async function handleRollback(versionNumber: number) {
    if (!confirm(`Are you sure you want to rollback to version v${versionNumber}? Active calls will continue cleanly.`)) {
      return;
    }
    try {
      const res = await fetch("/api/v1/config/routing/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId,
          versionNumber,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast({
          type: "success",
          title: "Rollback Complete",
          message: `Successfully restored version v${versionNumber}.`,
        });
        fetchRoutingData(hospitalId);
      } else {
        throw new Error(json.error || "Rollback failed");
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Rollback Error",
        message: err?.message,
      });
    }
  }

  async function handleSimulate() {
    setSimulating(true);
    setSimulationResult(null);
    try {
      const res = await fetch("/api/v1/config/routing/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId,
          escalationType: simEscalationType,
          departmentId: simDepartmentId || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSimulationResult(json.data);
      } else {
        throw new Error(json.error || "Simulation failed");
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Simulation Failed",
        message: err?.message,
      });
    } finally {
      setSimulating(false);
    }
  }

  function addDepartment() {
    if (!draft) return;
    const newDept: DepartmentDestination = {
      id: `dept_${Date.now()}`,
      name: "New Department",
      extension: "105",
      phoneNumber: "+91",
      priority: 1,
    };
    setDraft({
      ...draft,
      departmentDestinations: [...(draft.departmentDestinations || []), newDept],
    });
  }

  function removeDepartment(index: number) {
    if (!draft) return;
    const updated = [...draft.departmentDestinations];
    updated.splice(index, 1);
    setDraft({ ...draft, departmentDestinations: updated });
  }

  function addAdditionalReceptionist() {
    if (!draft) return;
    const newAgent = {
      id: `agent_rec_${Date.now()}`,
      name: "Desk Agent 2",
      extension: "202",
      phoneNumber: "+91",
      priority: ((draft.additionalReceptionists || []).length || 0) + 2,
      status: "AVAILABLE" as const,
    };
    setDraft({
      ...draft,
      additionalReceptionists: [...(draft.additionalReceptionists || []), newAgent],
    });
  }

  function removeAdditionalReceptionist(index: number) {
    if (!draft) return;
    const updated = [...(draft.additionalReceptionists || [])];
    updated.splice(index, 1);
    setDraft({ ...draft, additionalReceptionists: updated });
  }

  if (loading || !draft) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-[#0C5DB8]" />
          Loading dynamic call routing configuration...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner: Tenant Selector & Version Status */}
      <Card className="border-[#0C5DB8]/20 bg-gradient-to-r from-blue-50/50 via-white to-teal-50/30">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-[#0C5DB8]" />
              <h3 className="font-semibold text-slate-900 text-lg">
                Multi-Tenant Dynamic Call Routing Engine
              </h3>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                Phase 9.6 Active
              </Badge>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Dynamically routes Exotel Connect Applet calls to tenant-specific E.164 destinations without hardcoded numbers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Active Tenant</label>
              <select
                className="text-sm font-medium border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 shadow-sm"
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
              >
                <option value="hosp_daya_thrissur">Daya General Hospital (Thrissur)</option>
                <option value="hosp_aster_medcity">Aster Medcity (Kochi)</option>
                <option value="hosp_kims_trivandrum">KIMSHEALTH (Trivandrum)</option>
              </select>
            </div>

            <div className="text-right">
              <label className="text-xs font-medium text-slate-500 block mb-1">Status & Version</label>
              <div className="flex items-center gap-1.5">
                {hospitalId === "hosp_daya_thrissur" ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    Live Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                    Demo Sandbox
                  </Badge>
                )}
                <Badge className="bg-[#0C5DB8] text-white">
                  {activeVersion?.versionNumber ? `v${activeVersion.versionNumber}` : "Draft"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Sandbox Alert for Non-Verified Tenants */}
      {hospitalId !== "hosp_daya_thrissur" && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-md">
          <div className="flex items-center gap-2 text-amber-800 font-semibold mb-1">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span>Demonstration Sandbox Tenant (Unverified Sample Data)</span>
          </div>
          <p className="text-xs text-amber-700">
            Destinations for this hospital tenant are unverified mock data. Live PSTN carrier calls will fail closed to prevent accidental dialing of unapproved numbers. Interactive simulation below remains fully operational.
          </p>
        </div>
      )}

      {/* Validation Banner */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
          <div className="flex items-center gap-2 text-red-800 font-semibold mb-1">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span>Routing Validation Issues (Draft cannot be published until resolved):</span>
          </div>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2-Column Grid for Destinations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. EMERGENCY ROUTING */}
        <Card className="border-red-100 shadow-sm">
          <CardHeader className="bg-red-50/50 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-red-800">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                Emergency & Casualty Hotline
              </CardTitle>
              <Badge variant="danger" className="text-xs">Highest Priority</Badge>
            </div>
            <CardDescription className="text-xs text-red-700/80">
              Immediate override when acute medical emergency or chest pain is detected by Sarvam AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Primary Emergency Phone Number (E.164) *
              </label>
              <Input
                value={draft.emergencyDestination.primaryNumber || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    emergencyDestination: {
                      ...draft.emergencyDestination,
                      primaryNumber: e.target.value,
                    },
                  })
                }
                placeholder="+919606654032"
                className="font-mono text-sm"
              />
              <span className="text-xs text-slate-500">Format: +919606654032 (Must be E.164)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Backup Emergency Number
                </label>
                <Input
                  value={draft.emergencyDestination.backupNumber || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      emergencyDestination: {
                        ...draft.emergencyDestination,
                        backupNumber: e.target.value,
                      },
                    })
                  }
                  placeholder="+914872475100"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Extension
                </label>
                <Input
                  value={draft.emergencyDestination.extension || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      emergencyDestination: {
                        ...draft.emergencyDestination,
                        extension: e.target.value,
                      },
                    })
                  }
                  placeholder="100"
                  className="text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Department Label
              </label>
              <Input
                value={draft.emergencyDestination.departmentName || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    emergencyDestination: {
                      ...draft.emergencyDestination,
                      departmentName: e.target.value,
                    },
                  })
                }
                placeholder="Casualty Department"
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. RECEPTIONIST ROUTING */}
        <Card className="border-blue-100 shadow-sm">
          <CardHeader className="bg-blue-50/50 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                <Users className="h-5 w-5 text-[#0C5DB8]" />
                Main Inbound Reception (Human Front Desk)
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-800 text-xs">Standard Routing</Badge>
            </div>
            <CardDescription className="text-xs text-blue-700/80">
              Standard transfer destination when caller requests a human agent or front desk staff.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Primary Reception Phone Number (E.164) *
              </label>
              <Input
                value={draft.receptionistDestination.primaryNumber || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    receptionistDestination: {
                      ...draft.receptionistDestination,
                      primaryNumber: e.target.value,
                    },
                  })
                }
                placeholder="+919606654032"
                className="font-mono text-sm"
              />
              <span className="text-xs text-slate-500">Format: +919606654032</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Backup Reception Number
                </label>
                <Input
                  value={draft.receptionistDestination.backupNumber || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      receptionistDestination: {
                        ...draft.receptionistDestination,
                        backupNumber: e.target.value,
                      },
                    })
                  }
                  placeholder="+914872475000"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Extension
                </label>
                <Input
                  value={draft.receptionistDestination.extension || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      receptionistDestination: {
                        ...draft.receptionistDestination,
                        extension: e.target.value,
                      },
                    })
                  }
                  placeholder="201"
                  className="text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Department Label
              </label>
              <Input
                value={draft.receptionistDestination.departmentName || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    receptionistDestination: {
                      ...draft.receptionistDestination,
                      departmentName: e.target.value,
                    },
                  })
                }
                placeholder="Front Desk Reception"
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2.1 RECEPTIONIST RING TIMEOUT & AI OVERFLOW CONTROLS */}
      <Card className="border-indigo-100 shadow-sm">
        <CardHeader className="bg-indigo-50/40 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-indigo-950">
              <Clock className="h-5 w-5 text-indigo-600" />
              Receptionist Ring Timeout & AI Overflow Control
            </CardTitle>
            <Badge className={draft.aiOverflowEnabled !== false ? "bg-emerald-600 text-white text-xs" : "bg-slate-400 text-white text-xs"}>
              {draft.aiOverflowEnabled !== false ? "AI Overflow Active" : "AI Overflow Disabled"}
            </Badge>
          </div>
          <CardDescription className="text-xs text-indigo-900/80">
            Configure how long incoming calls ring human receptionists before automatically overflowing to Sarvam Voice Agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Receptionist Ring Timeout (Seconds) *
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={5}
                  max={60}
                  value={draft.receptionistRingTimeoutSeconds ?? 20}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      receptionistRingTimeoutSeconds: parseInt(e.target.value, 10) || 20,
                    })
                  }
                  className="w-24 text-sm font-mono"
                />
                <span className="text-xs text-slate-500">
                  Calls ring human staff for this duration (e.g. 15-20s = 3-4 rings) before overflow.
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                AI Overflow to Sarvam Voice Agent
              </label>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="aiOverflowToggle"
                  checked={draft.aiOverflowEnabled !== false}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      aiOverflowEnabled: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-[#0C5DB8] rounded border-slate-300"
                />
                <label htmlFor="aiOverflowToggle" className="text-sm font-medium text-slate-800 cursor-pointer">
                  Enable automatic Sarvam AI overflow when receptionist is busy, unavailable or times out
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Ring Timeout / No-Answer Handling
              </label>
              <select
                className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800"
                value={draft.noAnswerBehavior || "AI_VOICEBOT"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    noAnswerBehavior: e.target.value as any,
                  })
                }
              >
                <option value="AI_VOICEBOT">Route to Sarvam AI Voicebot (Recommended)</option>
                <option value="HUMAN_FALLBACK">Route to Supervisor Fallback Desk</option>
                <option value="VOICEMAIL">Take Caller Voicemail</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Receptionist Busy Handling
              </label>
              <select
                className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800"
                value={draft.busyBehavior || "AI_VOICEBOT"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    busyBehavior: e.target.value as any,
                  })
                }
              >
                <option value="AI_VOICEBOT">Route to Sarvam AI Voicebot (Zero Wait)</option>
                <option value="HUMAN_FALLBACK">Route to Secondary Receptionist</option>
                <option value="BUSY_TONE">Play Busy Tone / Queue</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Staff Offline / Break Handling
              </label>
              <select
                className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800"
                value={draft.unavailableBehavior || "AI_VOICEBOT"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    unavailableBehavior: e.target.value as any,
                  })
                }
              >
                <option value="AI_VOICEBOT">Route to Sarvam AI Voicebot</option>
                <option value="CASUALTY_TRANSFER">Transfer to Emergency Casualty Desk</option>
                <option value="VOICEMAIL">Voicemail Callback Queue</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2.2 ADDITIONAL RECEPTIONISTS (MULTI-AGENT HUNT GROUP) */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Additional Receptionists & Staff Extensions (Multi-Agent Support)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Configure secondary reception desks or staff extensions for sequential hunting or overflow distribution.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addAdditionalReceptionist} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Staff Agent
          </Button>
        </CardHeader>
        <CardContent>
          {(!draft.additionalReceptionists || draft.additionalReceptionists.length === 0) ? (
            <div className="text-center py-6 text-sm text-slate-500 border border-dashed rounded-md">
              No additional receptionist numbers configured. Single primary receptionist active.
            </div>
          ) : (
            <div className="space-y-3">
              {draft.additionalReceptionists.map((agent, idx) => (
                <div
                  key={agent.id || idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-slate-50 rounded-md border border-slate-200 items-center"
                >
                  <div className="md:col-span-3">
                    <label className="text-xs text-slate-500 block mb-0.5">Staff / Desk Name</label>
                    <Input
                      value={agent.name}
                      onChange={(e) => {
                        const updated = [...(draft.additionalReceptionists || [])];
                        updated[idx].name = e.target.value;
                        setDraft({ ...draft, additionalReceptionists: updated });
                      }}
                      className="text-sm bg-white"
                      placeholder="e.g. Counter 2 Reception"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 block mb-0.5">Extension</label>
                    <Input
                      value={agent.extension || ""}
                      onChange={(e) => {
                        const updated = [...(draft.additionalReceptionists || [])];
                        updated[idx].extension = e.target.value;
                        setDraft({ ...draft, additionalReceptionists: updated });
                      }}
                      className="text-sm bg-white"
                      placeholder="202"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-xs text-slate-500 block mb-0.5">Direct E.164 Number *</label>
                    <Input
                      value={agent.phoneNumber}
                      onChange={(e) => {
                        const updated = [...(draft.additionalReceptionists || [])];
                        updated[idx].phoneNumber = e.target.value;
                        setDraft({ ...draft, additionalReceptionists: updated });
                      }}
                      className="text-sm font-mono bg-white"
                      placeholder="+914872475202"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 block mb-0.5">Hunt Priority</label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={agent.priority || idx + 2}
                      onChange={(e) => {
                        const updated = [...(draft.additionalReceptionists || [])];
                        updated[idx].priority = parseInt(e.target.value, 10) || 2;
                        setDraft({ ...draft, additionalReceptionists: updated });
                      }}
                      className="text-sm bg-white font-mono"
                    />
                  </div>
                  <div className="md:col-span-1 text-right">
                    <label className="text-xs text-transparent block mb-0.5">Action</label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 h-8 w-8"
                      onClick={() => removeAdditionalReceptionist(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. DEPARTMENT DESTINATIONS */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-600" />
              Specialty Department Destinations
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Department-specific direct dial destinations for clinical departments (Cardiology, Orthopedics, Pediatrics, Billing).
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addDepartment} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Department
          </Button>
        </CardHeader>
        <CardContent>
          {draft.departmentDestinations.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500 border border-dashed rounded-md">
              No specialty departments configured yet. Click "Add Department" to configure direct routing.
            </div>
          ) : (
            <div className="space-y-3">
              {draft.departmentDestinations.map((dept, idx) => (
                <div
                  key={dept.id || idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-slate-50 rounded-md border border-slate-200 items-center"
                >
                  <div className="md:col-span-3">
                    <label className="text-xs text-slate-500 block mb-0.5">Department Name</label>
                    <Input
                      value={dept.name}
                      onChange={(e) => {
                        const updated = [...draft.departmentDestinations];
                        updated[idx].name = e.target.value;
                        setDraft({ ...draft, departmentDestinations: updated });
                      }}
                      className="text-sm bg-white"
                      placeholder="e.g. Cardiology OPD"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 block mb-0.5">Department ID</label>
                    <Input
                      value={dept.id}
                      onChange={(e) => {
                        const updated = [...draft.departmentDestinations];
                        updated[idx].id = e.target.value;
                        setDraft({ ...draft, departmentDestinations: updated });
                      }}
                      className="text-xs font-mono bg-white"
                      placeholder="dept_cardiology"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 block mb-0.5">Extension</label>
                    <Input
                      value={dept.extension || ""}
                      onChange={(e) => {
                        const updated = [...draft.departmentDestinations];
                        updated[idx].extension = e.target.value;
                        setDraft({ ...draft, departmentDestinations: updated });
                      }}
                      className="text-sm bg-white"
                      placeholder="102"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-xs text-slate-500 block mb-0.5">Direct E.164 Number *</label>
                    <Input
                      value={dept.phoneNumber}
                      onChange={(e) => {
                        const updated = [...draft.departmentDestinations];
                        updated[idx].phoneNumber = e.target.value;
                        setDraft({ ...draft, departmentDestinations: updated });
                      }}
                      className="text-sm font-mono bg-white"
                      placeholder="+914872475102"
                    />
                  </div>
                  <div className="md:col-span-1 text-right">
                    <label className="text-xs text-transparent block mb-0.5">Action</label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 h-8 w-8"
                      onClick={() => removeDepartment(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. AFTER HOURS & FALLBACK */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              After-Hours Call Handling
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Escalation behavior when inbound calls arrive outside published OPD hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.businessHours?.enabled ?? false}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        businessHours: {
                          enabled: e.target.checked,
                          timezone: draft.businessHours?.timezone || "Asia/Kolkata",
                          openTime: draft.businessHours?.openTime || "08:00",
                          closeTime: draft.businessHours?.closeTime || "20:00",
                          workingDays: draft.businessHours?.workingDays || [1, 2, 3, 4, 5, 6],
                        },
                      })
                    }
                    className="h-4 w-4 rounded text-[#0C5DB8]"
                  />
                  <span>Enforce OPD Business Hours Schedule</span>
                </label>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {draft.businessHours?.timezone || "Asia/Kolkata"}
                </Badge>
              </div>

              {draft.businessHours?.enabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Open Time (24h)</label>
                    <Input
                      type="text"
                      placeholder="08:00"
                      value={draft.businessHours.openTime}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          businessHours: {
                            ...draft.businessHours!,
                            openTime: e.target.value,
                          },
                        })
                      }
                      className="text-xs font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Close Time (24h)</label>
                    <Input
                      type="text"
                      placeholder="20:00"
                      value={draft.businessHours.closeTime}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          businessHours: {
                            ...draft.businessHours!,
                            closeTime: e.target.value,
                          },
                        })
                      }
                      className="text-xs font-mono bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                After-Hours Behavior
              </label>
              <select
                className="w-full text-sm border border-slate-300 rounded px-3 py-2 bg-white"
                value={draft.afterHoursDestination.behavior}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    afterHoursDestination: {
                      ...draft.afterHoursDestination,
                      behavior: e.target.value as any,
                    },
                  })
                }
              >
                <option value="CASUALTY_TRANSFER">Transfer to 24/7 Casualty Desk</option>
                <option value="EMERGENCY_TRANSFER">Emergency Direct Transfer</option>
                <option value="AI_VOICEBOT">AI Voicebot Only (Next Morning Callback)</option>
                <option value="VOICEMAIL">Voicemail Ledger</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                After-Hours Destination Number (E.164)
              </label>
              <Input
                value={draft.afterHoursDestination.primaryNumber || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    afterHoursDestination: {
                      ...draft.afterHoursDestination,
                      primaryNumber: e.target.value,
                    },
                  })
                }
                placeholder="+919606654032"
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              Human Fallback / Ring-No-Answer
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Emergency supervisor fallback if staff receptionist does not answer within timeout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Supervisor Fallback Destination (E.164)
              </label>
              <Input
                value={draft.humanFallbackDestination.primaryNumber || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    humanFallbackDestination: {
                      ...draft.humanFallbackDestination,
                      primaryNumber: e.target.value,
                    },
                  })
                }
                placeholder="+919606654032"
                className="font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Duty Operations Supervisor Name
              </label>
              <Input
                value={draft.humanFallbackDestination.supervisorName || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    humanFallbackDestination: {
                      ...draft.humanFallbackDestination,
                      supervisorName: e.target.value,
                    },
                  })
                }
                placeholder="Duty Operations Manager"
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. DRY-RUN SIMULATOR & VALIDATOR */}
      <Card className="border-teal-100 bg-teal-50/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-teal-900">
                <Play className="h-5 w-5 text-teal-600" />
                Live Routing Simulator (Carrier Dry-Run)
              </CardTitle>
              <CardDescription className="text-xs text-teal-700">
                Test how Exotel Connect Applet dynamically resolves destinations without placing an actual PSTN call.
              </CardDescription>
            </div>
            <Button
              size="sm"
              className="bg-teal-700 hover:bg-teal-800 text-white gap-1.5"
              onClick={handleSimulate}
              disabled={simulating}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {simulating ? "Simulating..." : "Test Resolution"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Escalation Trigger Type
              </label>
              <select
                className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                value={simEscalationType}
                onChange={(e) => setSimEscalationType(e.target.value as EscalationType)}
              >
                <option value="EMERGENCY">EMERGENCY (Chest pain / acute trauma)</option>
                <option value="HUMAN_TRANSFER">HUMAN_TRANSFER (Receptionist request)</option>
                <option value="DEPARTMENT">DEPARTMENT (Specific Clinical OPD)</option>
                <option value="AFTER_HOURS">AFTER_HOURS (Night call triage)</option>
                <option value="FALLBACK">FALLBACK (No answer / supervisor)</option>
              </select>
            </div>

            {simEscalationType === "DEPARTMENT" && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Select Department
                </label>
                <select
                  className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  value={simDepartmentId}
                  onChange={(e) => setSimDepartmentId(e.target.value)}
                >
                  <option value="">-- Choose Department --</option>
                  {draft.departmentDestinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.phoneNumber})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Simulation Output Card */}
          {simulationResult && (
            <div className="p-4 bg-white rounded-lg border border-teal-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Simulation Outcome
                </span>
                <Badge className={simulationResult.success ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}>
                  {simulationResult.success ? "RESOLVED (HTTP 200)" : "FAILED (HTTP 404)"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
                <div>
                  <span className="text-slate-500 block">Dialed Destination:</span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {simulationResult.destinationNumber || "None (Fails Closed)"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Department:</span>
                  <span className="font-medium text-slate-800">{simulationResult.departmentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Rule Applied:</span>
                  <span className="font-mono text-slate-700">{simulationResult.routingRule}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Version Used:</span>
                  <span className="font-mono text-slate-700">v{simulationResult.versionUsed}</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Exotel Connect Applet Payload: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">
                    Content-Type: text/plain | "{simulationResult.destinationNumber}"
                  </code>
                </span>
                {simulationResult.success && (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valid E.164 Destination
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Footer: Save Draft & Publish */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <div className="text-xs text-slate-500">
          Last updated: {draft.publishedAt ? new Date(draft.publishedAt).toLocaleString() : "Unsaved Draft"}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleSaveDraft}
            disabled={saving}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            className="bg-[#0C5DB8] hover:bg-[#09478f] text-white gap-1.5"
            onClick={() => setPublishModalOpen(true)}
            disabled={validationErrors.length > 0}
          >
            <Send className="h-4 w-4" />
            Publish Version
          </Button>
        </div>
      </div>

      {/* 6. IMMUTABLE VERSION HISTORY & AUDIT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-5 w-5 text-slate-600" />
            Immutable Version History & Rollback Ledger
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Active calls continue using the version assigned at call initiation. Publishing creates an immutable snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              No published version snapshots recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {versions.map((v) => (
                <div key={v.versionNumber} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">
                        Version v{v.versionNumber}
                      </span>
                      {v.isActive ? (
                        <Badge className="bg-emerald-600 text-white text-xs">Currently Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-slate-500">Archived</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{v.changelog || "No changelog provided"}</p>
                    <span className="text-[11px] text-slate-400">
                      Published by {v.publishedBy} on {new Date(v.publishedAt).toLocaleString()}
                    </span>
                  </div>

                  {!v.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => handleRollback(v.versionNumber)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Rollback
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publish Modal */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publish Immutable Routing Version"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-slate-600">
            Publishing will lock this routing configuration into an immutable version snapshot. Active ongoing calls will continue on their current version. New incoming calls will immediately route to these destinations.
          </p>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Changelog / Deployment Notes *
            </label>
            <Input
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="e.g. Updated casualty desk to +919606654032 and added Cardiology OPD"
              className="text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setPublishModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#0C5DB8] text-white"
              onClick={handlePublish}
              disabled={publishing || !changelog.trim()}
            >
              {publishing ? "Publishing..." : "Confirm & Publish"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

