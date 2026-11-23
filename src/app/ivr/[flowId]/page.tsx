"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Send,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Radio,
  Volume2,
  Bot,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";
import {
  FlowNodeType,
  FlowNode,
  FlowEdge,
  IvrFlowData,
  FlowValidationResult,
  FlowExecutionContext,
  FlowExecutionStepResult,
  IvrMenuNodeData,
  WelcomeGreetingNodeData,
  AiVoiceAgentNodeData,
  EmergencyHandlingNodeData,
  HumanTransferNodeData,
} from "@/lib/types/ivr-flow";
import {
  NODE_TYPE_REGISTRY,
  createDefaultNode,
} from "@/lib/services/ivr-node-definitions";
import { IvrFlowValidator } from "@/lib/services/ivr-flow-validator";
import { IvrFlowExecutionEngine } from "@/lib/services/ivr-flow-engine";
import { AgentConfigData } from "@/lib/services/agent-service";

function IvrFlowBuilderContent() {
  const params = useParams();
  const flowId = params?.flowId as string;
  const { showToast } = useToast();
  const { isAdmin } = useAuth();

  // Core Flow State
  const [flow, setFlow] = React.useState<IvrFlowData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);

  // Available Published AI Agents for binding
  const [availableAgents, setAvailableAgents] = React.useState<AgentConfigData[]>([]);

  // Canvas Interactions
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = React.useState<string | null>(null);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // Connection Creation State (Click source port -> Click target port)
  const [connectingPort, setConnectingPort] = React.useState<{
    nodeId: string;
    portId: string;
    direction: "output";
  } | null>(null);

  // Validation State
  const [validation, setValidation] = React.useState<FlowValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });
  const [isValidationDrawerOpen, setIsValidationDrawerOpen] = React.useState(false);

  // Simulation Playground State
  const [isSimulatorOpen, setIsSimulatorOpen] = React.useState(false);
  const [simContext, setSimContext] = React.useState<FlowExecutionContext | null>(null);
  const [simStepResult, setSimStepResult] = React.useState<FlowExecutionStepResult | null>(null);

  // Exotel Mapping Guide Modal State
  const [isExotelModalOpen, setIsExotelModalOpen] = React.useState(false);
  const [exotelAppletIdInput, setExotelAppletIdInput] = React.useState("1393239");

  // Publish Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = React.useState(false);
  const [publishChangelog, setPublishChangelog] = React.useState("");

  // Add Node Palette Dropdown
  const [isPaletteOpen, setIsPaletteOpen] = React.useState(false);

  // ----------------------------------------------------
  // INITIAL DATA FETCH
  // ----------------------------------------------------
  React.useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setIsLoading(true);
        // Load Flow
        const flowRes = await fetch(`/api/v1/ivr/flows/${flowId}`);
        const flowJson = await flowRes.json();

        // Load Agents
        const agentRes = await fetch("/api/v1/agents");
        const agentJson = await agentRes.json();

        if (active && flowRes.ok && flowJson.success) {
          setFlow(flowJson.data);
          const initialVal = IvrFlowValidator.validate(flowJson.data.nodes, flowJson.data.edges);
          setValidation(initialVal);
          if (flowJson.data.exotelMapping?.appletId) {
            setExotelAppletIdInput(flowJson.data.exotelMapping.appletId);
          }
        }

        if (active && agentRes.ok && agentJson.success) {
          setAvailableAgents(agentJson.data || []);
        }
      } catch {
        if (active) {
          showToast({
            type: "error",
            title: "Load Error",
            message: "Failed to load flow data from server.",
          });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [flowId, showToast]);

  // Recalculate validation whenever nodes or edges change
  const triggerValidation = React.useCallback(
    (nodes: FlowNode[], edges: FlowEdge[]) => {
      const res = IvrFlowValidator.validate(nodes, edges);
      setValidation(res);
      return res;
    },
    []
  );

  // ----------------------------------------------------
  // DRAG & DROP / PAN / ZOOM HANDLERS
  // ----------------------------------------------------
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "svg") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingPort(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (draggedNodeId && flow) {
      const deltaX = (e.clientX - dragStart.x) / zoom;
      const deltaY = (e.clientY - dragStart.y) / zoom;

      setFlow((prev) => {
        if (!prev) return prev;
        const updated = prev.nodes.map((node) => {
          if (node.id === draggedNodeId) {
            return {
              ...node,
              position: {
                x: Math.round(node.position.x + deltaX),
                y: Math.round(node.position.y + deltaY),
              },
            };
          }
          return node;
        });
        return { ...prev, nodes: updated };
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setDraggedNodeId(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // ----------------------------------------------------
  // CONNECTION MANAGEMENT
  // ----------------------------------------------------
  const handlePortClick = (e: React.MouseEvent, nodeId: string, portId: string, direction: "input" | "output") => {
    e.stopPropagation();

    if (direction === "output") {
      setConnectingPort({ nodeId, portId, direction });
      showToast({
        type: "info",
        title: "Connection Mode",
        message: "Now click on an Input port on the destination node.",
      });
    } else if (direction === "input" && connectingPort) {
      // Connect edge
      if (connectingPort.nodeId === nodeId) {
        showToast({
          type: "warning",
          title: "Invalid Connection",
          message: "Self-connections to the same node are not permitted.",
        });
        setConnectingPort(null);
        return;
      }

      const newEdge: FlowEdge = {
        id: `edge_${connectingPort.nodeId}_${connectingPort.portId}_to_${nodeId}_${portId}`,
        sourceNodeId: connectingPort.nodeId,
        sourcePortId: connectingPort.portId,
        targetNodeId: nodeId,
        targetPortId: portId,
      };

      setFlow((prev) => {
        if (!prev) return prev;
        // Avoid duplicate identical edge
        const exists = prev.edges.some(
          (e) =>
            e.sourceNodeId === newEdge.sourceNodeId &&
            e.sourcePortId === newEdge.sourcePortId &&
            e.targetNodeId === newEdge.targetNodeId
        );
        if (exists) return prev;

        const updatedEdges = [...prev.edges, newEdge];
        triggerValidation(prev.nodes, updatedEdges);
        return { ...prev, edges: updatedEdges };
      });

      setConnectingPort(null);
      showToast({
        type: "success",
        title: "Connected",
        message: "Branch connection created.",
      });
    }
  };

  const deleteEdge = (edgeId: string) => {
    setFlow((prev) => {
      if (!prev) return prev;
      const updatedEdges = prev.edges.filter((e) => e.id !== edgeId);
      triggerValidation(prev.nodes, updatedEdges);
      return { ...prev, edges: updatedEdges };
    });
    setSelectedEdgeId(null);
  };

  // ----------------------------------------------------
  // NODE CRUD ACTIONS
  // ----------------------------------------------------
  const addNode = (type: FlowNodeType) => {
    if (!flow) return;
    const newNode = createDefaultNode(
      type,
      { x: Math.round(-pan.x / zoom + 400), y: Math.round(-pan.y / zoom + 200) },
      {
        hospitalName: flow.hospitalId === "hosp_daya_thrissur" ? "Daya Hospital Thrissur" : "Our Hospital",
        emergencyNumber: "0487 2475100",
      }
    );

    setFlow((prev) => {
      if (!prev) return prev;
      const updatedNodes = [...prev.nodes, newNode];
      triggerValidation(updatedNodes, prev.edges);
      return { ...prev, nodes: updatedNodes };
    });

    setSelectedNodeId(newNode.id);
    setIsPaletteOpen(false);
  };

  const duplicateNode = (nodeId: string) => {
    if (!flow) return;
    const target = flow.nodes.find((n) => n.id === nodeId);
    if (!target) return;

    const copyNode: FlowNode = {
      ...target,
      id: `${target.id}_copy_${flow.nodes.length + 1}`,
      title: `${target.title} (Copy)`,
      position: { x: target.position.x + 40, y: target.position.y + 40 },
    };

    setFlow((prev) => {
      if (!prev) return prev;
      const updatedNodes = [...prev.nodes, copyNode];
      triggerValidation(updatedNodes, prev.edges);
      return { ...prev, nodes: updatedNodes };
    });

    setSelectedNodeId(copyNode.id);
  };

  const deleteNode = (nodeId: string) => {
    if (!flow) return;
    const target = flow.nodes.find((n) => n.id === nodeId);
    if (target?.type === "INCOMING_CALL") {
      showToast({
        type: "warning",
        title: "Protected Node",
        message: "The Incoming Call start node cannot be deleted.",
      });
      return;
    }

    setFlow((prev) => {
      if (!prev) return prev;
      const updatedNodes = prev.nodes.filter((n) => n.id !== nodeId);
      const updatedEdges = prev.edges.filter(
        (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
      );
      triggerValidation(updatedNodes, updatedEdges);
      return { ...prev, nodes: updatedNodes, edges: updatedEdges };
    });

    setSelectedNodeId(null);
  };

  const updateNodeData = (nodeId: string, partialData: Record<string, unknown>) => {
    setFlow((prev) => {
      if (!prev) return prev;
      const updatedNodes = prev.nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...partialData },
          };
        }
        return node;
      });
      triggerValidation(updatedNodes, prev.edges);
      return { ...prev, nodes: updatedNodes };
    });
  };

  // ----------------------------------------------------
  // DRAFT SAVING & PUBLISHING
  // ----------------------------------------------------
  const handleSaveDraft = async () => {
    if (!flow) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/v1/ivr/flows/${flow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flow),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Draft Saved",
          message: "All flow nodes and connections saved successfully.",
        });
        setFlow(json.data);
      } else {
        showToast({
          type: "error",
          title: "Save Failed",
          message: json.error || "Could not save draft.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to communicate with flow service.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishFlow = async () => {
    if (!flow) return;
    const val = triggerValidation(flow.nodes, flow.edges);
    if (!val.isValid) {
      showToast({
        type: "error",
        title: "Validation Error",
        message: `Please resolve ${val.errors.length} flow errors before publishing.`,
      });
      setIsValidationDrawerOpen(true);
      setIsPublishModalOpen(false);
      return;
    }

    try {
      setIsPublishing(true);
      const res = await fetch(`/api/v1/ivr/flows/${flow.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: flow.hospitalId,
          changelog: publishChangelog.trim() || `Published version ${flow.currentVersion + 1}`,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Flow Published",
          message: `Flow published as immutable version v${json.versionNumber}.`,
        });
        setFlow(json.data);
        setIsPublishModalOpen(false);
        setPublishChangelog("");
      } else {
        showToast({
          type: "error",
          title: "Publish Failed",
          message: json.error || "Failed to publish flow.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Publish request failed.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // ----------------------------------------------------
  // SIMULATION PLAYGROUND HANDLERS
  // ----------------------------------------------------
  const startSimulation = () => {
    if (!flow) return;
    try {
      const initCtx = IvrFlowExecutionEngine.initializeContext(
        flow,
        `sim_${Date.now()}`,
        "+919447199999",
        flow.hospitalId,
        "ml-IN"
      );
      const step = IvrFlowExecutionEngine.executeStep(flow, initCtx, { type: "START_CALL" });
      setSimContext(initCtx);
      setSimStepResult(step);
      setIsSimulatorOpen(true);
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "Simulation Error",
        message: err instanceof Error ? err.message : "Could not initialize simulation.",
      });
    }
  };

  const sendSimulationInput = (event: { type: "DTMF_KEY" | "DTMF_DIGITS" | "TIMEOUT" | "EMERGENCY_DETECTED"; value?: string }) => {
    if (!flow || !simContext) return;
    const step = IvrFlowExecutionEngine.executeStep(flow, simContext, event);
    setSimContext({ ...step.context });
    setSimStepResult(step);
  };

  // ----------------------------------------------------
  // EXOTEL MAPPING UPDATE
  // ----------------------------------------------------
  const handleSaveExotelMapping = async () => {
    if (!flow) return;
    try {
      const res = await fetch(`/api/v1/ivr/flows/${flow.id}/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: flow.hospitalId,
          mapping: {
            appletId: exotelAppletIdInput.trim(),
            appletName: `${flow.name} Applet`,
            endpointUrl: "wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot",
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast({
          type: "success",
          title: "Exotel Mapping Verified",
          message: "Applet ID and telephony gateway streaming endpoint linked.",
        });
        setFlow(json.data);
        setIsExotelModalOpen(false);
      }
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to update Exotel mapping.",
      });
    }
  };

  // Selected Node Helper
  const selectedNode = flow?.nodes.find((n) => n.id === selectedNodeId);

  if (isLoading || !flow) {
    return (
      <DashboardLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center space-y-3">
            <Radio className="w-8 h-8 text-emerald-600 animate-pulse mx-auto" />
            <p className="text-sm font-medium text-slate-600">Loading IVR Flow Builder...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)] -m-6 overflow-hidden">
        {/* Top Action Toolbar */}
        <div className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <Link href="/ivr">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">{flow.name}</span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                v{flow.currentVersion}
              </span>
              <Badge
                variant="outline"
                className={
                  flow.deploymentStatus === "EXOTEL_MAPPING_VERIFIED" || flow.deploymentStatus === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]"
                    : "bg-slate-100 text-slate-700 border-slate-300 text-[10px]"
                }
              >
                {flow.deploymentStatus.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* Add Node Dropdown Button */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPaletteOpen(!isPaletteOpen)}
                className="h-8 text-xs font-medium border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                Add Node
              </Button>

              {isPaletteOpen && (
                <div className="absolute right-0 top-10 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 max-h-96 overflow-y-auto space-y-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
                    Flow Node Palette
                  </p>
                  {(Object.keys(NODE_TYPE_REGISTRY) as FlowNodeType[]).map((type) => {
                    const meta = NODE_TYPE_REGISTRY[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addNode(type)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs text-slate-700 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{meta.title}</p>
                          <p className="text-[10px] text-slate-500 line-clamp-1">{meta.description}</p>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          +
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Validation Pill Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsValidationDrawerOpen(true)}
              className={
                validation.isValid
                  ? "h-8 text-xs font-medium border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5"
                  : "h-8 text-xs font-medium border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 flex items-center gap-1.5"
              }
            >
              {validation.isValid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Valid Graph
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  {validation.errors.length} Errors
                </>
              )}
            </Button>

            {/* Simulation Playground Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={startSimulation}
              className="h-8 text-xs font-medium border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 text-blue-600" />
              Test Flow
            </Button>

            {/* Exotel Setup Instructions Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExotelModalOpen(true)}
              className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
              View Exotel Setup Instructions
            </Button>

            {/* Save Draft Button */}
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "Saving..." : "Save Draft"}
              </Button>
            )}

            {/* Publish Button */}
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setIsPublishModalOpen(true)}
                disabled={isPublishing}
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Publish v{flow.currentVersion + 1}
              </Button>
            )}
          </div>
        </div>

        {/* Main Canvas + Properties Drawer Area */}
        <div className="flex-1 relative bg-slate-900 overflow-hidden select-none">
          {/* Subtle Grid Background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Floating Canvas Controls */}
          <div className="absolute left-4 bottom-4 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-xs border border-slate-200 p-1 rounded-lg shadow-md text-xs">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2))}
              className="h-7 w-7 p-0"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </Button>
            <span className="font-mono text-[11px] text-slate-500 px-1">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
              className="h-7 w-7 p-0"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="h-7 w-7 p-0"
              title="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
            </Button>
          </div>

          {/* Canvas Viewport */}
          <div
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
          >
            {/* Transformed Stage */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                width: "5000px",
                height: "5000px",
                position: "absolute",
              }}
            >
              {/* SVG Edges Layer */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
                  </marker>
                  <marker
                    id="arrowhead-active"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                  </marker>
                </defs>

                {flow.edges.map((edge) => {
                  const sourceNode = flow.nodes.find((n) => n.id === edge.sourceNodeId);
                  const targetNode = flow.nodes.find((n) => n.id === edge.targetNodeId);
                  if (!sourceNode || !targetNode) return null;

                  // Node dimensions: 240px wide, ~110px high
                  const sx = sourceNode.position.x + 240;
                  const sy = sourceNode.position.y + 55;
                  const tx = targetNode.position.x;
                  const ty = targetNode.position.y + 55;

                  const isSelected = selectedEdgeId === edge.id;
                  const dx = Math.abs(tx - sx) * 0.5;
                  const pathData = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;

                  return (
                    <g key={edge.id} className="cursor-pointer pointer-events-auto">
                      <path
                        d={pathData}
                        fill="none"
                        stroke={isSelected ? "#10b981" : "#64748b"}
                        strokeWidth={isSelected ? 3 : 2}
                        markerEnd={isSelected ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdgeId(edge.id);
                          setSelectedNodeId(null);
                        }}
                      />
                      {edge.label && (
                        <text
                          x={(sx + tx) / 2}
                          y={(sy + ty) / 2 - 8}
                          fill="#cbd5e1"
                          fontSize="10"
                          fontFamily="sans-serif"
                          textAnchor="middle"
                          className="bg-slate-900 px-1 font-mono"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* HTML Nodes Layer */}
              {flow.nodes.map((node) => {
                const meta = NODE_TYPE_REGISTRY[node.type];
                const isSelected = selectedNodeId === node.id;
                const nodeHasError = validation.errors.some((e) => e.nodeId === node.id);
                const nodeHasWarning = validation.warnings.some((w) => w.nodeId === node.id);

                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    style={{
                      transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                      width: "240px",
                    }}
                    className={`absolute z-20 rounded-xl bg-white border-2 shadow-lg transition-shadow cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 ring-4 ring-emerald-500/20 shadow-xl"
                        : nodeHasError
                        ? "border-rose-500 ring-2 ring-rose-500/30"
                        : nodeHasWarning
                        ? "border-amber-400"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Node Header */}
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.badgeColor}`}>
                          {meta.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {nodeHasError && <XCircle className="w-4 h-4 text-rose-500" />}
                        {nodeHasWarning && !nodeHasError && (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                    </div>

                    {/* Node Body */}
                    <div className="p-3 text-xs space-y-1.5">
                      <p className="font-semibold text-slate-800 line-clamp-1">{node.title}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {node.type === "AI_VOICE_AGENT"
                          ? `Agent: ${(node.data as unknown as AiVoiceAgentNodeData).agentName || "Sarvam Assistant"}`
                          : node.type === "DIRECT_AI_RECEPTIONIST"
                          ? `Direct AI: ${(node.data as Record<string, unknown>).initialGreetingEnglish || "Voicebot"}`
                          : node.type === "REUSABLE_SUBFLOW"
                          ? `Subflow: ${(node.data as Record<string, unknown>).targetFlowCategory || (node.data as Record<string, unknown>).targetFlowId || "Modular Subflow"}`
                          : node.type === "EMERGENCY_HANDLING"
                          ? `Destination: ${(node.data as unknown as EmergencyHandlingNodeData).casualtyDestinationNumber || "Casualty"}`
                          : node.type === "EMERGENCY_MONITOR"
                          ? "Continuous Multilingual Monitor"
                          : node.description}
                      </p>
                    </div>

                    {/* Node Ports (Inputs on Left, Outputs on Right) */}
                    <div className="px-3 pb-2 pt-1 border-t border-slate-50 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      {/* Input Ports */}
                      <div className="space-y-1">
                        {node.ports.inputs.map((port) => (
                          <div
                            key={port.id}
                            onClick={(e) => handlePortClick(e, node.id, port.id, "input")}
                            className="flex items-center gap-1 hover:text-emerald-600 transition-colors cursor-crosshair"
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 hover:bg-emerald-500 border border-white" />
                            <span>{port.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Output Ports */}
                      <div className="space-y-1 text-right">
                        {node.ports.outputs.map((port) => (
                          <div
                            key={port.id}
                            onClick={(e) => handlePortClick(e, node.id, port.id, "output")}
                            className="flex items-center justify-end gap-1 hover:text-emerald-600 transition-colors cursor-crosshair"
                          >
                            <span>{port.label}</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 hover:bg-emerald-500 border border-white" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Edge Floating Delete Pill */}
          {selectedEdgeId && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-3 text-xs">
              <span className="font-semibold text-slate-800">Branch Connection Selected</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteEdge(selectedEdgeId)}
                className="h-6 text-[11px] px-2"
              >
                Delete Connection
              </Button>
            </div>
          )}

          {/* Node Properties Drawer (Right Side) */}
          {selectedNode && (
            <div className="absolute top-0 right-0 bottom-0 w-80 bg-white border-l border-slate-200 z-30 shadow-2xl flex flex-col justify-between overflow-y-auto">
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Configure Node
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">{selectedNode.title}</h3>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedNodeId(null)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Node Title Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Node Title</label>
                  <Input
                    type="text"
                    value={selectedNode.title}
                    onChange={(e) => {
                      const updated = flow.nodes.map((n) =>
                        n.id === selectedNode.id ? { ...n, title: e.target.value } : n
                      );
                      setFlow({ ...flow, nodes: updated });
                    }}
                    className="text-xs h-8"
                  />
                </div>

                {/* Dynamic Node Properties based on Node Type */}
                {selectedNode.type === "WELCOME_GREETING" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Malayalam Greeting Prompt
                      </label>
                      <textarea
                        rows={3}
                        value={(selectedNode.data as unknown as WelcomeGreetingNodeData).textMalayalam}
                        onChange={(e) => updateNodeData(selectedNode.id, { textMalayalam: e.target.value })}
                        className="w-full text-xs rounded-md border border-slate-200 p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        English Greeting Prompt
                      </label>
                      <textarea
                        rows={3}
                        value={(selectedNode.data as unknown as WelcomeGreetingNodeData).textEnglish}
                        onChange={(e) => updateNodeData(selectedNode.id, { textEnglish: e.target.value })}
                        className="w-full text-xs rounded-md border border-slate-200 p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Sarvam TTS Speaker
                      </label>
                      <select
                        value={(selectedNode.data as unknown as WelcomeGreetingNodeData).ttsSpeaker}
                        onChange={(e) => updateNodeData(selectedNode.id, { ttsSpeaker: e.target.value })}
                        className="w-full text-xs rounded-md border border-slate-200 p-1.5"
                      >
                        <option value="kavitha">kavitha (Verified Malayalam/English Female)</option>
                        <option value="ratan">ratan (Verified Malayalam/English Male)</option>
                        <option value="shubh">shubh (Verified Male)</option>
                        <option value="priya">priya (Verified Female)</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedNode.type === "IVR_MENU" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Malayalam Menu Audio Prompt
                      </label>
                      <textarea
                        rows={3}
                        value={(selectedNode.data as unknown as IvrMenuNodeData).menuPromptMalayalam}
                        onChange={(e) => updateNodeData(selectedNode.id, { menuPromptMalayalam: e.target.value })}
                        className="w-full text-xs rounded-md border border-slate-200 p-2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Menu DTMF Options
                      </label>
                      <div className="space-y-2">
                        {((selectedNode.data as unknown as IvrMenuNodeData).options || []).map((opt, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-emerald-700">Key: {opt.key}</span>
                              {opt.isEmergency && (
                                <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1 rounded">
                                  EMERGENCY
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-slate-800">{opt.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.type === "AI_VOICE_AGENT" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Bind Published AI Agent
                      </label>
                      <select
                        value={(selectedNode.data as unknown as AiVoiceAgentNodeData).agentId}
                        onChange={(e) => {
                          const chosen = availableAgents.find((a) => a.id === e.target.value);
                          updateNodeData(selectedNode.id, {
                            agentId: e.target.value,
                            agentName: chosen?.name || "AI Agent",
                            publishedVersion: chosen?.currentVersion || 1,
                          });
                        }}
                        className="w-full text-xs rounded-md border border-slate-200 p-2"
                      >
                        {availableAgents.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.name} (v{ag.currentVersion} - {ag.purpose})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 space-y-1">
                      <p className="font-semibold flex items-center gap-1">
                        <Bot className="w-3.5 h-3.5 text-teal-700" />
                        Sarvam AI Pipeline Active
                      </p>
                      <p className="text-[11px] text-teal-700">
                        The call will stream bidirectional 8000 Hz audio via WebSocket to the configured AI agent.
                      </p>
                    </div>
                  </div>
                )}

                {selectedNode.type === "EMERGENCY_HANDLING" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Casualty / Emergency Destination Number <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={(selectedNode.data as unknown as EmergencyHandlingNodeData).casualtyDestinationNumber}
                        onChange={(e) => updateNodeData(selectedNode.id, { casualtyDestinationNumber: e.target.value })}
                        className="text-xs h-8 font-mono"
                      />
                    </div>

                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
                      <p className="font-bold flex items-center gap-1 text-rose-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Clinical Safety Priority
                      </p>
                      <p className="text-[11px] text-rose-700">
                        Emergency handling bypasses all business hours schedules and immediately dials the hospital casualty line.
                      </p>
                    </div>
                  </div>
                )}

                {selectedNode.type === "HUMAN_TRANSFER" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Destination Phone Number
                      </label>
                      <Input
                        type="text"
                        value={(selectedNode.data as unknown as HumanTransferNodeData).destinationNumber || ""}
                        onChange={(e) => updateNodeData(selectedNode.id, { destinationNumber: e.target.value })}
                        className="text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Node Drawer Actions Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => duplicateNode(selectedNode.id)}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  Duplicate
                </Button>

                {selectedNode.type !== "INCOMING_CALL" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteNode(selectedNode.id)}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Node
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Validation Issues Drawer */}
        <Modal
          isOpen={isValidationDrawerOpen}
          onClose={() => setIsValidationDrawerOpen(false)}
          title={`Flow Validation: ${validation.errors.length} Errors, ${validation.warnings.length} Warnings`}
        >
          <div className="space-y-4 max-h-96 overflow-y-auto text-xs">
            {validation.errors.length > 0 && (
              <div className="space-y-2">
                <p className="font-bold text-rose-700 uppercase tracking-wider text-[11px]">
                  Errors (Must be resolved to publish):
                </p>
                {validation.errors.map((err, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (err.nodeId) setSelectedNodeId(err.nodeId);
                      setIsValidationDrawerOpen(false);
                    }}
                    className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 cursor-pointer hover:bg-rose-100"
                  >
                    <p className="font-semibold">{err.message}</p>
                    <p className="text-[10px] font-mono text-rose-600 mt-0.5">Code: {err.code}</p>
                  </div>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <p className="font-bold text-amber-700 uppercase tracking-wider text-[11px]">
                  Warnings (Best practice recommendations):
                </p>
                {validation.warnings.map((warn, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (warn.nodeId) setSelectedNodeId(warn.nodeId);
                      setIsValidationDrawerOpen(false);
                    }}
                    className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 cursor-pointer hover:bg-amber-100"
                  >
                    <p className="font-semibold">{warn.message}</p>
                    <p className="text-[10px] font-mono text-amber-600 mt-0.5">Code: {warn.code}</p>
                  </div>
                ))}
              </div>
            )}

            {validation.isValid && validation.warnings.length === 0 && (
              <div className="p-6 text-center text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                <p className="font-bold text-sm">Flow Graph is 100% Valid</p>
                <p className="text-xs text-emerald-600 mt-1">
                  All branches, entrypoints, and emergency destinations meet hospital telephony standards.
                </p>
              </div>
            )}
          </div>
        </Modal>

        {/* Interactive Simulation Playground Modal */}
        <Modal
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          title="Interactive IVR Call Simulation Playground"
        >
          {simStepResult && simContext && (
            <div className="space-y-4 text-xs">
              {/* Call Status Bar */}
              <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Simulated Caller</span>
                  <p className="font-mono font-bold text-sm text-emerald-400">{simContext.callerNumber}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Language</span>
                  <p className="font-bold text-xs">{simContext.currentLanguage}</p>
                </div>
              </div>

              {/* Audio Prompt Output Display */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-blue-800 font-semibold">
                  <Volume2 className="w-4 h-4 text-blue-600" />
                  Spoken Hospital Announcement:
                </div>
                <p className="text-sm font-medium text-slate-900 bg-white p-2.5 rounded border border-blue-100">
                  {simStepResult.audioText || simStepResult.dtmfPrompt || simStepResult.logMessage}
                </p>
              </div>

              {/* DTMF Dialpad Simulation */}
              <div className="space-y-2">
                <p className="font-semibold text-slate-700">Telephone Keypad (DTMF Input):</p>
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
                    <Button
                      key={key}
                      variant="outline"
                      onClick={() => sendSimulationInput({ type: "DTMF_KEY", value: key })}
                      className="h-10 text-base font-bold font-mono hover:bg-emerald-50 hover:border-emerald-300"
                    >
                      {key}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Action Simulation Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendSimulationInput({ type: "TIMEOUT" })}
                  className="text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  Simulate Silence / Timeout
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => sendSimulationInput({ type: "EMERGENCY_DETECTED", value: "അടിയന്തിരം!" })}
                  className="text-xs font-semibold"
                >
                  Trigger Emergency Escalation
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Publish Version Modal */}
        <Modal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          title={`Publish IVR Call Flow v${flow.currentVersion + 1}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Publishing creates an immutable snapshot of this call routing graph. New incoming phone calls will immediately execute this version.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Changelog / Release Summary
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Added emergency fast-track and updated Malayalam greeting pace."
                value={publishChangelog}
                onChange={(e) => setPublishChangelog(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-200 p-2"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsPublishModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePublishFlow}
                disabled={isPublishing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isPublishing ? "Publishing..." : "Confirm & Publish"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Exotel Mapping Modal */}
        <Modal
          isOpen={isExotelModalOpen}
          onClose={() => setIsExotelModalOpen(false)}
          title="Exotel Telephony Integration & Setup Instructions"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
              <p className="font-semibold text-slate-900">Provider Limitation & Runtime Boundary:</p>
              <p>
                Exotel Singapore (smrkonova1) does not support dynamic visual applet modifications via API.
                Publishing this flow updates the Smrkomed runtime dynamically for all incoming calls routed through Applet <strong>{exotelAppletIdInput}</strong>.
              </p>
              <p className="text-[11px] text-amber-800">
                Existing active calls remain locked to their starting version snapshot until disconnected.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Exotel Applet ID
              </label>
              <Input
                type="text"
                value={exotelAppletIdInput}
                onChange={(e) => setExotelAppletIdInput(e.target.value)}
                placeholder="e.g. 1393239"
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsExotelModalOpen(false)}>
                Close
              </Button>
              <Button
                onClick={handleSaveExotelMapping}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Save & Verify Mapping
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

export default function IvrFlowBuilderPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400 text-xs">
          Loading Visual Flow Builder...
        </div>
      }
    >
      <IvrFlowBuilderContent />
    </React.Suspense>
  );
}
