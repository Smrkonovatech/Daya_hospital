"use client";

import * as React from "react";
import {
  BookOpen,
  Search,
  Plus,
  RefreshCw,
  History,
  Edit3,
  Check,
  AlertCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MOCK_KNOWLEDGE_ARTICLES } from "@/lib/mock-data";
import { KnowledgeArticle, KnowledgeCategory, KnowledgeStatus } from "@/types";
import { formatDateTime } from "@/lib/utils";

export default function KnowledgeBasePage() {
  const { showToast } = useToast();
  const [articles, setArticles] = React.useState<KnowledgeArticle[]>(MOCK_KNOWLEDGE_ARTICLES);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Modals
  const [editingArticle, setEditingArticle] = React.useState<KnowledgeArticle | null>(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [isNewArticle, setIsNewArticle] = React.useState(false);
  const [auditArticle, setAuditArticle] = React.useState<KnowledgeArticle | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = React.useState(false);

  // Form State
  const [formTitle, setFormTitle] = React.useState("");
  const [formTitleMalayalam, setFormTitleMalayalam] = React.useState("");
  const [formCategory, setFormCategory] = React.useState<KnowledgeCategory>("FEES_CHARGES");
  const [formSummary, setFormSummary] = React.useState("");
  const [formContent, setFormContent] = React.useState("");
  const [formContentMalayalam, setFormContentMalayalam] = React.useState("");
  const [formStatus, setFormStatus] = React.useState<KnowledgeStatus>("PUBLISHED");
  const [formAuditNote, setFormAuditNote] = React.useState("");

  const filteredArticles = React.useMemo(() => {
    return articles.filter((art) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = art.title.toLowerCase().includes(q);
        const matchesMal = art.titleMalayalam.toLowerCase().includes(q);
        const matchesContent = art.content.toLowerCase().includes(q);
        const matchesSummary = art.summary.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMal && !matchesContent && !matchesSummary) {
          return false;
        }
      }

      if (selectedCategory !== "ALL" && art.category !== selectedCategory) {
        return false;
      }

      if (selectedStatus !== "ALL" && art.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [articles, searchQuery, selectedCategory, selectedStatus]);

  const handleSyncToSarvam = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setArticles((prev) =>
        prev.map((a) => ({
          ...a,
          syncedToSarvam: true,
          lastSyncedAt: new Date().toISOString(),
        }))
      );
      showToast({
        type: "success",
        title: "Synced with Sarvam Voice Agent",
        message: "5 approved clinical articles compiled to Malayalam LLM context.",
      });
    }, 1200);
  };

  const handleOpenEdit = (article: KnowledgeArticle) => {
    setEditingArticle(article);
    setIsNewArticle(false);
    setFormTitle(article.title);
    setFormTitleMalayalam(article.titleMalayalam);
    setFormCategory(article.category);
    setFormSummary(article.summary);
    setFormContent(article.content);
    setFormContentMalayalam(article.contentMalayalam);
    setFormStatus(article.status);
    setFormAuditNote("");
    setIsEditorOpen(true);
  };

  const handleOpenNew = () => {
    setEditingArticle(null);
    setIsNewArticle(true);
    setFormTitle("");
    setFormTitleMalayalam("");
    setFormCategory("DEPARTMENTS");
    setFormSummary("");
    setFormContent("");
    setFormContentMalayalam("");
    setFormStatus("DRAFT");
    setFormAuditNote("Initial creation.");
    setIsEditorOpen(true);
  };

  const handleSaveArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formContent) {
      alert("Please fill in the title and content.");
      return;
    }

    if (isNewArticle) {
      const newArt: KnowledgeArticle = {
        id: `kb_${Date.now().toString().slice(-4)}`,
        title: formTitle,
        titleMalayalam: formTitleMalayalam || formTitle,
        category: formCategory,
        summary: formSummary,
        content: formContent,
        contentMalayalam: formContentMalayalam,
        status: formStatus,
        version: 1,
        lastUpdatedBy: "Dr. Anjali Menon",
        updatedAt: new Date().toISOString(),
        syncedToSarvam: false,
        auditHistory: [
          {
            version: 1,
            updatedBy: "Dr. Anjali Menon",
            timestamp: new Date().toISOString(),
            summaryOfChanges: formAuditNote || "Created approved hospital guidance.",
          },
        ],
      };
      setArticles([newArt, ...articles]);
      showToast({
        type: "success",
        title: "Article Created",
        message: `Version 1 saved. Pending sync to Sarvam AI.`,
      });
    } else if (editingArticle) {
      const nextVersion = editingArticle.version + 1;
      const updated: KnowledgeArticle = {
        ...editingArticle,
        title: formTitle,
        titleMalayalam: formTitleMalayalam,
        category: formCategory,
        summary: formSummary,
        content: formContent,
        contentMalayalam: formContentMalayalam,
        status: formStatus,
        version: nextVersion,
        lastUpdatedBy: "Dr. Anjali Menon",
        updatedAt: new Date().toISOString(),
        syncedToSarvam: false,
        auditHistory: [
          {
            version: nextVersion,
            updatedBy: "Dr. Anjali Menon",
            timestamp: new Date().toISOString(),
            summaryOfChanges:
              formAuditNote || `Version ${nextVersion} content revision.`,
          },
          ...editingArticle.auditHistory,
        ],
      };
      setArticles((prev) =>
        prev.map((a) => (a.id === editingArticle.id ? updated : a))
      );
      showToast({
        type: "info",
        title: "Article Updated",
        message: `Version ${nextVersion} saved with audit note.`,
      });
    }

    setIsEditorOpen(false);
  };

  const handleOpenAudit = (article: KnowledgeArticle) => {
    setAuditArticle(article);
    setIsAuditModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Hospital Approved Knowledge Base"
          description="Authorized clinical timetables, consultation fees, IP policies, and Malayalam pronunciation guidelines used for Sarvam AI grounding."
          badge={
            <Badge variant="teal" size="sm">
              Sarvam Grounding Source
            </Badge>
          }
          breadcrumbs={[
            { label: "Overview", href: "/overview" },
            { label: "Knowledge Base" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSyncToSarvam}
                disabled={isSyncing}
                className="gap-2 text-xs bg-[#0C5DB8]"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />
                <span>{isSyncing ? "Syncing..." : "Sync to AI Voice Agent"}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenNew}
                className="gap-1.5 text-xs text-[#0C5DB8]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Article</span>
              </Button>
            </div>
          }
        />

        {/* Search & Category Filter */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search knowledge base in English or മലയാളം..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Status Selector */}
              <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
                <span className="text-slate-500">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pt-1 text-xs border-t border-slate-100">
              {[
                { id: "ALL", label: "All Topics" },
                { id: "DOCTORS_SCHEDULE", label: "Doctor Schedules" },
                { id: "FEES_CHARGES", label: "OPD & Doctor Fees" },
                { id: "HOSPITAL_POLICIES", label: "Visiting & IP Policies" },
                { id: "INSURANCE_TPA", label: "Insurance & Ayushman" },
                { id: "EMERGENCY_AMBULANCE", label: "Emergency & Casualty" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-md px-3 py-1 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-[#0C5DB8] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArticles.map((article) => (
            <Card
              key={article.id}
              className="flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Badge variant="teal" size="sm">
                      {article.category.replace(/_/g, " ")}
                    </Badge>
                    <CardTitle className="text-sm font-semibold text-slate-900 mt-1 leading-snug">
                      {article.title}
                    </CardTitle>
                    <p className="text-xs font-medium text-[#0E7A71]">
                      {article.titleMalayalam}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                      v{article.version}
                    </span>
                    <Badge
                      variant={article.status === "PUBLISHED" ? "success" : "warning"}
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

                {/* Excerpt */}
                <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-700 font-mono line-clamp-3 leading-relaxed border border-slate-100">
                  {article.content}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {article.syncedToSarvam ? (
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <Check className="h-3 w-3" />
                        Synced to Voice
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-700 font-medium">
                        <AlertCircle className="h-3 w-3" />
                        Pending Sync
                      </span>
                    )}
                  </div>
                  <span>Updated {formatDateTime(article.updatedAt)}</span>
                </div>
              </CardContent>

              {/* Action buttons */}
              <div className="flex items-center justify-between p-4 pt-0 border-t border-slate-100 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenAudit(article)}
                  className="h-7 text-xs text-slate-600 gap-1.5"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>Audit History ({article.auditHistory.length})</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEdit(article)}
                  className="h-7 text-xs text-[#0C5DB8] gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Content</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Article Editor Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        maxWidth="2xl"
        title={
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#0C5DB8]" />
            <span>
              {isNewArticle
                ? "Create Approved Hospital Guidance"
                : `Edit Article: ${editingArticle?.title}`}
            </span>
          </div>
        }
        description="All changes are version-controlled and verified before updating the Sarvam Malayalam AI calling prompt context"
      >
        <form onSubmit={handleSaveArticle} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Article Title (English) *
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Doctor Consultation & Registration Fees"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Title in Malayalam (മലയാളം)
              </label>
              <Input
                value={formTitleMalayalam}
                onChange={(e) => setFormTitleMalayalam(e.target.value)}
                placeholder="e.g. ഒപി രജിസ്ട്രേഷനും ഡോക്ടർ കൺസൾട്ടേഷൻ ഫീസും"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Hospital Category *
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as KnowledgeCategory)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
              >
                <option value="FEES_CHARGES">Fees & Registration Charges</option>
                <option value="DOCTORS_SCHEDULE">Doctors OPD Schedule</option>
                <option value="HOSPITAL_POLICIES">Hospital & Visiting Policies</option>
                <option value="INSURANCE_TPA">Insurance & TPA Desks</option>
                <option value="EMERGENCY_AMBULANCE">Emergency & Ambulance</option>
                <option value="DEPARTMENTS">Departments & Specialities</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Publication Status *
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as KnowledgeStatus)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
              >
                <option value="PUBLISHED">Published (Grounding Active)</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Short Summary
            </label>
            <Input
              value={formSummary}
              onChange={(e) => setFormSummary(e.target.value)}
              placeholder="Brief summary for quick staff review"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Approved Content (English Guidelines) *
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={4}
              required
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
              placeholder="Enter exact hospital policies, timing, and fee structures..."
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Malayalam Voice Phrasing / Malayalam Content (മലയാളം)
            </label>
            <textarea
              value={formContentMalayalam}
              onChange={(e) => setFormContentMalayalam(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
              placeholder="Enter Malayalam pronunciation and spoken script for Sarvam AI..."
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Mandatory Audit Note (Summary of changes for clinical record) *
            </label>
            <Input
              value={formAuditNote}
              onChange={(e) => setFormAuditNote(e.target.value)}
              placeholder="e.g. Revised super-speciality fee as per board circular #2026/18"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditorOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              className="bg-[#0C5DB8]"
            >
              Save & Create Version
            </Button>
          </div>
        </form>
      </Modal>

      {/* Audit History Modal */}
      {auditArticle && (
        <Modal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          maxWidth="lg"
          title={
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#0C5DB8]" />
              <span>Version Audit Trail: {auditArticle.title}</span>
            </div>
          }
          description="Regulatory change log and revision provenance"
        >
          <div className="space-y-3 text-xs">
            {auditArticle.auditHistory.map((item, idx) => (
              <div
                key={idx}
                className="relative flex gap-3 pb-3 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8F2FC] text-[#0C5DB8] font-bold text-xs shrink-0">
                  v{item.version}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {item.updatedBy}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDateTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-snug">
                    {item.summaryOfChanges}
                  </p>
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAuditModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
