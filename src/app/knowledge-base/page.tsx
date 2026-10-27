"use client";

import * as React from "react";
import {
  BookOpen,
  Search,
  Plus,
  History,
  Edit3,
  Check,
  AlertCircle,
  Eye,
  Send,
  Archive,
  FileText,
  Clock,
  User,
  Filter,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { KnowledgeArticle } from "@/types";
import { formatDateTime } from "@/lib/utils";
import {
  KNOWLEDGE_CATEGORY_CONFIG,
  KnowledgeFormData,
} from "@/lib/validations/knowledge-schema";
import { HealthcareSafeguardsNotice } from "@/components/knowledge/healthcare-safeguards-notice";
import { KnowledgeEditorModal } from "@/components/knowledge/knowledge-editor-modal";
import { KnowledgePreviewModal } from "@/components/knowledge/knowledge-preview-modal";
import { KnowledgePublishModal } from "@/components/knowledge/knowledge-publish-modal";
import { KnowledgeAuditModal } from "@/components/knowledge/knowledge-audit-modal";
import { SarvamSyncStatusCard } from "@/components/knowledge/sarvam-sync-status-card";
import { SarvamSyncResult } from "@/lib/integrations/sarvam/knowledge-sync";
import { useAuth } from "@/components/auth/auth-provider";

export default function KnowledgeBasePage() {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();

  const [articles, setArticles] = React.useState<KnowledgeArticle[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [selectedSyncStatus, setSelectedSyncStatus] = React.useState<string>("ALL");

  // Sync state
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<SarvamSyncResult | null>(null);

  // Modals state
  const [editorArticle, setEditorArticle] = React.useState<KnowledgeArticle | null>(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [previewData, setPreviewData] = React.useState<KnowledgeFormData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const [publishArticle, setPublishArticle] = React.useState<KnowledgeArticle | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);

  const [auditArticle, setAuditArticle] = React.useState<KnowledgeArticle | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = React.useState(false);

  // Reload articles helper
  const reloadArticles = React.useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setArticles(json.data);
      }
    } catch (err) {
      console.error("Failed to reload knowledge articles:", err);
    }
  }, []);

  // Fetch articles on mount
  React.useEffect(() => {
    let isSubscribed = true;
    fetch("/api/knowledge")
      .then((res) => res.json())
      .then((json) => {
        if (isSubscribed && json.success && Array.isArray(json.data)) {
          setArticles(json.data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          console.error("Failed to fetch knowledge articles:", err);
          setIsLoading(false);
        }
      });
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Handle Sarvam Voice Sync Check
  const handleSyncWithSarvam = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/knowledge/sync", { method: "POST" });
      const json = await res.json();

      if (json.success && json.syncResult) {
        setSyncResult(json.syncResult);
        await reloadArticles();

        if (json.syncResult.mode === "DEMO_MODE") {
          showToast({
            type: "info",
            title: "Demo Mode: Local Save Only",
            message:
              "Sarvam AI knowledge sync endpoint is unconfigured. Content is safely held in local hospital DB (Demo mode). No false success issued.",
          });
        } else {
          showToast({
            type: "success",
            title: "Sarvam Voice Sync Complete",
            message: json.syncResult.message,
          });
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
      showToast({
        type: "error",
        title: "Sync Error",
        message: "Failed to invoke Sarvam sync adapter.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtered Articles
  const filteredArticles = React.useMemo(() => {
    return articles.filter((art) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = art.title.toLowerCase().includes(q);
        const matchesMal = art.titleMalayalam?.toLowerCase().includes(q);
        const matchesContent = art.content.toLowerCase().includes(q);
        const matchesSummary = art.summary.toLowerCase().includes(q);
        const matchesSource = art.sourceReference?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMal && !matchesContent && !matchesSummary && !matchesSource) {
          return false;
        }
      }

      if (selectedCategory !== "ALL" && art.category !== selectedCategory) {
        return false;
      }

      if (selectedStatus !== "ALL" && art.status !== selectedStatus) {
        return false;
      }

      if (selectedSyncStatus !== "ALL") {
        if (selectedSyncStatus === "SYNCED" && !art.syncedToSarvam) return false;
        if (selectedSyncStatus === "NOT_SYNCED" && art.syncedToSarvam) return false;
      }

      return true;
    });
  }, [articles, searchQuery, selectedCategory, selectedStatus, selectedSyncStatus]);

  // Open Editor for New Article
  const handleOpenNew = () => {
    setEditorArticle(null);
    setIsEditorOpen(true);
  };

  // Open Editor for Existing Article
  const handleOpenEdit = (article: KnowledgeArticle) => {
    setEditorArticle(article);
    setIsEditorOpen(true);
  };

  // Save Draft Submission
  const handleSaveDraft = async (data: KnowledgeFormData) => {
    try {
      setIsSaving(true);
      if (!editorArticle) {
        // Create new article
        const res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            authorName: "Hospital Content Editor",
          }),
        });
        const json = await res.json();
        if (json.success) {
          showToast({
            type: "success",
            title: "Draft Article Created",
            message: `New article "${data.title}" saved. Version 1 ready for review.`,
          });
          await reloadArticles();
          setIsEditorOpen(false);
        } else {
          throw new Error(json.error || "Failed to create article");
        }
      } else {
        // Update existing article draft
        const res = await fetch(`/api/knowledge/${editorArticle.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            authorName: "Hospital Content Editor",
          }),
        });
        const json = await res.json();
        if (json.success) {
          showToast({
            type: "info",
            title: "Draft Revision Saved",
            message:
              editorArticle.status === "PUBLISHED"
                ? "Revisions saved safely as draft. Approved live version callers hear remains active until publication."
                : "Draft revisions saved successfully.",
          });
          await reloadArticles();
          setIsEditorOpen(false);
        } else {
          throw new Error(json.error || "Failed to update article");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      showToast({ type: "error", title: "Save Failed", message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Publish confirmation from Editor
  const handleTriggerPublishFromEditor = (data: KnowledgeFormData) => {
    // If article exists, use it; if new, we first save draft then publish
    if (editorArticle) {
      setPublishArticle(editorArticle);
      setIsPublishModalOpen(true);
    } else {
      // Save draft first then open publish modal
      handleSaveDraft(data).then(() => {
        showToast({
          type: "info",
          title: "Draft Saved",
          message: "Please click 'Publish Live' on the created article to authorise publication.",
        });
      });
    }
  };

  // Open Publish Modal directly from card
  const handleOpenPublish = (article: KnowledgeArticle) => {
    setPublishArticle(article);
    setIsPublishModalOpen(true);
  };

  // Confirm and Execute Publication
  const handleConfirmPublish = async (authorName: string, changeNote: string) => {
    if (!publishArticle) return;
    try {
      setIsPublishing(true);
      const res = await fetch(`/api/knowledge/${publishArticle.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, changeNote }),
      });
      const json = await res.json();
      if (json.success) {
        showToast({
          type: "success",
          title: "Published to Live Voice Grounding",
          message: `Article published as Version v${json.data.version}. Active for Malayalam AI caller responses.`,
        });
        await reloadArticles();
        setIsPublishModalOpen(false);
        setIsEditorOpen(false);
      } else {
        throw new Error(json.error || "Publication failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Publication failed";
      showToast({ type: "error", title: "Publication Failed", message: msg });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle Archive Action
  const handleArchive = async (article: KnowledgeArticle) => {
    if (
      !confirm(
        `Are you sure you want to archive "${article.title}"? It will be removed from active AI voice grounding.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/knowledge/${article.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "Hospital Content Editor",
          reason: "Archived from active voice grounding by staff.",
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast({
          type: "info",
          title: "Article Archived",
          message: `"${article.title}" has been archived and removed from voice grounding.`,
        });
        await reloadArticles();
      }
    } catch (err) {
      console.error("Archive error:", err);
      showToast({
        type: "error",
        title: "Archive Failed",
        message: "Failed to archive article.",
      });
    }
  };

  // Handle Preview
  const handleOpenPreview = (data: KnowledgeFormData) => {
    setPreviewData(data);
    setIsPreviewOpen(true);
  };

  const handleOpenPreviewFromArticle = (article: KnowledgeArticle) => {
    setPreviewData({
      title: article.title,
      titleMalayalam: article.titleMalayalam,
      category: article.category,
      summary: article.summary,
      content: article.content,
      contentMalayalam: article.contentMalayalam || "",
      sourceReference: article.sourceReference || "",
      internalNotes: article.internalNotes || "",
      status: article.status,
    });
    setIsPreviewOpen(true);
  };

  // Handle Audit History
  const handleOpenAudit = (article: KnowledgeArticle) => {
    setAuditArticle(article);
    setIsAuditModalOpen(true);
  };

  const totalPublished = articles.filter((a) => a.status === "PUBLISHED").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Hospital Knowledge Base & AI Voice Grounding"
          description="Approved hospital information, OPD consultation fees, visiting policies, and Malayalam pronunciation guidelines used by the Sarvam AI voice assistant."
          badge={
            <Badge variant="teal" size="sm">
              Authoritative Grounding Source
            </Badge>
          }
          breadcrumbs={[
            { label: "Overview", href: "/overview" },
            { label: "Knowledge Base" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenNew}
                className="gap-1.5 text-xs text-[#0C5DB8] border-blue-200 hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Article</span>
              </Button>
            </div>
          }
        />

        {/* 1. Healthcare Safeguards Notice Banner */}
        <HealthcareSafeguardsNotice />

        {/* 2. Sarvam Voice Sync Status Card (Decoupled sync, avoiding false success) */}
        <SarvamSyncStatusCard
          syncResult={syncResult}
          isSyncing={isSyncing}
          onSync={handleSyncWithSarvam}
          totalApproved={totalPublished}
        />

        {/* 3. Search and Multi-Category Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search knowledge base in English, മലയാളം, or circular reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Status Selector */}
              <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
                <span className="text-slate-500 shrink-0">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                >
                  <option value="ALL">All Statuses ({articles.length})</option>
                  <option value="PUBLISHED">
                    Published ({articles.filter((a) => a.status === "PUBLISHED").length})
                  </option>
                  <option value="DRAFT">
                    Draft ({articles.filter((a) => a.status === "DRAFT").length})
                  </option>
                  <option value="ARCHIVED">
                    Archived ({articles.filter((a) => a.status === "ARCHIVED").length})
                  </option>
                </select>
              </div>

              {/* Sync Filter */}
              <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
                <span className="text-slate-500 shrink-0">Sync:</span>
                <select
                  value={selectedSyncStatus}
                  onChange={(e) => setSelectedSyncStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                >
                  <option value="ALL">All Modes</option>
                  <option value="NOT_SYNCED">Demo Mode / Local Only</option>
                  <option value="SYNCED">Synced to Voice</option>
                </select>
              </div>
            </div>

            {/* 8 Categories Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 text-xs border-t border-slate-100 pb-1">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1 mr-1">
                <Filter className="h-3 w-3" /> Categories:
              </span>
              {[
                { id: "ALL", label: "All Topics" },
                { id: "HOSPITAL_INFORMATION", label: "Hospital Information" },
                { id: "DEPARTMENTS_SERVICES", label: "Departments & Services" },
                { id: "DOCTOR_INFORMATION", label: "Doctor Information" },
                { id: "CONSULTATION_FEES", label: "Consultation & Fees" },
                { id: "TIMINGS_LOCATIONS", label: "Timings & Locations" },
                { id: "APPOINTMENT_POLICIES", label: "Appointment Policies" },
                { id: "FAQS", label: "Patient FAQs" },
                { id: "CONTACT_ESCALATION", label: "Contact & Escalation" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap cursor-pointer text-[11px] ${
                    selectedCategory === cat.id
                      ? "bg-[#0C5DB8] text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Articles Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading knowledge articles...
          </div>
        ) : filteredArticles.length === 0 ? (
          <Card className="p-8 text-center space-y-2">
            <BookOpen className="h-8 w-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-700">No matching articles found</h4>
            <p className="text-xs text-slate-500">
              Try adjusting your search criteria or category filter.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("ALL");
                setSelectedStatus("ALL");
                setSelectedSyncStatus("ALL");
              }}
              className="mt-2 text-xs"
            >
              Reset Filters
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((article) => {
              const catConfig = KNOWLEDGE_CATEGORY_CONFIG[article.category] || {
                label: article.category,
                labelMalayalam: "",
                badgeColor: "bg-slate-100 text-slate-700",
              };

              return (
                <Card
                  key={article.id}
                  className="flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs relative"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${catConfig.badgeColor}`}
                          >
                            {catConfig.label}
                          </span>

                          {article.isDemoData && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                              Demo Data
                            </span>
                          )}

                          {article.hasUnpublishedChanges && (
                            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200 animate-pulse">
                              Draft Revision Pending
                            </span>
                          )}
                        </div>

                        <CardTitle className="text-sm font-semibold text-slate-900 mt-1 leading-snug">
                          {article.title}
                        </CardTitle>
                        {article.titleMalayalam && (
                          <p className="text-xs font-medium text-[#0E7A71]">
                            {article.titleMalayalam}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          v{article.version}
                        </span>
                        <Badge
                          variant={
                            article.status === "PUBLISHED"
                              ? "success"
                              : article.status === "DRAFT"
                              ? "warning"
                              : "secondary"
                          }
                          size="sm"
                        >
                          {article.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {article.summary}
                    </p>

                    {/* Excerpt / Spoken guidelines snippet */}
                    <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-700 font-mono line-clamp-3 leading-relaxed border border-slate-100">
                      {article.content}
                    </div>

                    {/* Source reference if present */}
                    {article.sourceReference && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <span>Source: {article.sourceReference}</span>
                      </div>
                    )}

                    {/* Metadata line: Updated and Published stamps */}
                    <div className="flex flex-col gap-1 text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {article.syncedToSarvam ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-medium">
                              <Check className="h-3 w-3" />
                              Synced to Voice
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-700 font-medium">
                              <AlertCircle className="h-3 w-3" />
                              Demo Mode (Not Synced)
                            </span>
                          )}
                        </div>

                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{article.lastUpdatedBy}</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Updated {formatDateTime(article.updatedAt)}</span>
                        </span>
                        {article.lastPublishedAt ? (
                          <span className="text-emerald-700">
                            Live v{article.version} ({formatDateTime(article.lastPublishedAt)})
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">Draft — Not published</span>
                        )}
                      </div>
                    </div>
                  </CardContent>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between p-3.5 pt-2 border-t border-slate-100 mt-2 bg-slate-50/50 rounded-b-xl gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAudit(article)}
                        className="h-7 text-xs text-slate-600 gap-1 px-2"
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>Audit ({article.auditHistory.length})</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenPreviewFromArticle(article)}
                        className="h-7 text-xs text-slate-600 gap-1 px-2"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Preview</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {article.status !== "ARCHIVED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(article)}
                          className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          <span>Archive</span>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(article)}
                        className="h-7 text-xs text-[#0C5DB8] border-blue-200 hover:bg-blue-50 gap-1 px-2.5"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </Button>

                      {/* Explicit Publish Action Button */}
                      {(article.status === "DRAFT" || article.hasUnpublishedChanges) && (
                        isAdmin ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleOpenPublish(article)}
                            className="h-7 text-xs bg-[#0C5DB8] hover:bg-[#0A4D98] text-white gap-1 px-2.5"
                          >
                            <Send className="h-3 w-3" />
                            <span>Publish</span>
                          </Button>
                        ) : (
                          <span
                            className="rounded bg-slate-100 border border-slate-200 px-2 py-1 text-[10px] text-slate-500 font-medium shrink-0 cursor-not-allowed"
                            title="Only Hospital Administrators can publish approved knowledge live"
                          >
                            Publish (Admin Only)
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Modal with Zod & React Hook Form */}
      <KnowledgeEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        article={editorArticle}
        onSaveDraft={handleSaveDraft}
        onTriggerPublish={handleTriggerPublishFromEditor}
        onPreview={handleOpenPreview}
        isSaving={isSaving}
      />

      {/* Preview Modal */}
      {previewData && (
        <KnowledgePreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          data={previewData}
        />
      )}

      {/* Authorized Publication Modal */}
      <KnowledgePublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        article={publishArticle}
        onConfirmPublish={handleConfirmPublish}
        isPublishing={isPublishing}
      />

      {/* Audit History Modal */}
      <KnowledgeAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        article={auditArticle}
      />
    </DashboardLayout>
  );
}
