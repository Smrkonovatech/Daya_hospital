"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  Radio,
  FileCheck,
  Search,
  ShieldAlert,
  Sparkles,
  Copy,
  Calendar,
  CreditCard,
  Building2,
  Moon,
  TestTube,
  UserCheck,
  Stethoscope,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { IvrFlowData, ExotelDeploymentStatus, FlowCategory } from "@/lib/types/ivr-flow";
import { IvrFlowTemplateSummary } from "@/lib/services/flow-templates";

const CATEGORY_TABS: Array<{ id: string; label: string; icon: React.ElementType }> = [
  { id: "ALL", label: "All Flows", icon: GitBranch },
  { id: "INBOUND_RECEPTION", label: "AI Reception", icon: Sparkles },
  { id: "EMERGENCY_ESCALATION", label: "Emergency", icon: ShieldAlert },
  { id: "DEPARTMENT_ROUTING", label: "Departments", icon: Building2 },
  { id: "AFTER_HOURS", label: "After-Hours", icon: Moon },
  { id: "APPOINTMENT", label: "Appointments", icon: Calendar },
  { id: "BILLING_INSURANCE", label: "Billing / TPA", icon: CreditCard },
  { id: "HUMAN_HANDOFF", label: "Staff Handoff", icon: UserCheck },
  { id: "LAB_ENQUIRIES", label: "Diagnostics", icon: TestTube },
  { id: "DOCTOR_INFO", label: "Doctor Timings", icon: Stethoscope },
];

export default function IvrFlowsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isAdmin } = useAuth();

  const [flows, setFlows] = React.useState<IvrFlowData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newFlowName, setNewFlowName] = React.useState("");
  const [newFlowDescription, setNewFlowDescription] = React.useState("");
  const [newFlowCategory, setNewFlowCategory] = React.useState<FlowCategory>("INBOUND_RECEPTION");
  const [isCreating, setIsCreating] = React.useState(false);

  // Template Catalog State
  const [isTemplatesOpen, setIsTemplatesOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<IvrFlowTemplateSummary[]>([]);
  const [isCloning, setIsCloning] = React.useState<string | null>(null);

  // Emergency Routing Modal State
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = React.useState(false);
  const [emergencyConfig, setEmergencyConfig] = React.useState<{
    casualtyNumber: string;
    fallbackNumber: string;
    isVerified: boolean;
    allowLiveTransfer: boolean;
    confidenceThreshold: number;
  }>({
    casualtyNumber: "0487 2475100",
    fallbackNumber: "108",
    isVerified: true,
    allowLiveTransfer: false,
    confidenceThreshold: 0.7,
  });
  const [emergencyEvents, setEmergencyEvents] = React.useState<Array<{
    id: string;
    triggerPhrase: string;
    targetDestination: string;
    transferOutcome: string;
    confidenceScore: number;
    createdAt: string;
  }>>([]);
  const [isSavingEmergency, setIsSavingEmergency] = React.useState(false);

  // Mapping Guide Modal State
  const [selectedMappingFlow, setSelectedMappingFlow] = React.useState<IvrFlowData | null>(null);

  const fetchFlows = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/v1/ivr/flows");
      const json = await res.json();
      if (json.success) {
        setFlows(json.data || []);
      } else {
        showToast({
          type: "error",
          title: "Load Error",
          message: json.error || "Failed to load IVR call flows.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Connection Error",
        message: "Failed to communicate with IVR Flow Service.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // Load Templates
  const handleOpenTemplates = async () => {
    setIsTemplatesOpen(true);
    try {
      const res = await fetch("/api/v1/ivr/templates");
      const json = await res.json();
      if (json.success) {
        setTemplates(json.data || []);
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Failed to load template catalog." });
    }
  };

  // Load Emergency Config
  const handleOpenEmergencyModal = async () => {
    setIsEmergencyModalOpen(true);
    try {
      const res = await fetch("/api/v1/ivr/emergency");
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.config) {
          setEmergencyConfig({
            casualtyNumber: json.data.config.casualtyNumber || "0487 2475100",
            fallbackNumber: json.data.config.fallbackNumber || "108",
            isVerified: json.data.config.isVerified ?? true,
            allowLiveTransfer: json.data.config.allowLiveTransfer ?? false,
            confidenceThreshold: json.data.config.confidenceThreshold ?? 0.7,
          });
        }
        setEmergencyEvents(json.data.events || []);
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Failed to load emergency configuration." });
    }
  };

  const handleSaveEmergencyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingEmergency(true);
      const res = await fetch("/api/v1/ivr/emergency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emergencyConfig),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Emergency Config Saved",
          message: "Casualty routing and trigger thresholds updated.",
        });
        setIsEmergencyModalOpen(false);
      } else {
        showToast({ type: "error", title: "Save Failed", message: json.error || "Could not save." });
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Network error saving config." });
    } finally {
      setIsSavingEmergency(false);
    }
  };

  // Clone Template Action
  const handleCloneTemplate = async (templateId: string) => {
    try {
      setIsCloning(templateId);
      const res = await fetch("/api/v1/ivr/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          hospitalId: "hosp_daya_thrissur",
          hospitalName: "Daya Hospital Thrissur",
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Template Cloned",
          message: `Created '${json.data.name}' in your workspace. Opening Builder...`,
        });
        setIsTemplatesOpen(false);
        fetchFlows();
        router.push(`/ivr/${json.data.id}`);
      } else {
        showToast({ type: "error", title: "Clone Failed", message: json.error || "Failed to clone template." });
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Network error cloning template." });
    } finally {
      setIsCloning(null);
    }
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlowName.trim()) return;

    try {
      setIsCreating(true);
      const res = await fetch("/api/v1/ivr/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFlowName.trim(),
          description: newFlowDescription.trim(),
          category: newFlowCategory,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Flow Created",
          message: `Created '${json.data.name}'. Redirecting to Visual Flow Builder...`,
        });
        setIsCreateOpen(false);
        setNewFlowName("");
        setNewFlowDescription("");
        router.push(`/ivr/${json.data.id}`);
      } else {
        showToast({
          type: "error",
          title: "Creation Failed",
          message: json.error || "Could not create flow.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Network error creating flow.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const filteredFlows = flows.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || f.status === statusFilter;
    const matchesCategory = selectedCategory === "ALL" || f.category === selectedCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getDeploymentBadge = (status: ExotelDeploymentStatus) => {
    switch (status) {
      case "ACTIVE":
      case "EXOTEL_MAPPING_VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
            Exotel Verified (Live)
          </span>
        );
      case "EXOTEL_MAPPING_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Exotel Mapping Required
          </span>
        );
      case "PUBLISHED_INTERNALLY":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Published Internally
          </span>
        );
      case "VALIDATED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <FileCheck className="w-3 h-3 text-indigo-600" />
            Validated Graph
          </span>
        );
      case "SMRKOMED_DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            Draft
          </span>
        );
    }
  };

  const getCategoryBadge = (category: FlowCategory) => {
    switch (category) {
      case "EMERGENCY_ESCALATION":
        return <Badge className="bg-red-100 text-red-800 border-red-300 font-bold">EMERGENCY</Badge>;
      case "INBOUND_RECEPTION":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">MAIN RECEPTION</Badge>;
      case "DEPARTMENT_ROUTING":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">DEPARTMENTS</Badge>;
      case "AFTER_HOURS":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300">AFTER-HOURS</Badge>;
      case "APPOINTMENT":
        return <Badge className="bg-teal-100 text-teal-800 border-teal-300">APPOINTMENTS</Badge>;
      case "BILLING_INSURANCE":
        return <Badge className="bg-green-100 text-green-800 border-green-300">BILLING & TPA</Badge>;
      case "HUMAN_HANDOFF":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">HUMAN STAFF</Badge>;
      case "LAB_ENQUIRIES":
        return <Badge className="bg-cyan-100 text-cyan-800 border-cyan-300">DIAGNOSTICS</Badge>;
      case "DOCTOR_INFO":
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">DOCTOR INFO</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-300">CUSTOM FLOW</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Flow Centre — Multi-Tenant Call Orchestration"
          description="Modular hospital call flows, reusable subflows, high-priority emergency escalation, and Exotel Voicebot mapping."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleOpenEmergencyModal}
                className="border-red-200 text-red-700 hover:bg-red-50 font-medium flex items-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Emergency Config
              </Button>

              <Button
                variant="outline"
                onClick={handleOpenTemplates}
                className="border-blue-200 text-blue-700 hover:bg-blue-50 font-medium flex items-center gap-1.5"
              >
                <Copy className="w-4 h-4 text-blue-600" />
                Template Catalog
              </Button>

              {isAdmin && (
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  New Flow
                </Button>
              )}
            </div>
          }
        />

        {/* Telephony & Safety Notice Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-blue-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Hospital Telephony Gateway: Exotel Singapore (smrkonova1) &bull; Mode: DEVELOPMENT_TESTING
              </p>
              <p className="text-slate-600 text-xs">
                WebSocket streaming to Railway media gateway. Emergency fast-track overrides run continuously across Malayalam, English, and Manglish.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-300 font-mono text-xs">
              08047291658 (ExoPhone)
            </Badge>
            <Badge variant="outline" className="bg-white text-blue-800 border-blue-300 font-mono text-xs">
              Applet: 1393239
            </Badge>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Flows</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{flows.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Active & draft workflows</p>
              </div>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <GitBranch className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Emergency Flow</p>
                <p className="text-2xl font-bold text-red-600 mt-1">Priority 100</p>
                <p className="text-xs text-red-600 mt-0.5">Sub-50ms Interruption</p>
              </div>
              <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Modular Templates</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">11 Ready</p>
                <p className="text-xs text-slate-500 mt-0.5">Clinical subflow catalog</p>
              </div>
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Published Flows</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">
                  {flows.filter((f) => f.status === "PUBLISHED").length}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">Locked immutable versions</p>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              type="text"
              placeholder="Search flows by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {["ALL", "PUBLISHED", "DRAFT"].map((st) => (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? "default" : "outline"}
                onClick={() => setStatusFilter(st)}
                className={
                  statusFilter === st
                    ? "bg-slate-900 text-white text-xs h-8"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100 text-xs h-8"
                }
              >
                {st === "ALL" ? "All Statuses" : st.charAt(0) + st.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* Flow Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-slate-200 h-56 bg-slate-50/50" />
            ))}
          </div>
        ) : filteredFlows.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 p-12 text-center">
            <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-800">No IVR Call Flows Found in this Category</p>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Clone a clinical template or create a new flow to handle patient inquiries, appointments, or emergency routing.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={handleOpenTemplates}
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Browse Template Catalog
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Create Custom Flow
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFlows.map((flow) => (
              <Card
                key={flow.id}
                className="border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">
                            {flow.name}
                          </CardTitle>
                          {flow.isDefault && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {getCategoryBadge(flow.category)}
                          {flow.executionPriority > 50 && (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                              Priority {flow.executionPriority}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        v{flow.currentVersion}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-3 pb-2 space-y-3">
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {flow.description || "Inbound telephony call routing flow."}
                    </p>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Exotel Status:</span>
                      {getDeploymentBadge(flow.deploymentStatus)}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {flow.nodes.length} Nodes &bull; {flow.edges.length} Branches
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Updated {new Date(flow.updatedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>

                    {flow.exotelMapping?.appletId && (
                      <div className="text-[11px] font-mono text-slate-500 bg-emerald-50/50 p-1.5 rounded border border-emerald-100 flex items-center justify-between">
                        <span>Applet ID: {flow.exotelMapping.appletId}</span>
                        <span className="text-emerald-700 font-sans font-medium text-[10px]">VERIFIED</span>
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/40">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMappingFlow(flow)}
                    className="text-xs text-slate-600 border-slate-200 hover:bg-white"
                  >
                    Exotel Guide
                  </Button>

                  <Link href={`/ivr/${flow.id}`} className="w-full sm:w-auto">
                    <Button
                      size="sm"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-1.5"
                    >
                      Open Builder
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Template Catalog Modal */}
        <Modal
          isOpen={isTemplatesOpen}
          onClose={() => setIsTemplatesOpen(false)}
          title="Hospital Flow Templates Catalog (11 Clinical Workflows)"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <p className="text-xs text-slate-500">
              One-click clone pre-built clinical call flows directly into your hospital tenant workspace. Each template includes nodes, branches, and Sarvam multilingual settings.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="border border-slate-200 hover:border-blue-300 rounded-xl p-3.5 bg-slate-50/50 flex flex-col justify-between space-y-2 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">{tpl.name}</h4>
                      {tpl.executionPriority > 50 && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                          Priority {tpl.executionPriority}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                    <span>{tpl.nodeCount} Pre-built Nodes</span>
                    <Button
                      size="sm"
                      onClick={() => handleCloneTemplate(tpl.id)}
                      disabled={isCloning === tpl.id}
                      className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {isCloning === tpl.id ? "Cloning..." : "Clone Flow"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>

        {/* Emergency Routing Configuration Modal */}
        <Modal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          title="Emergency Escalation & Casualty Routing Configuration"
        >
          <form onSubmit={handleSaveEmergencyConfig} className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 space-y-1">
              <p className="font-semibold text-red-950 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Sub-50ms Continuous Interruption Protocol
              </p>
              <p>
                When medical emergencies (cardiac, breathing difficulty, accident, bleeding) are detected from caller speech, the gateway immediately halts speech playback and escalates to Casualty.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hospital Casualty / Emergency Direct Telephone Number
                </label>
                <Input
                  type="text"
                  required
                  value={emergencyConfig.casualtyNumber}
                  onChange={(e) => setEmergencyConfig({ ...emergencyConfig, casualtyNumber: e.target.value })}
                  placeholder="e.g. 0487 2475100"
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  National / State Ambulance Fallback Number
                </label>
                <Input
                  type="text"
                  value={emergencyConfig.fallbackNumber}
                  onChange={(e) => setEmergencyConfig({ ...emergencyConfig, fallbackNumber: e.target.value })}
                  placeholder="108"
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Emergency Detection Confidence Threshold (0.50 – 0.95)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.05"
                    value={emergencyConfig.confidenceThreshold}
                    onChange={(e) => setEmergencyConfig({ ...emergencyConfig, confidenceThreshold: parseFloat(e.target.value) })}
                    className="w-full accent-red-600 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {emergencyConfig.confidenceThreshold.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-semibold text-amber-950">Live Telephony PSTN Bridging</p>
                  <p className="text-[11px] text-amber-700">
                    Safety guard: During DEVELOPMENT_TESTING mode, live call transfer to actual casualty desks is disabled to protect hospital lines.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emergencyConfig.allowLiveTransfer}
                  onChange={(e) => setEmergencyConfig({ ...emergencyConfig, allowLiveTransfer: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
              </div>
            </div>

            {/* Recent Emergency Trigger Log */}
            <div>
              <h5 className="font-semibold text-slate-800 mb-1.5">Recent Emergency Trigger Events</h5>
              {emergencyEvents.length === 0 ? (
                <p className="text-slate-400 italic">No emergency triggers recorded yet in this workspace.</p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-[10px] text-slate-600 uppercase">
                      <tr>
                        <th className="p-1.5">Time</th>
                        <th className="p-1.5">Trigger Phrase</th>
                        <th className="p-1.5">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {emergencyEvents.map((evt) => (
                        <tr key={evt.id} className="hover:bg-slate-50">
                          <td className="p-1.5 font-mono text-slate-500">
                            {new Date(evt.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="p-1.5 font-medium text-slate-800">{evt.triggerPhrase}</td>
                          <td className="p-1.5 text-emerald-700 font-semibold">{evt.transferOutcome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsEmergencyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingEmergency} className="bg-red-600 hover:bg-red-700 text-white font-medium">
                {isSavingEmergency ? "Saving..." : "Update Emergency Routing"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Create Flow Modal */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New Hospital Call Flow"
        >
          <form onSubmit={handleCreateFlow} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Flow Name <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. Daya Hospital Cardiology Subflow"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Flow Category
              </label>
              <select
                value={newFlowCategory}
                onChange={(e) => setNewFlowCategory(e.target.value as FlowCategory)}
                className="w-full text-sm rounded-md border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="INBOUND_RECEPTION">Inbound Reception</option>
                <option value="EMERGENCY_ESCALATION">Emergency Escalation</option>
                <option value="DEPARTMENT_ROUTING">Department Routing</option>
                <option value="AFTER_HOURS">After-Hours Triage</option>
                <option value="APPOINTMENT">Appointment Booking / Enquiry</option>
                <option value="BILLING_INSURANCE">Billing & TPA Insurance</option>
                <option value="HUMAN_HANDOFF">Human Staff Handoff</option>
                <option value="LAB_ENQUIRIES">Diagnostics / Lab Enquiries</option>
                <option value="DOCTOR_INFO">Doctor Timings & Profile</option>
                <option value="CUSTOM">Custom Flow</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description / Purpose
              </label>
              <textarea
                rows={3}
                placeholder="Brief description of clinical call routing, department destination, or languages..."
                value={newFlowDescription}
                onChange={(e) => setNewFlowDescription(e.target.value)}
                className="w-full text-sm rounded-md border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating || !newFlowName.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {isCreating ? "Creating..." : "Initialize Flow"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Exotel Mapping Guide Modal */}
        <Modal
          isOpen={!!selectedMappingFlow}
          onClose={() => setSelectedMappingFlow(null)}
          title={`Exotel Telephony Mapping: ${selectedMappingFlow?.name}`}
        >
          {selectedMappingFlow && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
                <p className="font-semibold text-slate-900">Provider Limitation Notice (Exotel Singapore):</p>
                <p>
                  Exotel does not expose a public REST API for automated visual applet graph generation.
                  To activate this flow on your live phone number, map the applet parameters in your Exotel dashboard.
                </p>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Exotel Account:</span>
                  <span className="font-mono font-medium text-slate-800">smrkonova1 (Singapore)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Assigned ExoPhone:</span>
                  <span className="font-mono font-bold text-slate-900">08047291658</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Configured Applet ID:</span>
                  <span className="font-mono font-bold text-blue-700">{selectedMappingFlow.exotelMapping?.appletId || "1393239"}</span>
                </div>
                <div className="flex flex-col py-1">
                  <span className="text-slate-500 mb-1">WebSocket Streaming URL:</span>
                  <span className="font-mono text-[11px] bg-white p-1.5 rounded border border-slate-200 break-all select-all text-slate-900">
                    wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="font-semibold text-slate-800">Step-by-Step Dashboard Setup:</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Log in to <span className="font-mono">my.exotel.com</span>.</li>
                  <li>Go to <strong>App Bazaar</strong> &rarr; <strong>Installed Apps</strong>.</li>
                  <li>Open App ID <strong>{selectedMappingFlow.exotelMapping?.appletId || "1393239"}</strong>.</li>
                  <li>In the Voicebot Applet, verify the WebSocket URL points to the Railway gateway above.</li>
                  <li>Assign your hospital ExoPhone number (08047291658) to route to this App.</li>
                </ol>
              </div>

              <div className="flex items-center justify-end pt-2">
                <Button
                  onClick={() => setSelectedMappingFlow(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  Close Guide
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
