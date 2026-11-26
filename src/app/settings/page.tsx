"use client";

import * as React from "react";
import Link from "next/link";
import {
  User,
  Shield,
  ShieldCheck,
  Lock,
  Bell,
  Cpu,
  Database,
  Radio,
  Save,
  AlertCircle,
  Plus,
  UserX,
  Volume2,
  KeyRound,
  Server,
  Info,
  Clock,
} from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { UserProfile, SystemIncident } from "@/types";
import { formatDateTime } from "@/lib/utils";
import {
  changePasswordSchema,
  ChangePasswordFormData,
  createUserSchema,
  CreateUserFormData,
  hospitalSettingsSchema,
  HospitalSettingsFormData,
} from "@/lib/validations/auth-schema";
import { HospitalSettings } from "@/lib/services/settings-service";
import { HospitalRoutingSettings } from "@/components/settings/hospital-routing-settings";
import { SarvamVoiceAgentSettings } from "@/components/settings/sarvam-voice-agent-settings";

export default function SettingsPage() {
  const { showToast } = useToast();
  const { user: currentUser, isAdmin } = useAuth();

  // Settings State
  const [settings, setSettings] = React.useState<HospitalSettings | null>(null);
  const [usersList, setUsersList] = React.useState<UserProfile[]>([]);
  const [incidents, setIncidents] = React.useState<SystemIncident[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Modals & Action States
  const [isAddUserOpen, setIsAddUserOpen] = React.useState(false);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  // Fetch initial data
  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [settingsRes, usersRes, statusRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/settings/users"),
        fetch("/api/settings/status"),
      ]);

      if (settingsRes.ok) {
        const json = await settingsRes.json();
        if (json.success) setSettings(json.data);
      }

      if (usersRes.ok) {
        const json = await usersRes.json();
        if (json.success) setUsersList(json.data);
      }

      if (statusRes.ok) {
        const json = await statusRes.json();
        if (json.success && json.data) {
          setIncidents(json.data.incidents || []);
        }
      }
    } catch (err) {
      console.error("Failed to load settings data:", err);
      showToast({
        type: "error",
        title: "Load Error",
        message: "Failed to load hospital settings from server.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [settingsRes, usersRes, statusRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/settings/users"),
          fetch("/api/settings/status"),
        ]);

        if (!isMounted) return;

        if (settingsRes.ok) {
          const json = await settingsRes.json();
          if (json.success && isMounted) setSettings(json.data);
        }

        if (usersRes.ok) {
          const json = await usersRes.json();
          if (json.success && isMounted) setUsersList(json.data);
        }

        if (statusRes.ok) {
          const json = await statusRes.json();
          if (json.success && json.data && isMounted) {
            setIncidents(json.data.incidents || []);
          }
        }
      } catch (err) {
        console.error("Failed to load settings data:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Form: Change Password
  const {
    register: registerPwd,
    handleSubmit: handlePwdSubmit,
    reset: resetPwdForm,
    formState: { errors: pwdErrors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema) as unknown as Resolver<ChangePasswordFormData>,
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onChangePassword = async (data: ChangePasswordFormData) => {
    try {
      setIsChangingPassword(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Password Changed",
          message: "Your hospital staff account password has been updated.",
        });
        resetPwdForm();
      } else {
        showToast({
          type: "error",
          title: "Password Change Failed",
          message: json.error || "Current password does not match.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Network error while changing password.",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Form: Add New User (Admin Only)
  const {
    register: registerUser,
    handleSubmit: handleUserSubmit,
    reset: resetUserForm,
    formState: { errors: userErrors },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema) as unknown as Resolver<CreateUserFormData>,
    defaultValues: {
      name: "",
      email: "",
      role: "HOSPITAL_STAFF",
      department: "",
      phone: "",
      canAccessRecordings: false,
      initialPassword: "DayaStaff@2026",
    },
  });

  const onAddUser = async (data: CreateUserFormData) => {
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Staff Account Created",
          message: json.message || "New staff reviewer account provisioned.",
        });
        setIsAddUserOpen(false);
        resetUserForm();
        await fetchData();
      } else {
        showToast({
          type: "error",
          title: "Creation Failed",
          message: json.error || "Failed to create user.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to connect to user management service.",
      });
    }
  };

  // Toggle user recording permission (Admin Only)
  const handleToggleRecordingAccess = async (user: UserProfile) => {
    if (!isAdmin) return;
    try {
      const newPerm = !user.canAccessRecordings;
      const res = await fetch(`/api/settings/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canAccessRecordings: newPerm }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "info",
          title: "Permissions Updated",
          message: `Call audio recording access ${newPerm ? "granted to" : "restricted for"} ${user.name}.`,
        });
        await fetchData();
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to update user recording permission.",
      });
    }
  };

  // Deactivate user (Admin Only)
  const handleDeactivateUser = async (user: UserProfile) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to deactivate ${user.name}'s account?`)) return;

    try {
      const res = await fetch(`/api/settings/users/${user.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "info",
          title: "User Deactivated",
          message: json.message || "Account deactivated.",
        });
        await fetchData();
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to deactivate staff account.",
      });
    }
  };

  // Form: Save Hospital Settings (Privacy & Alerts)
  const {
    register: registerSettings,
    handleSubmit: handleSettingsSubmit,
  } = useForm<HospitalSettingsFormData>({
    resolver: zodResolver(hospitalSettingsSchema) as unknown as Resolver<HospitalSettingsFormData>,
    values: settings
      ? {
          retentionDays: settings.retentionDays,
          enableMalayalamConsent: settings.enableMalayalamConsent,
          strictMasking: settings.strictMasking,
          defaultStaffRecordingAccess: settings.defaultStaffRecordingAccess,
          missedCallThreshold: settings.missedCallThreshold,
          urgentFollowUpAlerts: settings.urgentFollowUpAlerts,
          emergencyCasualtyAlerts: settings.emergencyCasualtyAlerts,
          dailyDigestEmail: settings.dailyDigestEmail,
        }
      : undefined,
  });

  const onSaveSettings = async (data: HospitalSettingsFormData) => {
    try {
      setIsSavingSettings(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Settings Saved",
          message: "Hospital privacy, recording retention, and alert rules updated.",
        });
        setSettings(json.data);
      } else {
        showToast({
          type: "error",
          title: "Update Failed",
          message: json.error || "Failed to update hospital settings.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to save settings.",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Hospital Settings & Access Control"
          description="Manage your profile, staff roles, clinical audio retention limits, alert triggers, and gateway connectivity."
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
              {isLoading && (
                <span className="text-slate-400 animate-pulse text-[11px] px-1 hidden sm:inline">
                  Syncing...
                </span>
              )}
              <span className="text-slate-500 font-medium pl-1 hidden sm:inline">Active Role:</span>
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  isAdmin
                    ? "bg-[#0C5DB8] text-white shadow-xs"
                    : "bg-[#0E7A71] text-white shadow-xs"
                }`}
              >
                {isAdmin ? "Hospital Administrator" : "Hospital Staff Reviewer"}
              </span>
            </div>
          }
        />

        {/* 5 Organized Settings Tabs */}
        <Tabs defaultValue="profile">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            <TabsTrigger value="users">Users & Roles</TabsTrigger>
            <TabsTrigger value="notifications">Notifications & Alerts</TabsTrigger>
            <TabsTrigger value="privacy">Call Recording & Privacy</TabsTrigger>
            <TabsTrigger value="status">System Status & Gateways</TabsTrigger>
            <TabsTrigger value="telephony">Telephony Provider (Exotel)</TabsTrigger>
            <TabsTrigger value="routing">Dynamic Call Routing</TabsTrigger>
            <TabsTrigger value="voice_agents">Voice Agents (Samvaad)</TabsTrigger>
            <TabsTrigger value="ai_provider">AI Provider (Sarvam)</TabsTrigger>
            <TabsTrigger value="business">Business Hours & Escalation</TabsTrigger>
            <TabsTrigger value="versions">Configuration Versions</TabsTrigger>
          </TabsList>

          {/* TAB 1: MY PROFILE */}
          <TabsContent value="profile">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Profile Details Card */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-[#0C5DB8]" />
                    <span>Hospital Staff Profile</span>
                  </CardTitle>
                  <CardDescription>
                    Your active hospital credentials and clinical system permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0C5DB8] text-white text-lg font-bold">
                      {(currentUser?.name || "Dr. Anjali Menon")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {currentUser?.name || "Dr. Anjali Menon"}
                        </h3>
                        <Badge variant={isAdmin ? "default" : "secondary"}>
                          {isAdmin ? "Hospital Administrator" : "Staff Reviewer"}
                        </Badge>
                      </div>
                      <p className="text-slate-600">
                        {currentUser?.email || "admin@dayahospital.com"} •{" "}
                        {currentUser?.department || "Informatics & Medical Admin"}
                      </p>
                      <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                        <span>Employee ID: <strong>{currentUser?.employeeId || "DGH-ADM-001"}</strong></span>
                        <span>•</span>
                        <span>Phone: <strong>{currentUser?.phone || "+91 94470 11001"}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Permissions & Security Summary */}
                  <div className="rounded-lg border border-slate-200 p-3.5 space-y-2 bg-white">
                    <h4 className="font-semibold text-slate-900">Authorised Clinical Permissions</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-2 text-slate-700">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span>AI Call Operations & Metrics View</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span>Call Transcripts & Review Notes</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        {isAdmin || currentUser?.canAccessRecordings ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            <span>Audio Call Recording Playback (Permitted)</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <span className="text-amber-800">Recording Playback (Restricted)</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        {isAdmin ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            <span>Knowledge Base Live Publishing (Permitted)</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <span className="text-amber-800">Knowledge Base (Draft Only — No Live Publish)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Change Password Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#0C5DB8]" />
                    <span>Change Password</span>
                  </CardTitle>
                  <CardDescription>Update your personal hospital portal password</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePwdSubmit(onChangePassword)} className="space-y-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">
                        Current Password *
                      </label>
                      <Input
                        {...registerPwd("currentPassword")}
                        type="password"
                        placeholder="••••••••••••"
                        className={pwdErrors.currentPassword ? "border-red-400" : ""}
                      />
                      {pwdErrors.currentPassword && (
                        <p className="text-red-500 text-[11px] mt-1">
                          {pwdErrors.currentPassword.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">
                        New Password *
                      </label>
                      <Input
                        {...registerPwd("newPassword")}
                        type="password"
                        placeholder="Min 6 characters"
                        className={pwdErrors.newPassword ? "border-red-400" : ""}
                      />
                      {pwdErrors.newPassword && (
                        <p className="text-red-500 text-[11px] mt-1">
                          {pwdErrors.newPassword.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">
                        Confirm New Password *
                      </label>
                      <Input
                        {...registerPwd("confirmPassword")}
                        type="password"
                        placeholder="Repeat new password"
                        className={pwdErrors.confirmPassword ? "border-red-400" : ""}
                      />
                      {pwdErrors.confirmPassword && (
                        <p className="text-red-500 text-[11px] mt-1">
                          {pwdErrors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={isChangingPassword}
                      className="w-full bg-[#0C5DB8] text-white mt-2 text-xs"
                    >
                      {isChangingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: USERS & ROLES */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[#0C5DB8]" />
                    <span>Hospital Users & Role Permissions</span>
                  </CardTitle>
                  <CardDescription>
                    Hospital Administrators manage roles and audio access; Staff Reviewers audit calls and follow-ups
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button
                    size="sm"
                    onClick={() => setIsAddUserOpen(true)}
                    className="gap-1.5 text-xs bg-[#0C5DB8] text-white shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Staff User</span>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!isAdmin && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 flex items-start gap-2.5 text-xs text-blue-900">
                    <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                    <p>
                      <strong>Staff Directory View (Read-Only):</strong> You are viewing as a Staff Reviewer. Only Hospital Administrators can add staff, modify roles, or grant call audio listening privileges.
                    </p>
                  </div>
                )}

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden text-xs">
                  {usersList.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F2FC] text-[#0C5DB8] font-bold shrink-0">
                          {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">
                              {user.name}
                            </span>
                            <Badge
                              variant={user.role === "HOSPITAL_ADMIN" ? "default" : "secondary"}
                              size="sm"
                            >
                              {user.role === "HOSPITAL_ADMIN"
                                ? "Hospital Administrator"
                                : "Staff Reviewer"}
                            </Badge>
                            {user.canAccessRecordings ? (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                                Audio Recording Permitted
                              </span>
                            ) : (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                Audio Restricted
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {user.email} • {user.department} {user.employeeId ? `• ${user.employeeId}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                            user.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                              : "bg-slate-100 text-slate-600 ring-slate-300"
                          }`}
                        >
                          {user.status === "ACTIVE" ? "Active" : "Deactivated"}
                        </span>

                        {isAdmin && user.id !== currentUser?.id && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleRecordingAccess(user)}
                              className="h-7 text-[11px] gap-1 px-2 text-slate-700"
                              title="Toggle Audio Recording Permission"
                            >
                              <Volume2 className="h-3 w-3" />
                              <span>{user.canAccessRecordings ? "Revoke Audio" : "Grant Audio"}</span>
                            </Button>

                            {user.status === "ACTIVE" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeactivateUser(user)}
                                className="h-7 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                              >
                                <UserX className="h-3 w-3" />
                                <span>Deactivate</span>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: NOTIFICATIONS & ALERTS */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-[#0C5DB8]" />
                  <span>Hospital Calling Notifications & Triggers</span>
                </CardTitle>
                <CardDescription>
                  Configure automated alert dispatches for missed calls, patient follow-ups, and casualty escalations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSettingsSubmit(onSaveSettings)}
                  className="space-y-4 text-xs max-w-2xl"
                >
                  {/* Missed Calls Spike Alert */}
                  <div className="space-y-1.5 p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <label className="font-semibold text-slate-800 block">
                      Missed Call Spike Alert (Threshold per Hour)
                    </label>
                    <p className="text-slate-500 text-[11px]">
                      Send urgent SMS/Email alert to Duty Administrator if missed or unhandled calls exceed this rate.
                    </p>
                    <Input
                      type="number"
                      {...registerSettings("missedCallThreshold")}
                      disabled={!isAdmin}
                      className="w-32 text-xs"
                    />
                  </div>

                  {/* Urgent Follow-Up Alert */}
                  <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-white">
                    <input
                      type="checkbox"
                      id="urgent-followup-toggle"
                      {...registerSettings("urgentFollowUpAlerts")}
                      disabled={!isAdmin}
                      className="mt-0.5 rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
                    />
                    <label htmlFor="urgent-followup-toggle" className="cursor-pointer">
                      <span className="font-semibold text-slate-900 block">
                        Patient Follow-Up Queue Alert
                      </span>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        Immediately notify OPD nurses when an AI conversation flags unconfirmed doctor booking or required callback.
                      </span>
                    </label>
                  </div>

                  {/* Emergency Casualty Escalation */}
                  <div className="flex items-start gap-3 p-3.5 rounded-lg border border-rose-200 bg-rose-50/40">
                    <input
                      type="checkbox"
                      id="casualty-alert-toggle"
                      {...registerSettings("emergencyCasualtyAlerts")}
                      disabled={!isAdmin}
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-600"
                    />
                    <label htmlFor="casualty-alert-toggle" className="cursor-pointer">
                      <span className="font-semibold text-rose-900 block">
                        Emergency Casualty Call Notification (Ext 100)
                      </span>
                      <span className="text-slate-600 block text-[11px] mt-0.5">
                        Send real-time alert to Casualty Medical Officer when callers mention acute chest pain, trauma, or stroke symptoms.
                      </span>
                    </label>
                  </div>

                  {/* Daily AI Operations Digest */}
                  <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-white">
                    <input
                      type="checkbox"
                      id="digest-toggle"
                      {...registerSettings("dailyDigestEmail")}
                      disabled={!isAdmin}
                      className="mt-0.5 rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
                    />
                    <label htmlFor="digest-toggle" className="cursor-pointer">
                      <span className="font-semibold text-slate-900 block">
                        Daily AI Calling Executive Digest
                      </span>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        Compile daily summary of total calls, resolved enquiries, booking volume, and staff follow-ups at 8:00 AM.
                      </span>
                    </label>
                  </div>

                  {isAdmin ? (
                    <Button
                      type="submit"
                      disabled={isSavingSettings}
                      size="sm"
                      className="bg-[#0C5DB8] text-white gap-1.5 mt-2 text-xs"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{isSavingSettings ? "Saving..." : "Save Notification Settings"}</span>
                    </Button>
                  ) : (
                    <p className="text-slate-500 italic text-[11px]">
                      Viewing as Staff Reviewer (Read-Only). Contact Medical Admin to modify alert thresholds.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: CALL RECORDING & PRIVACY CONTROLS */}
          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-[#0C5DB8]" />
                  <span>Call Audio Recording & Patient Privacy Controls</span>
                </CardTitle>
                <CardDescription>
                  Configure clinical audio retention limits, phone masking, and Malayalam statutory consent announcements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSettingsSubmit(onSaveSettings)}
                  className="space-y-4 text-xs max-w-2xl"
                >
                  {/* Retention Window */}
                  <div className="space-y-1.5 p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <label className="font-semibold text-slate-800 block">
                      Audio Recording Retention Policy
                    </label>
                    <p className="text-slate-500 text-[11px]">
                      Recordings older than the selected retention period will be automatically and permanently purged from hospital storage.
                    </p>
                    <select
                      {...registerSettings("retentionDays")}
                      disabled={!isAdmin}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                    >
                      <option value="15">15 Days (High-turnover strict compliance)</option>
                      <option value="30">30 Days (Standard Daya Hospital Policy)</option>
                      <option value="60">60 Days (Extended Quality Audit)</option>
                      <option value="90">90 Days (Maximum Accredited Window)</option>
                    </select>
                  </div>

                  {/* Malayalam Consent Toggle */}
                  <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-white">
                    <input
                      type="checkbox"
                      id="consent-toggle-settings"
                      {...registerSettings("enableMalayalamConsent")}
                      disabled={!isAdmin}
                      className="mt-0.5 rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
                    />
                    <label htmlFor="consent-toggle-settings" className="cursor-pointer">
                      <span className="font-semibold text-slate-900 block">
                        Mandatory Malayalam Call Recording Disclosure
                      </span>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        Smrko Voice speaks: &ldquo;സേവന നിലവാരം മെച്ചപ്പെടുത്തുന്നതിനായി ഈ സംഭാഷണം റെക്കോർഡ് ചെയ്യപ്പെടുന്നതാണ്&rdquo; (This call is recorded for quality purposes).
                      </span>
                    </label>
                  </div>

                  {/* Phone Masking Toggle */}
                  <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-white">
                    <input
                      type="checkbox"
                      id="masking-toggle-settings"
                      {...registerSettings("strictMasking")}
                      disabled={!isAdmin}
                      className="mt-0.5 rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
                    />
                    <label htmlFor="masking-toggle-settings" className="cursor-pointer">
                      <span className="font-semibold text-slate-900 block">
                        Enforce Strict Patient Phone Masking (+91 98460 •••••)
                      </span>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        Mask caller phone numbers across all staff dashboard views. Unmasking requires deliberate click and role verification audit.
                      </span>
                    </label>
                  </div>

                  {/* Default Call Reviewer Recording Access */}
                  <div className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-white">
                    <input
                      type="checkbox"
                      id="default-recording-toggle"
                      {...registerSettings("defaultStaffRecordingAccess")}
                      disabled={!isAdmin}
                      className="mt-0.5 rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
                    />
                    <label htmlFor="default-recording-toggle" className="cursor-pointer">
                      <span className="font-semibold text-slate-900 block">
                        Default Call Reviewer Audio Access
                      </span>
                      <span className="text-slate-500 block text-[11px] mt-0.5">
                        When enabled, newly created staff accounts receive call audio playback access automatically. Otherwise requires explicit individual administrator approval.
                      </span>
                    </label>
                  </div>

                  {isAdmin ? (
                    <Button
                      type="submit"
                      disabled={isSavingSettings}
                      size="sm"
                      className="bg-[#0C5DB8] text-white gap-1.5 mt-2 text-xs"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{isSavingSettings ? "Saving..." : "Save Privacy Settings"}</span>
                    </Button>
                  ) : (
                    <p className="text-slate-500 italic text-[11px]">
                      Viewing as Staff Reviewer (Read-Only). Only Hospital Administrators can modify clinical data retention and privacy policies.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: SYSTEM STATUS & GATEWAYS */}
          <TabsContent value="status">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-[#0C5DB8]" />
                    <span>Integration Gateways Health & Connectivity</span>
                  </CardTitle>
                  <CardDescription>
                    Live health verification of Smrko Voice, Daya HMS, and Telephony IVR. Credentials and keys are protected server-side.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {/* Gateway 1: Smrko Voice */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-[#0C5DB8]" />
                        <span className="font-bold text-slate-900">
                          Smrko Voice Assistant (Malayalam)
                        </span>
                      </div>
                      <Badge variant="teal">Connected (Demo Mode)</Badge>
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      Real-time streaming speech-to-text, natural Malayalam voice synthesis, and clinical intent grounding.
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-600 font-mono pt-1 flex-wrap">
                      <span>Engine: Saarathi Malayalam v2.4</span>
                      <span>Health Check: Healthy</span>
                      <span className="text-emerald-700 font-semibold">Latency: 240ms</span>
                    </div>
                  </div>

                  {/* Gateway 2: Daya HMS */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-[#18A99D]" />
                        <span className="font-bold text-slate-900">
                          Daya Hospital Management System (HMS)
                        </span>
                      </div>
                      <Badge variant="teal">Connected (Demo Mode)</Badge>
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      Authorised REST gateway for doctor timetable lookup, slot locking, and token generation.
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-600 font-mono pt-1 flex-wrap">
                      <span>Protocol: HTTPS REST + Idempotency Headers</span>
                      <span>Target: Daya OPD Microservice</span>
                      <span className="text-emerald-700 font-semibold">Status: Verified</span>
                    </div>
                  </div>

                  {/* Gateway 3: IVR & Exotel Telephony */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-sky-600" />
                        <span className="font-bold text-slate-900">
                          Hospital Telephony Provider: Exotel Cloud & AgentStream
                        </span>
                      </div>
                      <Badge variant="teal">Connected (Exotel Cloud)</Badge>
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      Routes incoming patient phone calls and outbound reminders via Exotel Cloud Telephony. Real-time audio streaming is orchestrated via the persistent Smrko Voice Media Gateway WebSocket.
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-600 font-mono pt-1 flex-wrap">
                      <span>ExoPhone: +91 487 2475000</span>
                      <span>Audio Codec: PCM 16-bit 8000Hz</span>
                      <span>Gateway: wss://voice.smrkomed.com/exotel/voicebot</span>
                      <span className="text-emerald-700 font-semibold">Capacity: 30 Concurrent Trunks</span>
                    </div>
                  </div>

                  {/* Hospital Security Policy Notice */}
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-900">
                    <span className="font-bold block">Hospital Security Policy:</span>
                    Smrko Voice Agent IDs, HMS authorization tokens, and SIP trunk credentials are kept strictly in server-side environment variables and are never transmitted to client bundles.
                  </div>
                </CardContent>
              </Card>

              {/* Recent Incidents Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Integration Incidents & Recovery Log</CardTitle>
                  <CardDescription>
                    Historical uptime events, failover activations, and service recovery logs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden text-xs">
                    {incidents.map((inc) => (
                      <div key={inc.id} className="p-3.5 space-y-1 hover:bg-slate-50">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{inc.title}</span>
                            <Badge
                              variant={
                                inc.severity === "RESOLVED"
                                  ? "success"
                                  : inc.severity === "WARNING"
                                  ? "warning"
                                  : "info"
                              }
                              size="sm"
                            >
                              {inc.severity}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatDateTime(inc.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{inc.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 6: TELEPHONY PROVIDER (EXOTEL) */}
          <TabsContent value="telephony">
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Radio className="h-4 w-4 text-[#0C5DB8]" />
                    <span>Exotel Telephony Cloud Integration</span>
                  </CardTitle>
                  <CardDescription>
                    Official Exotel Singapore region (api.exotel.com) connectivity for Daya Hospital.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                      <span className="text-slate-500 font-medium">Account SID</span>
                      <p className="font-mono font-bold text-slate-900">smrkonova1</p>
                      <span className="text-[10px] text-slate-400">Singapore Region (api.exotel.com)</span>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                      <span className="text-slate-500 font-medium">Primary Virtual ExoPhone</span>
                      <p className="font-mono font-bold text-slate-900">08047291658</p>
                      <span className="text-[10px] text-emerald-600 font-medium">● Connected & Active</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                    <h4 className="font-semibold text-slate-900">Verified Telephony Capabilities</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-2 text-slate-700">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Outbound Programmable Calling (api.exotel.com/v1)</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>AgentStream Bidirectional WebSocket (Voicebot App ID 1393239)</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Call Status Callbacks with HMAC Verification</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Casualty & Reception Transfer (Connect Applet)</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Info className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>IVR App Bazaar Flows (Managed via Exotel Dashboard)</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Info className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>Virtual Number Provisioning (Account Manager)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 6.1: DYNAMIC CALL ROUTING (PHASE 9.6) */}
          <TabsContent value="routing">
            <HospitalRoutingSettings initialHospitalId="hosp_daya_thrissur" />
          </TabsContent>

          {/* TAB 6.2: SARVAM VOICE AGENTS / SAMVAAD (PHASE 10) */}
          <TabsContent value="voice_agents">
            <SarvamVoiceAgentSettings />
          </TabsContent>

          {/* TAB 7: AI PROVIDER (SARVAM) */}
          <TabsContent value="ai_provider">
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-[#0C5DB8]" />
                    <span>Sarvam AI Speech & Conversational Stack</span>
                  </CardTitle>
                  <CardDescription>
                    Authoritative AI stack powering real-time Malayalam & Indian English voice reception.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-500 font-medium">Real-Time STT</span>
                      <p className="font-bold text-slate-900">Saaras v4</p>
                      <p className="text-[10px] text-slate-500">8000 Hz linear16 Streaming WebSocket</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-500 font-medium">Conversational LLM</span>
                      <p className="font-bold text-slate-900">Sarvam 105B</p>
                      <p className="text-[10px] text-slate-500">Tuned for Indian Multilingual Healthcare</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                      <span className="text-slate-500 font-medium">Neural Telephony TTS</span>
                      <p className="font-bold text-slate-900">Bulbul v3</p>
                      <p className="text-[10px] text-slate-500">Speaker: Kavitha (Malayalam Female)</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900">Specialized AI Voice Agents</h4>
                      <p className="text-slate-600 text-[11px]">
                        Configure voices, clinical prompts, and test playground turns in the Agent Builder.
                      </p>
                    </div>
                    <Link href="/agents">
                      <Button size="sm" variant="default" className="text-xs">
                        Open Voice Agent Builder
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 8: BUSINESS HOURS & ESCALATION */}
          <TabsContent value="business">
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#0C5DB8]" />
                    <span>Business Hours & Clinical Emergency Escalation</span>
                  </CardTitle>
                  <CardDescription>
                    Operating schedules, after-hours AI fallback, and emergency Casualty handoff routing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <h4 className="font-semibold text-slate-900">Daya Hospital OPD Hours</h4>
                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Monday – Friday:</span>
                          <span className="font-medium text-slate-900">08:00 AM – 08:00 PM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Saturday:</span>
                          <span className="font-medium text-slate-900">08:00 AM – 06:00 PM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sunday:</span>
                          <span className="font-medium text-slate-900">09:00 AM – 02:00 PM</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 space-y-2">
                      <h4 className="font-semibold text-red-900">Protected Casualty Emergency</h4>
                      <div className="space-y-1 text-[11px] text-red-800">
                        <p>Hotline: <strong>+91 96066 54032</strong> (24/7)</p>
                        <p>Extension: <strong>100</strong> (Casualty Desk)</p>
                        <p className="text-[10px] text-red-700 pt-1">
                          Protected destination: automated marketing or promotional calls are blocked from dialing this number.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 9: CONFIGURATION VERSIONS */}
          <TabsContent value="versions">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#0C5DB8]" />
                  <span>Immutable Configuration History</span>
                </CardTitle>
                <CardDescription>
                  Review published versions of the hospital calling platform and rollback safely.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#0C5DB8]">Active Version: v2</span>
                    <p className="text-slate-500 text-[11px]">Published: 22 Nov 2026, 11:30 AM IST</p>
                  </div>
                  <Badge variant="default">Currently Active</Badge>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between opacity-80">
                  <div>
                    <span className="font-bold text-slate-700">Archived Version: v1</span>
                    <p className="text-slate-400 text-[11px]">Initial Phase 1 baseline</p>
                  </div>
                  <Badge variant="secondary">Archived</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Staff User Modal (Admin Only) */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#0C5DB8]" />
            <span>Onboard Hospital Staff User</span>
          </div>
        }
        description="Provision access to the AI calling dashboard with specific role-based permissions."
      >
        <form onSubmit={handleUserSubmit(onAddUser)} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-800 block mb-1">Full Name *</label>
            <Input
              {...registerUser("name")}
              placeholder="e.g. Sister Liji Thomas"
              className={userErrors.name ? "border-red-400" : ""}
            />
            {userErrors.name && (
              <p className="text-red-500 text-[11px] mt-1">{userErrors.name.message}</p>
            )}
          </div>

          <div>
            <label className="font-semibold text-slate-800 block mb-1">Hospital Email *</label>
            <Input
              {...registerUser("email")}
              placeholder="e.g. liji.opd@dayahospital.com"
              className={userErrors.email ? "border-red-400" : ""}
            />
            {userErrors.email && (
              <p className="text-red-500 text-[11px] mt-1">{userErrors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-800 block mb-1">Assigned Role *</label>
              <select
                {...registerUser("role")}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
              >
                <option value="HOSPITAL_STAFF">Hospital Staff / Reviewer</option>
                <option value="HOSPITAL_ADMIN">Hospital Administrator</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-800 block mb-1">Department *</label>
              <Input
                {...registerUser("department")}
                placeholder="e.g. Paediatrics OPD"
                className={userErrors.department ? "border-red-400" : ""}
              />
              {userErrors.department && (
                <p className="text-red-500 text-[11px] mt-1">{userErrors.department.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-800 block mb-1">Contact Phone</label>
            <Input {...registerUser("phone")} placeholder="+91 94470 •••••" />
          </div>

          {/* Call Recording Permission Toggle */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
            <input
              type="checkbox"
              id="user-recording-access"
              {...registerUser("canAccessRecordings")}
              className="mt-0.5 rounded text-[#0C5DB8] focus:ring-[#0C5DB8]"
            />
            <label htmlFor="user-recording-access" className="cursor-pointer">
              <span className="font-semibold text-slate-900 block">
                Grant Audio Call Recording Playback
              </span>
              <span className="text-slate-500 block text-[11px]">
                Allows staff member to listen to clinical patient audio recordings.
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddUserOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-[#0C5DB8] text-white">
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
