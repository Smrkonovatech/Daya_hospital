"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bot,
  Plus,
  Copy,
  Power,
  Sparkles,
  Volume2,
  ArrowRight,
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
import { AgentConfigData } from "@/lib/services/agent-service";

export default function AgentsPage() {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();

  const [agents, setAgents] = React.useState<AgentConfigData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedPurpose, setSelectedPurpose] = React.useState<string>("ALL");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newAgentName, setNewAgentName] = React.useState("");
  const [newAgentPurpose, setNewAgentPurpose] = React.useState<string>("RECEPTIONIST");
  const [isCreating, setIsCreating] = React.useState(false);

  const fetchAgents = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/v1/agents");
      const json = await res.json();
      if (res.ok && json.success) {
        setAgents(json.data || []);
      } else {
        showToast({
          type: "error",
          title: "Load Error",
          message: json.error || "Failed to load voice agents.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Connection Error",
        message: "Failed to communicate with Agent Service.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    let active = true;
    fetch("/api/v1/agents")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json.success) {
          setAgents(json.data || []);
        } else {
          showToast({
            type: "error",
            title: "Load Error",
            message: json.error || "Failed to load voice agents.",
          });
        }
      })
      .catch(() => {
        if (!active) return;
        showToast({
          type: "error",
          title: "Connection Error",
          message: "Failed to communicate with Agent Service.",
        });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showToast]);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    try {
      setIsCreating(true);
      const res = await fetch("/api/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAgentName.trim(),
          purpose: newAgentPurpose,
          defaultLanguage: "ml-IN",
          supportedLanguages: ["ml-IN", "en-IN"],
          sttModel: "saaras:v4",
          llmModel: "sarvam-105b-conversations",
          ttsModel: "bulbul:v3",
          speaker: "kavitha",
          speakingPace: 1.15,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Agent Created",
          message: `Created '${json.data.name}'. Now configuring voice & prompts.`,
        });
        setIsCreateOpen(false);
        setNewAgentName("");
        await fetchAgents();
      } else {
        showToast({
          type: "error",
          title: "Creation Failed",
          message: json.error || "Could not create agent.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Network request failed while creating agent.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDuplicate = async (agent: AgentConfigData) => {
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Agent Duplicated",
          message: `Created '${json.data.name}' from template.`,
        });
        await fetchAgents();
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Failed to duplicate agent." });
    }
  };

  const handleToggleStatus = async (agent: AgentConfigData) => {
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_status" }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "info",
          title: "Status Updated",
          message: `${agent.name} is now ${json.data.status}.`,
        });
        await fetchAgents();
      }
    } catch {
      showToast({ type: "error", title: "Error", message: "Failed to toggle status." });
    }
  };

  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.speaker.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPurpose = selectedPurpose === "ALL" || a.purpose === selectedPurpose;
    return matchesSearch && matchesPurpose;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Sarvam AI Voice Agents"
          description="Create, configure, test, and publish multilingual hospital voice agents powered by Sarvam AI."
          badge={
            <Badge variant="teal" size="sm" className="gap-1">
              <Sparkles className="h-3 w-3" />
              <span>Sarvam Bulbul v3 Verified</span>
            </Badge>
          }
          breadcrumbs={[
            { label: "Overview", href: "/overview" },
            { label: "AI Voice Agents" },
          ]}
          actions={
            isAdmin && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create AI Agent</span>
              </Button>
            )
          }
        />

        {/* Informational Guidance Banner */}
        <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/40 flex items-start gap-3.5 text-xs text-blue-900">
          <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
            <Bot className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-blue-950">
              Sarvam AI Multilingual Hospital Voice Agents
            </h4>
            <p className="text-blue-800/90 leading-relaxed">
              Every agent configured here streams natural spoken Malayalam and Indian English through the persistent
              Railway Media Gateway connected to Exotel. Changes are saved as <strong>Drafts</strong> and do not affect live calls
              until explicitly <strong>Published</strong>.
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search agents by name, description, or voice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs h-9"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Filter Purpose:</span>
            <select
              value={selectedPurpose}
              onChange={(e) => setSelectedPurpose(e.target.value)}
              className="h-9 text-xs rounded-lg border border-slate-200 px-3 bg-slate-50 focus:bg-white text-slate-700"
            >
              <option value="ALL">All Purposes</option>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="APPOINTMENT_BOOKING">Appointment Booking</option>
              <option value="DEPARTMENT_ENQUIRY">Department Enquiry</option>
              <option value="AFTER_HOURS">After-Hours Assistant</option>
              <option value="OUTBOUND_REMINDER">Outbound Reminders</option>
            </select>
          </div>
        </div>

        {/* Agent Cards Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
            Loading hospital voice agents...
          </div>
        ) : filteredAgents.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-500 space-y-3">
            <Bot className="h-8 w-8 mx-auto text-slate-300" />
            <p>No voice agents match the selected search or filter criteria.</p>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
                Create New Voice Agent
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAgents.map((agent) => (
              <Card
                key={agent.id}
                className="hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-slate-900">
                          {agent.name}
                        </CardTitle>
                        {agent.isDefault && (
                          <Badge variant="teal" size="sm">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {agent.description || "Hospital voice assistant"}
                      </p>
                    </div>
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
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-xs pt-0 flex-1">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Primary Voice:</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1">
                        <Volume2 className="h-3 w-3 text-[#0C5DB8]" />
                        {agent.speaker} ({agent.ttsModel})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Languages:</span>
                      <span className="font-medium text-slate-700">
                        {agent.supportedLanguages.join(", ")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Speech Engine:</span>
                      <span className="font-medium text-slate-700">{agent.sttModel}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Version:</span>
                      <span className="font-semibold text-[#0C5DB8]">v{agent.currentVersion}</span>
                    </div>
                  </div>

                  {/* Malayalam Greeting Preview */}
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700 line-clamp-2 italic">
                    &ldquo;{agent.greetingMalayalam}&rdquo;
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicate(agent)}
                        title="Duplicate Agent"
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(agent)}
                        title={agent.status === "DISABLED" ? "Enable Agent" : "Disable Agent"}
                        className="h-8 w-8 p-0"
                      >
                        <Power
                          className={`h-3.5 w-3.5 ${
                            agent.status === "DISABLED" ? "text-slate-400" : "text-emerald-600"
                          }`}
                        />
                      </Button>
                    </div>

                    <Link href={`/agents/${agent.id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs font-semibold">
                        <span>Configure & Test</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal: Create Agent */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New AI Voice Agent"
          description="Provision a new specialized Sarvam-powered voice assistant for your hospital."
        >
          <form onSubmit={handleCreateAgent} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-slate-700">Agent Name *</label>
              <Input
                placeholder="e.g. Appointment Booking Assistant"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-slate-700">Operational Purpose *</label>
              <select
                value={newAgentPurpose}
                onChange={(e) => setNewAgentPurpose(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 bg-white text-slate-700"
              >
                <option value="RECEPTIONIST">Main Front Desk Receptionist</option>
                <option value="APPOINTMENT_BOOKING">Specialty Appointment Booking</option>
                <option value="DEPARTMENT_ENQUIRY">Department & Doctor Timings Enquiry</option>
                <option value="AFTER_HOURS">Night & After-Hours Assistant</option>
                <option value="OUTBOUND_REMINDER">Outbound Patient Reminder Agent</option>
              </select>
            </div>

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-[11px] text-blue-800 space-y-1">
              <span className="font-semibold block">Default Initial Stack:</span>
              <p>• TTS: Sarvam Bulbul v3 (Speaker Kavitha - Malayalam & English)</p>
              <p>• STT: Sarvam Saaras v4 Real-time Streaming (8000 Hz linear16)</p>
              <p>• LLM: Sarvam 105B Conversations tuned for Indian healthcare</p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" size="sm" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create & Open Builder"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
