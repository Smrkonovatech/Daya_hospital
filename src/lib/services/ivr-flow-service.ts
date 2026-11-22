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
    return [defaultFlow];
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
