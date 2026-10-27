"use client";

import * as React from "react";
import {
  Save,
  CheckCircle2,
  Cpu,
  Database,
  Radio,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserRole } from "@/types";

export default function SettingsPage() {
  const [currentUserRole, setCurrentUserRole] = React.useState<UserRole>("HOSPITAL_ADMIN");
  const [retentionDays, setRetentionDays] = React.useState("30");
  const [enableMalayalamConsent, setEnableMalayalamConsent] = React.useState(true);
  const [strictMasking, setStrictMasking] = React.useState(true);
  const [missedCallThreshold, setMissedCallThreshold] = React.useState("10");
  const [hmsTimeoutAlert, setHmsTimeoutAlert] = React.useState(true);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Mock staff list
  const [staffUsers] = React.useState([
    {
      id: "usr_1",
      name: "Dr. Anjali Menon",
      email: "anjali.menon@dayahospital.com",
      role: "HOSPITAL_ADMIN" as UserRole,
      department: "Informatics & Medical Admin",
      status: "ACTIVE",
    },
    {
      id: "usr_2",
      name: "Sister Mary",
      email: "mary.opd@dayahospital.com",
      role: "CALL_REVIEWER" as UserRole,
      department: "OPD Triage Lead",
      status: "ACTIVE",
    },
    {
      id: "usr_3",
      name: "Prakash Nair",
      email: "prakash.tpa@dayahospital.com",
      role: "CALL_REVIEWER" as UserRole,
      department: "TPA & Cashless Insurance Desk",
      status: "ACTIVE",
    },
    {
      id: "usr_4",
      name: "Dr. Suresh Kumar",
      email: "suresh.ortho@dayahospital.com",
      role: "CALL_REVIEWER" as UserRole,
      department: "Orthopaedics Lead",
      status: "ACTIVE",
    },
  ]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Hospital Settings & Access Control"
          description="Role permissions, patient data redaction rules, recording retention policies, and alert thresholds."
          badge={
            <Badge variant="teal" size="sm">
              NABH Privacy Aligned
            </Badge>
          }
          breadcrumbs={[
            { label: "Overview", href: "/overview" },
            { label: "Settings" },
          ]}
          actions={
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg text-xs">
              <span className="text-slate-500 font-medium pl-1 hidden sm:inline">Viewing as:</span>
              <button
                onClick={() => setCurrentUserRole("HOSPITAL_ADMIN")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  currentUserRole === "HOSPITAL_ADMIN"
                    ? "bg-[#0C5DB8] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Hospital Admin
              </button>
              <button
                onClick={() => setCurrentUserRole("CALL_REVIEWER")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  currentUserRole === "CALL_REVIEWER"
                    ? "bg-[#0C5DB8] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Call Reviewer
              </button>
            </div>
          }
        />

        {savedSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              Hospital privacy and calling settings have been saved and applied.
            </span>
          </div>
        )}

        {/* Settings Tabs */}
        <Tabs defaultValue="privacy">
          <TabsList className="mb-4">
            <TabsTrigger value="privacy">Recording & Patient Privacy</TabsTrigger>
            <TabsTrigger value="users">User Access & Staff Roles</TabsTrigger>
            <TabsTrigger value="alerts">Alert Thresholds & Escalations</TabsTrigger>
            <TabsTrigger value="integrations">Integration Gateways Status</TabsTrigger>
          </TabsList>

          {/* Tab 1: Privacy & Retention */}
          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle>Audio Recording, Consent & Data Retention</CardTitle>
                <CardDescription>
                  Configure clinical audio retention limits and Malayalam statutory consent announcements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-5 text-xs max-w-2xl">
                  {/* Retention */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-800 block">
                      Call Audio Recording Retention Policy
                    </label>
                    <p className="text-slate-500">
                      Recordings older than the selected retention period will be automatically and permanently purged from hospital storage.
                    </p>
                    <select
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(e.target.value)}
                      disabled={currentUserRole !== "HOSPITAL_ADMIN"}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                    >
                      <option value="15">15 Days (High-turnover strict compliance)</option>
                      <option value="30">30 Days (Standard Daya Hospital Policy)</option>
                      <option value="60">60 Days (Extended Quality Audit)</option>
                      <option value="90">90 Days (Maximum Accredited Window)</option>
                    </select>
                  </div>

                  {/* Malayalam Consent toggle */}
                  <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <input
                      type="checkbox"
                      id="consent-toggle"
                      checked={enableMalayalamConsent}
                      onChange={(e) => setEnableMalayalamConsent(e.target.checked)}
                      disabled={currentUserRole !== "HOSPITAL_ADMIN"}
                      className="mt-0.5 rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
                    />
                    <label htmlFor="consent-toggle" className="cursor-pointer">
                      <span className="font-semibold text-slate-900 block">
                        Mandatory Malayalam Call Recording Disclosure
                      </span>
                      <span className="text-slate-500 block mt-0.5">
                        Sarvam agent speaks: &ldquo;സേവന നിലവാരം മെച്ചപ്പെടുത്തുന്നതിനായി ഈ സംഭാഷണം റെക്കോർഡ് ചെയ്യപ്പെടുന്നതാണ്&rdquo; (This call is recorded for quality purposes).
                      </span>
                    </label>
                  </div>

                  {/* Phone Masking toggle */}
                  <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <input
                      type="checkbox"
                      id="masking-toggle"
                      checked={strictMasking}
                      onChange={(e) => setStrictMasking(e.target.checked)}
                      disabled={currentUserRole !== "HOSPITAL_ADMIN"}
                      className="mt-0.5 rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
                    />
                    <label htmlFor="masking-toggle" className="cursor-pointer">
                      <span className="font-semibold text-slate-900 block">
                        Enforce Strict Patient Phone Masking (+91 98460 •••••)
                      </span>
                      <span className="text-slate-500 block mt-0.5">
                        Mask caller phone numbers in standard dashboard views. Unmasking requires deliberate click and role verification audit.
                      </span>
                    </label>
                  </div>

                  {currentUserRole === "HOSPITAL_ADMIN" ? (
                    <div className="pt-2">
                      <Button type="submit" size="sm" className="bg-[#0C5DB8] gap-1.5">
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Privacy Settings</span>
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 italic">
                      Note: You are currently viewing as Call Reviewer. Only Hospital Administrators can modify retention and privacy policies.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: User Access & Staff Roles */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Hospital Staff User Management</CardTitle>
                  <CardDescription>
                    Role-Based Access Control: Administrators manage configuration; Call Reviewers audit calls and follow-ups
                  </CardDescription>
                </div>
                {currentUserRole === "HOSPITAL_ADMIN" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => alert("Invite link generated for hospital staff onboarding.")}
                    className="text-xs text-[#0C5DB8]"
                  >
                    Add Staff Reviewer
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden text-xs">
                  {staffUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F2FC] text-[#0C5DB8] font-bold">
                          {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {user.name}
                            </span>
                            <Badge
                              variant={user.role === "HOSPITAL_ADMIN" ? "default" : "secondary"}
                              size="sm"
                            >
                              {user.role === "HOSPITAL_ADMIN"
                                ? "Hospital Admin"
                                : "Call Reviewer"}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {user.email} • {user.department}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-emerald-600/20">
                          Active
                        </span>
                        {currentUserRole === "HOSPITAL_ADMIN" && user.id !== "usr_1" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => alert(`Permissions updated for ${user.name}`)}
                            className="h-7 text-xs text-slate-500"
                          >
                            Manage
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Alert Thresholds */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Notification Triggers & Escalations</CardTitle>
                <CardDescription>
                  Configure automated thresholds for missed calls and delayed HMS slot bookings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs max-w-xl">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-800 block">
                      Missed Call Spike Alert (Threshold per Hour)
                    </label>
                    <p className="text-slate-500">
                      Send urgent SMS/Email alert to Duty Administrator if missed or unhandled calls exceed this rate.
                    </p>
                    <Input
                      type="number"
                      value={missedCallThreshold}
                      onChange={(e) => setMissedCallThreshold(e.target.value)}
                      disabled={currentUserRole !== "HOSPITAL_ADMIN"}
                      className="w-32"
                    />
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <input
                      type="checkbox"
                      id="hms-alert-toggle"
                      checked={hmsTimeoutAlert}
                      onChange={(e) => setHmsTimeoutAlert(e.target.checked)}
                      disabled={currentUserRole !== "HOSPITAL_ADMIN"}
                      className="mt-0.5 rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
                    />
                    <label htmlFor="hms-alert-toggle" className="cursor-pointer">
                      <span className="font-semibold text-slate-900 block">
                        Daya HMS Latency & Timeout Warning
                      </span>
                      <span className="text-slate-500 block mt-0.5">
                        Immediately notify IT desk when HMS slot verification exceeds 3000ms.
                      </span>
                    </label>
                  </div>

                  {currentUserRole === "HOSPITAL_ADMIN" && (
                    <Button type="submit" size="sm" className="bg-[#0C5DB8] gap-1.5 mt-2">
                      <Save className="h-3.5 w-3.5" />
                      <span>Save Alert Settings</span>
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Integration Gateways (Sanitized - no exposed secrets) */}
          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <CardTitle>Integration Gateways Health & Connectivity</CardTitle>
                <CardDescription>
                  Operational status of Sarvam Voice, Daya HMS and IVR Telephony. Secrets and keys are secured server-side.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {/* Integration 1: Sarvam AI */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-[#0C5DB8]" />
                      <span className="font-bold text-slate-900">
                        Sarvam AI Voice Engine (Malayalam)
                      </span>
                    </div>
                    <Badge variant="teal">Mock Sandbox Active</Badge>
                  </div>
                  <p className="text-slate-500">
                    Handles streaming speech-to-text, natural Malayalam synthesis, and clinical intent classification.
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-600 font-mono pt-1">
                    <span>Engine: Saarathi Malayalam v2.4</span>
                    <span>Endpoint: Mock Adapter (Local)</span>
                    <span className="text-emerald-700 font-semibold">Ping: 240ms</span>
                  </div>
                </div>

                {/* Integration 2: Daya HMS */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#18A99D]" />
                      <span className="font-bold text-slate-900">
                        Daya Hospital Management System (HMS)
                      </span>
                    </div>
                    <Badge variant="teal">Mock Sandbox Active</Badge>
                  </div>
                  <p className="text-slate-500">
                    Authorised REST integration for doctor timetable lookup, slot locking, and token generation.
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-600 font-mono pt-1">
                    <span>Protocol: HTTPS REST + Idempotency Headers</span>
                    <span>Target: Daya OPD Microservice</span>
                    <span className="text-emerald-700 font-semibold">Status: Verified</span>
                  </div>
                </div>

                {/* Integration 3: IVR Trunk */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-sky-600" />
                      <span className="font-bold text-slate-900">
                        Hospital IVR & SIP Telephony Provider
                      </span>
                    </div>
                    <Badge variant="teal">Mock Sandbox Active</Badge>
                  </div>
                  <p className="text-slate-500">
                    Routes busy/unanswered hospital trunk calls to Sarvam SIP gateway with caller CLI forwarding.
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-600 font-mono pt-1">
                    <span>Capacity: 30 Concurrent Trunks</span>
                    <span>Current Active: 18 Calls</span>
                    <span className="text-emerald-700 font-semibold">Audio Codec: G.711 / Opus</span>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-900">
                  <span className="font-bold block">Hospital Security Policy:</span>
                  Sarvam Agent IDs, HMS authorization tokens, and SIP trunk credentials are kept strictly in server-side environment variables and are never transmitted to client bundles.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
