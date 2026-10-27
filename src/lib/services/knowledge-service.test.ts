import { describe, it, expect, beforeEach } from "vitest";
import { knowledgeService } from "./knowledge-service";

describe("KnowledgeService (Phase 5 - Knowledge Base Management)", () => {
  beforeEach(() => {
    knowledgeService.resetToMockData();
  });

  it("retrieves articles matching all 8 healthcare categories", () => {
    const articles = knowledgeService.getArticles();
    expect(articles.length).toBeGreaterThanOrEqual(8);

    const categories = new Set(articles.map((a) => a.category));
    expect(categories.has("HOSPITAL_INFORMATION")).toBe(true);
    expect(categories.has("DEPARTMENTS_SERVICES")).toBe(true);
    expect(categories.has("DOCTOR_INFORMATION")).toBe(true);
    expect(categories.has("CONSULTATION_FEES")).toBe(true);
    expect(categories.has("TIMINGS_LOCATIONS")).toBe(true);
    expect(categories.has("APPOINTMENT_POLICIES")).toBe(true);
    expect(categories.has("FAQS")).toBe(true);
    expect(categories.has("CONTACT_ESCALATION")).toBe(true);
  });

  it("filters articles by category and status", () => {
    const feeArticles = knowledgeService.getArticles({
      category: "CONSULTATION_FEES",
    });
    expect(feeArticles.length).toBe(1);
    expect(feeArticles[0].id).toBe("kb_01");

    const draftArticles = knowledgeService.getArticles({ status: "DRAFT" });
    expect(draftArticles.some((a) => a.status === "DRAFT")).toBe(true);

    const archivedArticles = knowledgeService.getArticles({ status: "ARCHIVED" });
    expect(archivedArticles.length).toBe(1);
    expect(archivedArticles[0].id).toBe("kb_09");
  });

  it("searches bilingual titles and content", () => {
    const searchEng = knowledgeService.getArticles({ query: "Cardiology" });
    expect(searchEng.length).toBeGreaterThan(0);

    const searchMal = knowledgeService.getArticles({ query: "രജിസ്ട്രേഷൻ" });
    expect(searchMal.length).toBeGreaterThan(0);
  });

  it("creates a new draft article with audit entry", () => {
    const created = knowledgeService.createArticle(
      {
        title: "Ayurveda Wellness Wing Protocol",
        titleMalayalam: "ആയുർവേദ വിഭാഗം",
        category: "DEPARTMENTS_SERVICES",
        summary: "Traditional ayurvedic wellness treatments available at Annex Block.",
        content: "OP consultation available 9:00 AM - 1:00 PM on weekdays.",
        sourceReference: "Admin Circular #2026/22",
        internalNotes: "Initial draft creation for upcoming wellness centre.",
        status: "DRAFT",
      },
      "Dr. Anjali Menon"
    );

    expect(created.id).toBeDefined();
    expect(created.version).toBe(1);
    expect(created.status).toBe("DRAFT");
    expect(created.auditHistory.length).toBe(1);
    expect(created.auditHistory[0].action).toBe("CREATED");
    expect(created.auditHistory[0].summaryOfChanges).toContain("wellness centre");
  });

  it("ensures publication safety: editing a published article does NOT overwrite live approved content silently", () => {
    const original = knowledgeService.getArticleById("kb_01")!;
    expect(original.status).toBe("PUBLISHED");
    const originalPublishedContent = original.publishedContent;

    // Save a draft revision
    const updated = knowledgeService.updateDraft(
      "kb_01",
      {
        content: "REVISED DRAFT CONTENT: Registration is now ₹150 (Pending Approval).",
        internalNotes: "Proposed revision to OP registration fee.",
      },
      "Content Editor Staff"
    );

    expect(updated.content).toBe("REVISED DRAFT CONTENT: Registration is now ₹150 (Pending Approval).");
    // CRITICAL: Live publishedContent must NOT be overwritten!
    expect(updated.publishedContent).toBe(originalPublishedContent);
    expect(updated.hasUnpublishedChanges).toBe(true);
    expect(updated.version).toBe(original.version); // Version doesn't increment until published
    expect(updated.auditHistory[0].action).toBe("EDITED_DRAFT");
  });

  it("promotes draft to live published version upon authorized publication", () => {
    const original = knowledgeService.getArticleById("kb_01")!;
    const initialVersion = original.version;

    knowledgeService.updateDraft("kb_01", {
      content: "Approved new content guidelines for Daya Hospital.",
      internalNotes: "Updated content waiting for review.",
    });

    const published = knowledgeService.publishArticle(
      "kb_01",
      "Dr. Anjali Menon (Medical Supt.)",
      "Authorized Board approval #2026-B"
    );

    expect(published.status).toBe("PUBLISHED");
    expect(published.version).toBe(initialVersion + 1);
    expect(published.publishedContent).toBe("Approved new content guidelines for Daya Hospital.");
    expect(published.hasUnpublishedChanges).toBe(false);
    expect(published.lastPublishedAt).toBeDefined();
    expect(published.lastPublishedBy).toContain("Dr. Anjali Menon");
    expect(published.auditHistory[0].action).toBe("PUBLISHED");
    expect(published.auditHistory[0].summaryOfChanges).toContain("Authorized Board approval #2026-B");
  });

  it("archives an article safely with audit record", () => {
    const archived = knowledgeService.archiveArticle(
      "kb_02",
      "Hospital Admin",
      "Relocating department to new building block."
    );

    expect(archived.status).toBe("ARCHIVED");
    expect(archived.auditHistory[0].action).toBe("ARCHIVED");
    expect(archived.auditHistory[0].summaryOfChanges).toContain("Relocating department");
  });

  it("safely handles Sarvam sync when real sync is not configured (Demo Mode)", async () => {
    const syncResult = await knowledgeService.syncWithSarvam();

    // Verify Healthcare safeguard: Never show false success!
    expect(syncResult.synced).toBe(false);
    expect(syncResult.status).toBe("NOT_SYNCED_DEMO");
    expect(syncResult.mode).toBe("DEMO_MODE");
    expect(syncResult.message).toContain("saved in the local hospital database");

    const articles = knowledgeService.getArticles();
    expect(articles[0].syncStatus).toBe("NOT_SYNCED_DEMO");
  });
});
