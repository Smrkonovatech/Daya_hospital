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
import type { Prisma } from "@prisma/client";
import {
  IvrFlowData,
  IvrFlowVersionData,
  FlowValidationResult,
  ExotelMappingGuide,
} from "@/lib/types/ivr-flow";
import { IvrFlowValidator } from "./ivr-flow-validator";
import { createDefaultHospitalFlow } from "./ivr-node-definitions";

// Fast in-memory storage fallback for unit testing and local sandboxes
const inMemoryFlows = new Map<string, IvrFlowData>();
const inMemoryVersions = new Map<string, IvrFlowVersionData[]>();
const inMemoryExecutionSessions = new Map<string, unknown>();

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
      hospitalId === "hosp_daya_thrissur" ? "0487 2475100" : "1800 123 4567"
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

    // 2. Select matching flow: prefer Exotel Applet ID match, else default flow, else first published
    let selectedFlow = exotelAppletId
      ? publishedFlows.find((f) => f.exotelMapping?.appletId === exotelAppletId)
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
      } catch (err) {
        console.warn("[IvrFlowService] DB persistExecutionSession failed:", err);
      }
    }

    inMemoryExecutionSessions.set(sessionId, {
      ...params,
      id: sessionId,
      updatedAt: new Date().toISOString(),
    });

    return sessionId;
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

  private mapDbRecordToFlow(r: {
    id: string;
    hospitalId: string;
    name: string;
    description: string | null;
    status: string;
    deploymentStatus: string;
    isDefault: boolean;
    currentVersion: number;
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
