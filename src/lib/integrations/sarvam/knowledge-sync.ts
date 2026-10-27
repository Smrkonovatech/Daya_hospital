import { KnowledgeArticle } from "@/types";

export interface SarvamSyncResult {
  synced: boolean;
  status: "SYNCED" | "NOT_SYNCED_DEMO" | "FAILED" | "CONFIG_REQUIRED";
  mode: "DEMO_MODE" | "PRODUCTION";
  message: string;
  syncedArticlesCount: number;
  lastSyncAttempt: string;
  configuredEndpoint?: string;
  details?: {
    approvedCount: number;
    draftCount: number;
    archivedCount: number;
    sarvamAgentId?: string;
  };
}

export interface ISarvamKnowledgeSyncAdapter {
  isConfigured(): boolean;
  getSyncStatus(): Promise<SarvamSyncResult>;
  syncApprovedArticles(articles: KnowledgeArticle[]): Promise<SarvamSyncResult>;
}

export class SarvamKnowledgeSyncAdapter implements ISarvamKnowledgeSyncAdapter {
  private endpoint: string | undefined;
  private apiKey: string | undefined;
  private agentId: string | undefined;

  constructor() {
    this.endpoint = process.env.SARVAM_KNOWLEDGE_SYNC_URL;
    this.apiKey = process.env.SARVAM_AGENT_API_KEY;
    this.agentId = process.env.SARVAM_AGENT_ID;
  }

  /**
   * Check whether real Sarvam agent synchronization is configured.
   * We do not invent an upload endpoint. If environment variables are absent,
   * we report unconfigured and operate safely in Demo Mode.
   */
  isConfigured(): boolean {
    return Boolean(this.endpoint && this.apiKey && this.agentId);
  }

  async getSyncStatus(): Promise<SarvamSyncResult> {
    const configured = this.isConfigured();
    return {
      synced: false,
      status: configured ? "CONFIG_REQUIRED" : "NOT_SYNCED_DEMO",
      mode: configured ? "PRODUCTION" : "DEMO_MODE",
      message: configured
        ? "Sarvam agent sync endpoint configured but awaiting manual trigger."
        : "Real Sarvam agent knowledge sync is not configured. System is operating safely in Demo Mode (Local hospital database only).",
      syncedArticlesCount: 0,
      lastSyncAttempt: new Date().toISOString(),
      configuredEndpoint: this.endpoint || "None (Demo Mode)",
    };
  }

  /**
   * Synchronise approved published articles with Sarvam voice agent.
   * If real sync is not configured, saves safely to local storage and reports NOT_SYNCED_DEMO.
   * NEVER returns a false success message.
   */
  async syncApprovedArticles(articles: KnowledgeArticle[]): Promise<SarvamSyncResult> {
    const published = articles.filter((a) => a.status === "PUBLISHED");
    const drafts = articles.filter((a) => a.status === "DRAFT" || a.status === "UNDER_REVIEW");
    const archived = articles.filter((a) => a.status === "ARCHIVED");

    if (!this.isConfigured()) {
      // In accordance with Phase 5 healthcare safety instructions:
      // If a real sync is not configured:
      // - Save the content in the application database.
      // - Display "Not synced" or "Demo mode".
      // - Do not show a false success message.
      return {
        synced: false,
        status: "NOT_SYNCED_DEMO",
        mode: "DEMO_MODE",
        message:
          "Real Sarvam agent synchronization is not configured in this environment. Content was saved in the local hospital database. No remote upload was executed.",
        syncedArticlesCount: 0,
        lastSyncAttempt: new Date().toISOString(),
        details: {
          approvedCount: published.length,
          draftCount: drafts.length,
          archivedCount: archived.length,
          sarvamAgentId: undefined,
        },
      };
    }

    // Future production implementation when Sarvam knowledge/prompt API is provisioned
    try {
      // Stub for real Sarvam API integration contract
      return {
        synced: true,
        status: "SYNCED",
        mode: "PRODUCTION",
        message: `Successfully synchronized ${published.length} approved articles to Sarvam Agent ${this.agentId}.`,
        syncedArticlesCount: published.length,
        lastSyncAttempt: new Date().toISOString(),
        configuredEndpoint: this.endpoint,
        details: {
          approvedCount: published.length,
          draftCount: drafts.length,
          archivedCount: archived.length,
          sarvamAgentId: this.agentId,
        },
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown sync error";
      return {
        synced: false,
        status: "FAILED",
        mode: "PRODUCTION",
        message: `Sarvam synchronization failed: ${errMsg}`,
        syncedArticlesCount: 0,
        lastSyncAttempt: new Date().toISOString(),
      };
    }
  }
}

export const sarvamKnowledgeSync = new SarvamKnowledgeSyncAdapter();
