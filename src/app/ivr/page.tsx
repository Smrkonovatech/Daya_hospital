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
import { IvrFlowData, ExotelDeploymentStatus } from "@/lib/types/ivr-flow";

export default function IvrFlowsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isAdmin } = useAuth();

  const [flows, setFlows] = React.useState<IvrFlowData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newFlowName, setNewFlowName] = React.useState("");
  const [newFlowDescription, setNewFlowDescription] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  // Mapping Guide Modal State
  const [selectedMappingFlow, setSelectedMappingFlow] = React.useState<IvrFlowData | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch("/api/v1/ivr/flows")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json.success) {
          setFlows(json.data || []);
        } else {
          showToast({
            type: "error",
            title: "Load Error",
            message: json.error || "Failed to load IVR call flows.",
          });
        }
      })
      .catch(() => {
        if (!active) return;
        showToast({
          type: "error",
          title: "Connection Error",
          message: "Failed to communicate with IVR Flow Service.",
        });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showToast]);

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
    return matchesSearch && matchesStatus;
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="IVR & Inbound Call Flows"
          description="Design, test, validate, and publish multi-tenant hospital inbound telephony flows with Exotel voicebot mapping."
          actions={
            isAdmin && (
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Call Flow
              </Button>
            )
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
                Hospital Telephony Gateway: Exotel Singapore (smrkonova1)
              </p>
              <p className="text-slate-600 text-xs">
                Inbound audio streams over WebSocket to Railway media gateway. Emergency fast-track overrides are enforced with sub-second latency.
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
                <p className="text-xs text-slate-500 mt-0.5">Multi-tenant directory</p>
              </div>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <GitBranch className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Exotel Verified</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">
                  {flows.filter((f) => f.deploymentStatus === "EXOTEL_MAPPING_VERIFIED" || f.deploymentStatus === "ACTIVE").length}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">Live on PSTN</p>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Radio className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Published Flows</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {flows.filter((f) => f.status === "PUBLISHED").length}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Immutable versions</p>
              </div>
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Draft Workflows</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {flows.filter((f) => f.status === "DRAFT").length}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Under configuration</p>
              </div>
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
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
                {st === "ALL" ? "All Flows" : st.charAt(0) + st.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* Flow Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-slate-200 h-52 bg-slate-50/50" />
            ))}
          </div>
        ) : filteredFlows.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 p-12 text-center">
            <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-800">No IVR Call Flows Found</p>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Create an inbound call routing flow to handle patient inquiries, clinical menus, and Sarvam AI assistants.
            </p>
            {isAdmin && (
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Create Your First Flow
              </Button>
            )}
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
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">
                            {flow.name}
                          </CardTitle>
                          {flow.isDefault && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {flow.description || "Inbound call routing workflow"}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        v{flow.currentVersion}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-3 pb-2 space-y-3">
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
                        {new Date(flow.updatedAt).toLocaleDateString("en-GB", {
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

        {/* Create Flow Modal */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New Inbound Call Flow"
        >
          <form onSubmit={handleCreateFlow} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Flow Name <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. Daya Hospital Main Outpatient IVR"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description / Clinical Purpose
              </label>
              <textarea
                rows={3}
                placeholder="Brief description of call routing, languages supported, and department destinations..."
                value={newFlowDescription}
                onChange={(e) => setNewFlowDescription(e.target.value)}
                className="w-full text-sm rounded-md border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5 text-slate-600">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Pre-configured Hospital Best Practices:
              </p>
              <p>&bull; Includes bilingual Malayalam & English greetings.</p>
              <p>&bull; Immediate emergency priority fast-track to Casualty.</p>
              <p>&bull; Seamless handoff to Sarvam conversational AI assistant.</p>
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
                {isCreating ? "Creating..." : "Initialize Flow Builder"}
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
                  <span className="text-slate-500">Required Applet Type:</span>
                  <span className="font-medium text-slate-800">Voicebot Applet</span>
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
                  <li>Assign your hospital ExoPhone number to route to this App.</li>
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
