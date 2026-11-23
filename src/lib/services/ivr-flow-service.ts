/**
 * ============================================================================
 * SMRKOMED IVR CALL FLOW MANAGEMENT SERVICE (PHASE 4)
 * ============================================================================
 *
 * Core service layer for multi-hospital Inbound IVR Call Flows:
 * - Flow directory, CRUD, and draft saving
 * - Validation using IvrFlowValidator
 * - Immutable versioning, publishing, and rollback
 * - Exotel deployment mapping status and guide
 * - Simulation playground integration
 * - PostgreSQL persistence with fast in-memory fallback
 */

import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";
import type { Prisma, EmergencyRoutingConfig, EmergencyEvent, FlowAuditEvent } from "@prisma/client";
import {
  IvrFlowData,
  IvrFlowVersionData,
  FlowValidationResult,
  ExotelMappingGuide,
  FlowCategory,
} from "@/lib/types/ivr-flow";
import { IvrFlowValidator } from "./ivr-flow-validator";
import { createDefaultHospitalFlow } from "./ivr-node-definitions";
import {
  getFlowTemplatesCatalog,
  cloneFlowFromTemplate,
  IvrFlowTemplateSummary,
} from "./flow-templates";

// Fast in-memory storage fallback for unit testing and local sandboxes
const inMemoryFlows = new Map<string, IvrFlowData>();
const inMemoryVersions = new Map<string, IvrFlowVersionData[]>();
const inMemoryExecutionSessions = new Map<string, unknown>();

export interface PersistenceHealthStatus {
  status: "HEALTHY" | "DEGRADED";
  unpersistedSessionCount: number;
  lastFailureTime?: string;
  lastFailureError?: string;
  reconciledCount: number;
}

export interface PersistExecutionSessionParams {
  sessionId?: string;
  flowId: string;
  versionNumber: number;
  callSid: string;
  callerNumber: string;
  hospitalId: string;
  currentNodeId: string;
  variables?: Record<string, unknown>;
  status?: string;
  executionLog: unknown[];
}

const unpersistedExecutionSessions = new Map<string, PersistExecutionSessionParams>();
let persistenceState: "HEALTHY" | "DEGRADED" = "HEALTHY";
let lastPersistenceErrorDetails: { time: string; error: string; callSid?: string } | null = null;
let totalReconciledCount = 0;

export class IvrFlowService {
  /**
   * Retrieves all IVR flows for a hospital tenant.
   */
  public async getFlowsByHospital(hospitalId: string): Promise<IvrFlowData[]> {
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const records = await prisma.ivrFlow.findMany({
          where: { hospitalId },
          orderBy: { updatedAt: "desc" },
        });

        if (records.length > 0) {
          return records.map((r) => this.mapDbRecordToFlow(r));
        }
      } catch (err) {
        console.warn("[IvrFlowService] DB read failed, falling back to memory:", err);
      }
    }

    // Check memory
    const tenantFlows = Array.from(inMemoryFlows.values()).filter((f) => f.hospitalId === hospitalId);
    if (tenantFlows.length > 0) {
      return tenantFlows;
    }

    // Initialize default flow for the hospital
    const defaultFlow = createDefaultHospitalFlow(
      hospitalId,
      hospitalId === "hosp_daya_thrissur" ? "Daya Hospital Thrissur" : `Hospital ${hospitalId}`,
      ""
    );

    inMemoryFlows.set(defaultFlow.id, defaultFlow);

    if (!inMemoryVersions.has(defaultFlow.id)) {
      inMemoryVersions.set(defaultFlow.id, [
        {
          id: `ver_${defaultFlow.id}_1`,
          flowId: defaultFlow.id,
          versionNumber: 1,
          status: "PUBLISHED",
          deploymentStatus: defaultFlow.deploymentStatus,
          changelog: "Default hospital IVR flow template",
          snapshot: {
            name: defaultFlow.name,
            description: defaultFlow.description,
            nodes: [...defaultFlow.nodes],
            edges: [...defaultFlow.edges],
            variables: { ...defaultFlow.variables },
            exotelMapping: defaultFlow.exotelMapping,
          },
          publishedBy: "System Administrator",
          publishedAt: defaultFlow.createdAt,
        },
      ]);
    }

    return [defaultFlow];
  }

  /**
   * Resolves the active published IVR flow for a hospital tenant.
   * Guarantees strict tenant isolation: will NEVER load another hospital's flow.
   * Returns null if no published flow exists for this hospital.
   */
  public async getActivePublishedFlow(
    hospitalId: string,
    exotelAppletId?: string
  ): Promise<{ flow: IvrFlowData; version: IvrFlowVersionData } | null> {
    if (!hospitalId) return null;

    // 1. Check DB first if connected
    const dbStatus = await checkDatabaseConnection();
    let publishedFlows: IvrFlowData[] = [];

    if (dbStatus.connected) {
      try {
        const records = await prisma.ivrFlow.findMany({
          where: { hospitalId, status: "PUBLISHED" },
          orderBy: { updatedAt: "desc" },
        });
        if (records.length > 0) {
          publishedFlows = records.map((r) => this.mapDbRecordToFlow(r));
        }
      } catch {}
    }

    // 2. Check in-memory flows strictly for this hospitalId
    if (publishedFlows.length === 0) {
      publishedFlows = Array.from(inMemoryFlows.values()).filter(
        (f) => f.hospitalId === hospitalId && f.status === "PUBLISHED"
      );
    }

    // 3. For primary Daya pilot tenant, seed default published flow if not yet created
    if (publishedFlows.length === 0 && hospitalId === "hosp_daya_thrissur") {
      const defaultFlows = await this.getFlowsByHospital(hospitalId);
      publishedFlows = defaultFlows.filter((f) => f.status === "PUBLISHED");
    }

    if (publishedFlows.length === 0) {
      return null;
    }

    // 2. Select matching flow: prefer default flow with matching appletId, else default flow, else first published
    let selectedFlow = exotelAppletId
      ? publishedFlows.find((f) => f.exotelMapping?.appletId === exotelAppletId && f.isDefault && f.id.includes("main_inbound")) ||
        publishedFlows.find((f) => f.exotelMapping?.appletId === exotelAppletId && f.isDefault) ||
        publishedFlows.find((f) => f.exotelMapping?.appletId === exotelAppletId)
      : undefined;

    if (!selectedFlow) {
      selectedFlow = publishedFlows.find((f) => f.isDefault) || publishedFlows[0];
    }

    // 3. Fetch immutable version snapshot
    const versions = await this.getFlowVersions(selectedFlow.id, hospitalId);
    let version = versions.find((v) => v.versionNumber === selectedFlow!.currentVersion);
    if (!version && versions.length > 0) {
      version = versions[0];
    }

    if (!version) {
      // Create version 1 snapshot on the fly if needed
      version = {
        id: `ver_${selectedFlow.id}_${selectedFlow.currentVersion}`,
        flowId: selectedFlow.id,
        versionNumber: selectedFlow.currentVersion,
        status: "PUBLISHED",
        deploymentStatus: selectedFlow.deploymentStatus,
        changelog: "Published hospital call flow",
        snapshot: {
          name: selectedFlow.name,
          description: selectedFlow.description,
          nodes: [...selectedFlow.nodes],
          edges: [...selectedFlow.edges],
          variables: { ...selectedFlow.variables },
          exotelMapping: selectedFlow.exotelMapping,
        },
        publishedBy: selectedFlow.lastUpdatedBy || "System",
        publishedAt: selectedFlow.updatedAt || new Date().toISOString(),
      };
      const existing = inMemoryVersions.get(selectedFlow.id) || [];
      existing.unshift(version);
      inMemoryVersions.set(selectedFlow.id, existing);
    }

    const flowFromSnapshot: IvrFlowData = {
      id: selectedFlow.id,
      hospitalId,
      name: version.snapshot.name || selectedFlow.name,
      description: version.snapshot.description,
      status: "PUBLISHED",
      deploymentStatus: version.deploymentStatus,
      isDefault: selectedFlow.isDefault,
      currentVersion: version.versionNumber,
      category: version.snapshot.category || selectedFlow.category || "INBOUND_RECEPTION",
      direction: version.snapshot.direction || selectedFlow.direction || "INBOUND",
      executionPriority: version.snapshot.executionPriority ?? selectedFlow.executionPriority ?? 0,
      triggerConditions: version.snapshot.triggerConditions || selectedFlow.triggerConditions,
      isEnabled: selectedFlow.isEnabled ?? true,
      isTemplate: selectedFlow.isTemplate ?? false,
      templateCategory: selectedFlow.templateCategory,
      nodes: version.snapshot.nodes,
      edges: version.snapshot.edges,
      variables: version.snapshot.variables,
      exotelMapping: version.snapshot.exotelMapping || selectedFlow.exotelMapping,
      lastUpdatedBy: version.publishedBy,
      createdAt: selectedFlow.createdAt,
      updatedAt: version.publishedAt,
    };

    return {
      flow: flowFromSnapshot,
      version,
    };
  }

  /**
   * Persists or updates the execution session state for an active IVR call.
   */
  public async persistExecutionSession(params: {
    sessionId?: string;
    flowId: string;
    versionNumber: number;
    callSid: string;
    callerNumber: string;
    hospitalId: string;
    currentNodeId: string;
    variables?: Record<string, unknown>;
    status?: string;
    executionLog: unknown[];
  }): Promise<string> {
    const sessionId = params.sessionId || `session_${params.callSid || Date.now()}`;
    const dbStatus = await checkDatabaseConnection();

    let persistedToDb = false;
    if (dbStatus.connected) {
      try {
        await prisma.ivrFlowExecutionSession.upsert({
          where: { id: sessionId },
          create: {
            id: sessionId,
            flowId: params.flowId,
            versionNumber: params.versionNumber,
            callSid: params.callSid,
            callerNumber: params.callerNumber,
            hospitalId: params.hospitalId,
            currentNodeId: params.currentNodeId,
            variables: params.variables as unknown as Prisma.InputJsonValue,
            status: params.status || "ACTIVE",
            executionLog: params.executionLog as unknown as Prisma.InputJsonValue,
          },
          update: {
            currentNodeId: params.currentNodeId,
            variables: params.variables as unknown as Prisma.InputJsonValue,
            status: params.status || "ACTIVE",
            executionLog: params.executionLog as unknown as Prisma.InputJsonValue,
          },
        });
        persistedToDb = true;
        unpersistedExecutionSessions.delete(sessionId);

        // Attempt reconciliation of queued sessions
        if (unpersistedExecutionSessions.size > 0) {
          for (const [pendId, pendParams] of Array.from(unpersistedExecutionSessions.entries())) {
            try {
              await prisma.ivrFlowExecutionSession.upsert({
                where: { id: pendId },
                create: {
                  id: pendId,
                  flowId: pendParams.flowId,
                  versionNumber: pendParams.versionNumber,
                  callSid: pendParams.callSid,
                  callerNumber: pendParams.callerNumber,
                  hospitalId: pendParams.hospitalId,
                  currentNodeId: pendParams.currentNodeId,
                  variables: pendParams.variables as unknown as Prisma.InputJsonValue,
                  status: pendParams.status || "ACTIVE",
                  executionLog: pendParams.executionLog as unknown as Prisma.InputJsonValue,
                },
                update: {
                  currentNodeId: pendParams.currentNodeId,
                  variables: pendParams.variables as unknown as Prisma.InputJsonValue,
                  status: pendParams.status || "ACTIVE",
                  executionLog: pendParams.executionLog as unknown as Prisma.InputJsonValue,
                },
              });
              unpersistedExecutionSessions.delete(pendId);
              totalReconciledCount++;
            } catch {
              break;
            }
          }
        }
        if (unpersistedExecutionSessions.size === 0) {
          persistenceState = "HEALTHY";
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        persistenceState = "DEGRADED";
        lastPersistenceErrorDetails = {
          time: new Date().toISOString(),
          error: errorMsg,
          callSid: params.callSid,
        };
        unpersistedExecutionSessions.set(sessionId, params);
        console.warn(
          `[IvrFlowService:PERSISTENCE_DEGRADED] DB persistExecutionSession failed for session ${sessionId} (callSid: ${params.callSid}): ${errorMsg}. Held in memory reconciliation queue.`
        );
      }
    } else {
      persistenceState = "DEGRADED";
      lastPersistenceErrorDetails = {
        time: new Date().toISOString(),
        error: "PostgreSQL disconnected or DATABASE_URL unavailable",
        callSid: params.callSid,
      };
      unpersistedExecutionSessions.set(sessionId, params);
      console.warn(
        `[IvrFlowService:PERSISTENCE_DEGRADED] Database offline. Session ${sessionId} (callSid: ${params.callSid}) held in memory reconciliation queue.`
      );
    }

    inMemoryExecutionSessions.set(sessionId, {
      ...params,
      id: sessionId,
      isDurable: persistedToDb,
      updatedAt: new Date().toISOString(),
    });

    return sessionId;
  }

  /**
   * Returns live persistence health and unpersisted reconciliation metrics.
   */
  public getPersistenceHealth(): PersistenceHealthStatus {
    return {
      status: persistenceState,
      unpersistedSessionCount: unpersistedExecutionSessions.size,
      lastFailureTime: lastPersistenceErrorDetails?.time,
      lastFailureError: lastPersistenceErrorDetails?.error,
      reconciledCount: totalReconciledCount,
    };
  }

  /**
   * Retrieves a single IVR flow by ID with strict hospital tenant isolation.
   */
  public async getFlowById(flowId: string, hospitalId?: string): Promise<IvrFlowData | null> {
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const record = await prisma.ivrFlow.findUnique({
          where: { id: flowId },
        });

        if (record) {
          if (hospitalId && record.hospitalId !== hospitalId) {
            return null; // Tenant isolation violation
          }
          return this.mapDbRecordToFlow(record);
        }
      } catch (err) {
        console.warn("[IvrFlowService] DB getFlowById failed:", err);
      }
    }

    const flow = inMemoryFlows.get(flowId);
    if (!flow) return null;
    if (hospitalId && flow.hospitalId !== hospitalId) return null;
    return flow;
  }

  /**
   * Saves or updates a flow draft.
   */
  public async saveDraft(
    flowData: Partial<IvrFlowData> & { id: string; hospitalId: string; name: string },
    userName = "Hospital Administrator"
  ): Promise<IvrFlowData> {
    const existing = await this.getFlowById(flowData.id, flowData.hospitalId);

    const status = flowData.status ?? "DRAFT";
    const deploymentStatus =
      flowData.deploymentStatus ??
      (status === "VALIDATED"
        ? "VALIDATED"
        : status === "PUBLISHED"
        ? (flowData.exotelMapping?.verifiedAt ? "EXOTEL_MAPPING_VERIFIED" : "PUBLISHED_INTERNALLY")
        : (existing?.deploymentStatus === "ACTIVE" ? "ACTIVE" : "SMRKOMED_DRAFT"));

    const merged: IvrFlowData = {
      id: flowData.id,
      hospitalId: flowData.hospitalId,
      name: flowData.name.trim(),
      description: flowData.description || existing?.description || "",
      status,
      deploymentStatus,
      isDefault: flowData.isDefault ?? existing?.isDefault ?? false,
      currentVersion: existing?.currentVersion ?? 1,
      category: flowData.category || existing?.category || "INBOUND_RECEPTION",
      direction: flowData.direction || existing?.direction || "INBOUND",
      executionPriority: flowData.executionPriority ?? existing?.executionPriority ?? 0,
      triggerConditions: flowData.triggerConditions || existing?.triggerConditions,
      isEnabled: flowData.isEnabled ?? existing?.isEnabled ?? true,
      isTemplate: flowData.isTemplate ?? existing?.isTemplate ?? false,
      templateCategory: flowData.templateCategory || existing?.templateCategory,
      nodes: flowData.nodes || existing?.nodes || [],
      edges: flowData.edges || existing?.edges || [],
      variables: flowData.variables || existing?.variables || {},
      exotelMapping: flowData.exotelMapping || existing?.exotelMapping,
      lastUpdatedBy: userName,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        await prisma.ivrFlow.upsert({
          where: { id: merged.id },
          create: {
            id: merged.id,
            hospitalId: merged.hospitalId,
            name: merged.name,
            description: merged.description,
            status: merged.status,
            deploymentStatus: merged.deploymentStatus,
            isDefault: merged.isDefault,
            currentVersion: merged.currentVersion,
            category: merged.category,
            direction: merged.direction,
            executionPriority: merged.executionPriority,
            triggerConditions: merged.triggerConditions as unknown as Prisma.InputJsonValue,
            isEnabled: merged.isEnabled,
            isTemplate: merged.isTemplate,
            templateCategory: merged.templateCategory,
            nodesJson: merged.nodes as unknown as Prisma.InputJsonValue,
            edgesJson: merged.edges as unknown as Prisma.InputJsonValue,
            variablesJson: merged.variables as unknown as Prisma.InputJsonValue,
            exotelAppletId: merged.exotelMapping?.appletId,
            exotelAppletName: merged.exotelMapping?.appletName,
            exotelEndpointUrl: merged.exotelMapping?.endpointUrl,
            exotelVerifiedAt: merged.exotelMapping?.verifiedAt ? new Date(merged.exotelMapping.verifiedAt) : undefined,
            lastUpdatedBy: userName,
          },
          update: {
            name: merged.name,
            description: merged.description,
            status: merged.status,
            deploymentStatus: merged.deploymentStatus,
            isDefault: merged.isDefault,
            category: merged.category,
            direction: merged.direction,
            executionPriority: merged.executionPriority,
            triggerConditions: merged.triggerConditions as unknown as Prisma.InputJsonValue,
            isEnabled: merged.isEnabled,
            isTemplate: merged.isTemplate,
            templateCategory: merged.templateCategory,
            nodesJson: merged.nodes as unknown as Prisma.InputJsonValue,
            edgesJson: merged.edges as unknown as Prisma.InputJsonValue,
            variablesJson: merged.variables as unknown as Prisma.InputJsonValue,
            exotelAppletId: merged.exotelMapping?.appletId,
            exotelAppletName: merged.exotelMapping?.appletName,
            exotelEndpointUrl: merged.exotelMapping?.endpointUrl,
            exotelVerifiedAt: merged.exotelMapping?.verifiedAt ? new Date(merged.exotelMapping.verifiedAt) : undefined,
            lastUpdatedBy: userName,
          },
        });
      } catch (err) {
        console.warn("[IvrFlowService] DB saveDraft failed:", err);
      }
    }

    inMemoryFlows.set(merged.id, merged);
    return merged;
  }

  /**
   * Validates a flow graph against all clinical and telephony invariants.
   */
  public async validateFlow(flowId: string, hospitalId: string): Promise<FlowValidationResult> {
    const flow = await this.getFlowById(flowId, hospitalId);
    if (!flow) {
      return {
        isValid: false,
        errors: [{ level: "ERROR", message: `Flow '${flowId}' not found.`, code: "FLOW_NOT_FOUND" }],
        warnings: [],
      };
    }

    const result = IvrFlowValidator.validate(flow.nodes, flow.edges);

    if (result.isValid && flow.status === "DRAFT") {
      await this.saveDraft({
        ...flow,
        status: "VALIDATED",
        deploymentStatus: "VALIDATED",
      });
    }

    return result;
  }

  /**
   * Publishes an IVR flow, generating an immutable version snapshot.
   */
  public async publishFlow(
    flowId: string,
    hospitalId: string,
    changelog = "Published new flow version",
    userName = "Hospital Administrator"
  ): Promise<{ success: boolean; versionNumber: number; flow?: IvrFlowData; error?: string }> {
    const flow = await this.getFlowById(flowId, hospitalId);
    if (!flow) {
      return { success: false, versionNumber: 0, error: `Flow '${flowId}' not found.` };
    }

    // Enforce validation before publishing
    const validation = IvrFlowValidator.validate(flow.nodes, flow.edges);
    if (!validation.isValid) {
      return {
        success: false,
        versionNumber: flow.currentVersion,
        error: `Cannot publish invalid flow: ${validation.errors.map((e) => e.message).join("; ")}`,
      };
    }

    // Safety rule: Cannot publish enabled emergency transfer without confirmed destination
    const hasActiveEmergencyTransfer = flow.nodes.some((n) => {
      if (n.type === "EMERGENCY_HANDLING") {
        const d = n.data as Record<string, unknown>;
        return Boolean(d.autoTransfer || d.autoTransferEnabled);
      }
      return false;
    });

    if (hasActiveEmergencyTransfer) {
      const emConfig = await this.getEmergencyRoutingConfig(hospitalId);
      if (!emConfig || !emConfig.isVerified || !emConfig.allowLiveTransfer || !emConfig.casualtyNumber) {
        return {
          success: false,
          versionNumber: flow.currentVersion,
          error: "Cannot publish flow with enabled emergency transfer: Hospital emergency destination is unconfirmed. Emergency auto-transfer must remain DISABLED until an authorized representative confirms the destination.",
        };
      }
    }

    const nextVersion = flow.currentVersion + 1;
    const deploymentStatus = flow.exotelMapping?.verifiedAt ? "EXOTEL_MAPPING_VERIFIED" : "PUBLISHED_INTERNALLY";

    flow.status = "PUBLISHED";
    flow.deploymentStatus = deploymentStatus;
    flow.currentVersion = nextVersion;
    flow.lastUpdatedBy = userName;
    flow.updatedAt = new Date().toISOString();

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        await prisma.$transaction([
          prisma.ivrFlow.update({
            where: { id: flowId },
            data: {
              status: "PUBLISHED",
              deploymentStatus,
              currentVersion: nextVersion,
              lastUpdatedBy: userName,
            },
          }),
          prisma.ivrFlowVersion.create({
            data: {
              flowId,
              versionNumber: nextVersion,
              status: "PUBLISHED",
              deploymentStatus,
              changelog,
              snapshotJson: flow as unknown as Prisma.InputJsonValue,
              publishedBy: userName,
            },
          }),
        ]);
      } catch (err) {
        console.warn("[IvrFlowService] DB publishFlow failed:", err);
      }
    }

    // Save in memory
    inMemoryFlows.set(flow.id, flow);
    const versions = inMemoryVersions.get(flowId) || [];
    versions.unshift({
      id: `ver_${flowId}_${nextVersion}`,
      flowId,
      versionNumber: nextVersion,
      status: "PUBLISHED",
      deploymentStatus,
      changelog,
      snapshot: {
        name: flow.name,
        description: flow.description,
        nodes: [...flow.nodes],
        edges: [...flow.edges],
        variables: { ...flow.variables },
        exotelMapping: flow.exotelMapping,
      },
      publishedBy: userName,
      publishedAt: new Date().toISOString(),
    });
    inMemoryVersions.set(flowId, versions);

    return {
      success: true,
      versionNumber: nextVersion,
      flow,
    };
  }

  /**
   * Retrieves all immutable published versions of an IVR flow.
   */
  public async getFlowVersions(flowId: string, hospitalId: string): Promise<IvrFlowVersionData[]> {
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const records = await prisma.ivrFlowVersion.findMany({
          where: { flowId, flow: { hospitalId } },
          orderBy: { versionNumber: "desc" },
        });

        if (records.length > 0) {
          return records.map((r) => ({
            id: r.id,
            flowId: r.flowId,
            versionNumber: r.versionNumber,
            status: r.status as IvrFlowVersionData["status"],
            deploymentStatus: r.deploymentStatus as IvrFlowVersionData["deploymentStatus"],
            changelog: r.changelog || undefined,
            snapshot: r.snapshotJson as unknown as IvrFlowVersionData["snapshot"],
            publishedBy: r.publishedBy,
            publishedAt: r.publishedAt.toISOString(),
          }));
        }
      } catch (err) {
        console.warn("[IvrFlowService] DB getFlowVersions failed:", err);
      }
    }

    return inMemoryVersions.get(flowId) || [];
  }

  /**
   * Rolls back a flow to a previously published version snapshot.
   */
  public async rollbackFlow(
    flowId: string,
    targetVersion: number,
    hospitalId: string,
    userName = "Hospital Administrator"
  ): Promise<{ success: boolean; versionNumber: number; flow?: IvrFlowData; error?: string }> {
    const versions = await this.getFlowVersions(flowId, hospitalId);
    const match = versions.find((v) => v.versionNumber === targetVersion);

    if (!match) {
      return { success: false, versionNumber: 0, error: `Version ${targetVersion} not found for flow '${flowId}'.` };
    }

    const restored: IvrFlowData = {
      id: flowId,
      hospitalId,
      name: match.snapshot.name,
      description: match.snapshot.description,
      status: "DRAFT",
      deploymentStatus: "SMRKOMED_DRAFT",
      isDefault: false,
      currentVersion: targetVersion,
      category: match.snapshot.category || "INBOUND_RECEPTION",
      direction: match.snapshot.direction || "INBOUND",
      executionPriority: match.snapshot.executionPriority ?? 0,
      triggerConditions: match.snapshot.triggerConditions,
      isEnabled: true,
      isTemplate: false,
      templateCategory: undefined,
      nodes: match.snapshot.nodes,
      edges: match.snapshot.edges,
      variables: match.snapshot.variables,
      exotelMapping: match.snapshot.exotelMapping,
      lastUpdatedBy: userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveDraft(restored, userName);
    return this.publishFlow(flowId, hospitalId, `Rolled back to version ${targetVersion}`, userName);
  }

  /**
   * Updates Exotel applet mapping and verification status.
   */
  public async updateExotelMapping(
    flowId: string,
    hospitalId: string,
    mapping: Partial<ExotelMappingGuide>,
    userName = "Hospital Administrator"
  ): Promise<{ success: boolean; flow: IvrFlowData }> {
    const flow = await this.getFlowById(flowId, hospitalId);
    if (!flow) {
      throw new Error(`Flow '${flowId}' not found.`);
    }

    flow.exotelMapping = {
      ...flow.exotelMapping,
      requiredAppletType: "Voicebot Applet",
      streamingPath: "/exotel/voicebot",
      mappingInstructions: [
        `1. Open Exotel Dashboard -> App Bazaar -> Applet ID ${mapping.appletId || "1393239"}.`,
        `2. Set WebSocket URL to: ${mapping.endpointUrl || "wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot"}.`,
        "3. Route the hospital ExoPhone (08047291658) to this Applet.",
      ],
      lastVerificationStatus: mapping.appletId ? "VERIFIED" : "PENDING_MAPPING",
      ...mapping,
      verifiedAt: mapping.appletId ? new Date().toISOString() : undefined,
    };

    if (mapping.appletId) {
      flow.deploymentStatus = "EXOTEL_MAPPING_VERIFIED";
    }

    await this.saveDraft(flow, userName);
    return { success: true, flow };
  }

  // ----------------------------------------------------
  // FLOW CENTRE & MULTI-TENANT ORCHESTRATION (PHASE 4.6)
  // ----------------------------------------------------

  /**
   * Retrieves IVR flows filtered by category for a hospital.
   */
  public async getFlowsByCategory(hospitalId: string, category: FlowCategory): Promise<IvrFlowData[]> {
    const allFlows = await this.getFlowsByHospital(hospitalId);
    return allFlows.filter((f) => f.category === category);
  }

  /**
   * Returns the catalog of all available hospital flow templates.
   */
  public getFlowTemplates(): IvrFlowTemplateSummary[] {
    return getFlowTemplatesCatalog();
  }

  /**
   * Clones a new flow from a template into the hospital's workspace.
   */
  public async cloneFromTemplate(
    templateId: string,
    hospitalId: string,
    hospitalName = "Daya Hospital Thrissur",
    overrides?: Partial<IvrFlowData>,
    userName = "Hospital Administrator"
  ): Promise<IvrFlowData> {
    const cloned = cloneFlowFromTemplate(templateId, hospitalId, hospitalName, overrides);
    const saved = await this.saveDraft(cloned, userName);

    await this.logAuditEvent({
      hospitalId,
      flowId: saved.id,
      flowVersion: 1,
      action: "CLONED",
      actor: userName,
      details: { templateId, name: saved.name },
    });

    return saved;
  }

  /**
   * Retrieves hospital emergency routing configuration.
   */
  public async getEmergencyRoutingConfig(hospitalId: string): Promise<EmergencyRoutingConfig | null> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const config = await prisma.emergencyRoutingConfig.findUnique({
          where: { hospitalId },
        });
        if (config) return config;
      } catch (err) {
        console.warn("[IvrFlowService] DB getEmergencyRoutingConfig failed:", err);
      }
    }

    // Default configuration: auto-transfer strictly DISABLED until authorized confirmation
    return {
      id: `em_config_${hospitalId}`,
      hospitalId,
      casualtyNumber: "",
      isVerified: false,
      verifiedBy: null,
      verifiedAt: null,
      fallbackNumber: "108",
      allowLiveTransfer: false, // development safe default: DISABLED
      interruptionKeywordsMalayalam: ["നെഞ്ചുവേദന", "ശ്വാസംമുട്ടൽ", "അത്യാഹിതം", "രക്തം", "ആംബുലൻസ്", "കാഷ്വാലിറ്റി"],
      interruptionKeywordsEnglish: ["chest pain", "emergency", "casualty", "heart attack", "bleeding", "ambulance", "breathing"],
      interruptionKeywordsManglish: ["nenju vedana", "swasam muttal", "accident", "blood"],
      confidenceThreshold: 0.7,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Updates hospital emergency routing configuration.
   */
  public async updateEmergencyRoutingConfig(
    hospitalId: string,
    config: Partial<EmergencyRoutingConfig>,
    userName = "Hospital Administrator"
  ): Promise<EmergencyRoutingConfig> {
    if (config.allowLiveTransfer) {
      if (!config.casualtyNumber || !config.casualtyNumber.trim()) {
        throw new Error("Emergency auto-transfer cannot be enabled without a valid destination number.");
      }
      if (!config.isVerified) {
        throw new Error("Emergency auto-transfer requires verified destination authorization from an authorized hospital representative.");
      }
    }

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const updated = await prisma.emergencyRoutingConfig.upsert({
          where: { hospitalId },
          create: {
            hospitalId,
            casualtyNumber: config.casualtyNumber || "",
            isVerified: config.isVerified ?? false,
            verifiedBy: config.verifiedBy || userName,
            verifiedAt: config.isVerified ? new Date() : undefined,
            fallbackNumber: config.fallbackNumber || "108",
            allowLiveTransfer: config.allowLiveTransfer ?? false,
            interruptionKeywordsMalayalam: config.interruptionKeywordsMalayalam || [],
            interruptionKeywordsEnglish: config.interruptionKeywordsEnglish || [],
            interruptionKeywordsManglish: config.interruptionKeywordsManglish || [],
            confidenceThreshold: config.confidenceThreshold ?? 0.7,
          },
          update: {
            casualtyNumber: config.casualtyNumber,
            isVerified: config.isVerified,
            verifiedBy: config.verifiedBy || userName,
            verifiedAt: config.isVerified ? new Date() : undefined,
            fallbackNumber: config.fallbackNumber,
            allowLiveTransfer: config.allowLiveTransfer,
            interruptionKeywordsMalayalam: config.interruptionKeywordsMalayalam,
            interruptionKeywordsEnglish: config.interruptionKeywordsEnglish,
            interruptionKeywordsManglish: config.interruptionKeywordsManglish,
            confidenceThreshold: config.confidenceThreshold,
          },
        });
        return updated;
      } catch (err) {
        console.warn("[IvrFlowService] DB updateEmergencyRoutingConfig failed:", err);
      }
    }

    return {
      id: `em_config_${hospitalId}`,
      hospitalId,
      casualtyNumber: config.casualtyNumber || "",
      isVerified: config.isVerified ?? false,
      verifiedBy: config.verifiedBy || userName,
      verifiedAt: config.isVerified ? new Date() : null,
      fallbackNumber: config.fallbackNumber || null,
      allowLiveTransfer: config.allowLiveTransfer ?? false,
      interruptionKeywordsMalayalam: config.interruptionKeywordsMalayalam || [],
      interruptionKeywordsEnglish: config.interruptionKeywordsEnglish || [],
      interruptionKeywordsManglish: config.interruptionKeywordsManglish || [],
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Logs an emergency trigger event.
   */
  public async logEmergencyEvent(params: {
    hospitalId: string;
    callSid: string;
    flowId: string;
    flowVersion: number;
    triggerPhrase: string;
    confidenceScore?: number;
    detectedLanguage?: string;
    targetDestination: string;
    transferOutcome?: string;
    fallbackAction?: string;
    callerNumber?: string;
  }): Promise<EmergencyEvent> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        return await prisma.emergencyEvent.create({
          data: {
            hospitalId: params.hospitalId,
            callSid: params.callSid,
            flowId: params.flowId,
            flowVersion: params.flowVersion,
            triggerPhrase: params.triggerPhrase,
            confidenceScore: params.confidenceScore ?? 1.0,
            detectedLanguage: params.detectedLanguage || "ml-IN",
            targetDestination: params.targetDestination,
            transferOutcome: params.transferOutcome || "INITIATED",
            fallbackAction: params.fallbackAction,
            callerNumber: params.callerNumber,
          },
        });
      } catch (err) {
        console.warn("[IvrFlowService] DB logEmergencyEvent failed:", err);
      }
    }

    return {
      id: `em_event_${Date.now()}`,
      hospitalId: params.hospitalId,
      callSid: params.callSid,
      flowId: params.flowId,
      flowVersion: params.flowVersion,
      triggerPhrase: params.triggerPhrase,
      confidenceScore: params.confidenceScore ?? 1.0,
      detectedLanguage: params.detectedLanguage || "ml-IN",
      targetDestination: params.targetDestination,
      transferOutcome: params.transferOutcome || "INITIATED",
      fallbackAction: params.fallbackAction || null,
      callerNumber: params.callerNumber || null,
      createdAt: new Date(),
      resolvedAt: null,
    };
  }

  /**
   * Retrieves recent emergency trigger events for a hospital.
   */
  public async getEmergencyEvents(hospitalId: string, limit = 50): Promise<EmergencyEvent[]> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        return await prisma.emergencyEvent.findMany({
          where: { hospitalId },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
      } catch (err) {
        console.warn("[IvrFlowService] DB getEmergencyEvents failed:", err);
      }
    }
    return [];
  }

  /**
   * Logs a flow audit event.
   */
  public async logAuditEvent(params: {
    hospitalId: string;
    flowId: string;
    flowVersion?: number;
    action: string;
    actor: string;
    details?: Record<string, unknown>;
  }): Promise<FlowAuditEvent> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        return await prisma.flowAuditEvent.create({
          data: {
            hospitalId: params.hospitalId,
            flowId: params.flowId,
            flowVersion: params.flowVersion,
            action: params.action,
            actor: params.actor,
            details: params.details as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        console.warn("[IvrFlowService] DB logAuditEvent failed:", err);
      }
    }

    return {
      id: `audit_${Date.now()}`,
      hospitalId: params.hospitalId,
      flowId: params.flowId,
      flowVersion: params.flowVersion ?? null,
      action: params.action,
      actor: params.actor,
      details: (params.details as unknown as Prisma.JsonValue) || null,
      createdAt: new Date(),
    };
  }

  /**
   * Retrieves audit events for a hospital flow.
   */
  public async getAuditEvents(hospitalId: string, flowId?: string): Promise<FlowAuditEvent[]> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        return await prisma.flowAuditEvent.findMany({
          where: {
            hospitalId,
            ...(flowId ? { flowId } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
      } catch (err) {
        console.warn("[IvrFlowService] DB getAuditEvents failed:", err);
      }
    }
    return [];
  }

  private mapDbRecordToFlow(r: {
    id: string;
    hospitalId: string;
    name: string;
    description: string | null;
    status: string;
    deploymentStatus: string;
    isDefault: boolean;
    currentVersion: number;
    category?: string;
    direction?: string;
    executionPriority?: number;
    triggerConditions?: unknown;
    isEnabled?: boolean;
    isTemplate?: boolean;
    templateCategory?: string | null;
    nodesJson: unknown;
    edgesJson: unknown;
    variablesJson: unknown;
    exotelAppletId: string | null;
    exotelAppletName: string | null;
    exotelEndpointUrl: string | null;
    exotelVerifiedAt: Date | null;
    lastUpdatedBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): IvrFlowData {
    return {
      id: r.id,
      hospitalId: r.hospitalId,
      name: r.name,
      description: r.description || undefined,
      status: r.status as IvrFlowData["status"],
      deploymentStatus: r.deploymentStatus as IvrFlowData["deploymentStatus"],
      isDefault: r.isDefault,
      currentVersion: r.currentVersion,
      category: (r.category as FlowCategory) || "INBOUND_RECEPTION",
      direction: (r.direction as "INBOUND" | "OUTBOUND") || "INBOUND",
      executionPriority: r.executionPriority ?? 0,
      triggerConditions: (r.triggerConditions as Record<string, unknown>) || undefined,
      isEnabled: r.isEnabled ?? true,
      isTemplate: r.isTemplate ?? false,
      templateCategory: r.templateCategory || undefined,
      nodes: (r.nodesJson as unknown as IvrFlowData["nodes"]) || [],
      edges: (r.edgesJson as unknown as IvrFlowData["edges"]) || [],
      variables: (r.variablesJson as unknown as Record<string, unknown>) || {},
      exotelMapping: r.exotelAppletId
        ? {
            appletId: r.exotelAppletId,
            appletName: r.exotelAppletName || undefined,
            endpointUrl: r.exotelEndpointUrl || undefined,
            requiredAppletType: "Voicebot Applet",
            streamingPath: "/exotel/voicebot",
            verifiedAt: r.exotelVerifiedAt ? r.exotelVerifiedAt.toISOString() : undefined,
            mappingInstructions: [],
            lastVerificationStatus: "VERIFIED",
          }
        : undefined,
      lastUpdatedBy: r.lastUpdatedBy,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}

export const ivrFlowService = new IvrFlowService();
