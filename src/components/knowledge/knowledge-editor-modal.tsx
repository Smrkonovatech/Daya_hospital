"use client";

import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, AlertCircle, Save, Eye, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  knowledgeFormSchema,
  KnowledgeFormData,
  CATEGORY_OPTIONS,
} from "@/lib/validations/knowledge-schema";
import { KnowledgeArticle } from "@/types";

interface KnowledgeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: KnowledgeArticle | null;
  onSaveDraft: (data: KnowledgeFormData) => Promise<void>;
  onTriggerPublish: (data: KnowledgeFormData) => void;
  onPreview: (data: KnowledgeFormData) => void;
  isSaving: boolean;
}

interface FormContentProps {
  article: KnowledgeArticle | null;
  onClose: () => void;
  onSaveDraft: (data: KnowledgeFormData) => Promise<void>;
  onTriggerPublish: (data: KnowledgeFormData) => void;
  onPreview: (data: KnowledgeFormData) => void;
  isSaving: boolean;
}

function KnowledgeEditorModalForm({
  article,
  onClose,
  onSaveDraft,
  onTriggerPublish,
  onPreview,
  isSaving,
}: FormContentProps) {
  const isNew = !article;

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<KnowledgeFormData>({
    resolver: zodResolver(knowledgeFormSchema) as unknown as Resolver<KnowledgeFormData>,
    defaultValues: {
      title: article?.title || "",
      titleMalayalam: article?.titleMalayalam || "",
      category: article?.category || "HOSPITAL_INFORMATION",
      summary: article?.summary || "",
      content: article?.content || "",
      contentMalayalam: article?.contentMalayalam || "",
      sourceReference: article?.sourceReference || "",
      internalNotes: isNew ? "Initial article creation." : "",
      status: article?.status || "DRAFT",
    },
  });

  const handleDraftSubmit = handleSubmit(async (data) => {
    await onSaveDraft(data);
  });

  const handlePublishSubmit = handleSubmit((data) => {
    onTriggerPublish(data);
  });

  const handlePreviewClick = () => {
    onPreview(getValues());
  };

  return (
    <form className="space-y-4 text-xs">
      {/* Healthcare Safeguard Reminder */}
      {article?.status === "PUBLISHED" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-[11px] text-amber-900">
            <span className="font-semibold">Publication Safety Active:</span>
            <p>
              This article is currently <strong>Published (Live v{article.version})</strong>. Saving as draft will safely retain your revisions without silently replacing the live approved content callers hear. To update live caller grounding, an authorized Publish action is required.
            </p>
          </div>
        </div>
      )}

      {/* Title row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="font-semibold text-slate-800 block mb-1">
            Article Title (English) <span className="text-red-500">*</span>
          </label>
          <Input
            {...register("title")}
            placeholder="e.g. Doctor Consultation & Registration Fees"
            className={errors.title ? "border-red-400 focus:ring-red-400" : ""}
          />
          {errors.title && (
            <p className="text-red-500 text-[11px] mt-1">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="font-semibold text-slate-800 block mb-1">
            Title in Malayalam (മലയാളം)
          </label>
          <Input
            {...register("titleMalayalam")}
            placeholder="e.g. ഒപി രജിസ്ട്രേഷനും ഡോക്ടർ കൺസൾട്ടേഷൻ ഫീസും"
          />
          {errors.titleMalayalam && (
            <p className="text-red-500 text-[11px] mt-1">{errors.titleMalayalam.message}</p>
          )}
        </div>
      </div>

      {/* Category & Status row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="font-semibold text-slate-800 block mb-1">
            Approved Category <span className="text-red-500">*</span>
          </label>
          <select
            {...register("category")}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
          >
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="text-red-500 text-[11px] mt-1">{errors.category.message}</p>
          )}
        </div>

        <div>
          <label className="font-semibold text-slate-800 block mb-1">
            Source / Official Reference (Optional)
          </label>
          <Input
            {...register("sourceReference")}
            placeholder="e.g. Management Circular #2026/18 or NABH Manual"
          />
          {errors.sourceReference && (
            <p className="text-red-500 text-[11px] mt-1">{errors.sourceReference.message}</p>
          )}
        </div>
      </div>

      {/* Short Summary */}
      <div>
        <label className="font-semibold text-slate-800 block mb-1">
          Short Summary (Clinical indexing) <span className="text-red-500">*</span>
        </label>
        <Input
          {...register("summary")}
          placeholder="Brief 1-2 sentence description for staff search and AI intent matching"
          className={errors.summary ? "border-red-400 focus:ring-red-400" : ""}
        />
        {errors.summary && (
          <p className="text-red-500 text-[11px] mt-1">{errors.summary.message}</p>
        )}
      </div>

      {/* Approved Content (English) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="font-semibold text-slate-800">
            Approved Clinical / Hospital Information (English) <span className="text-red-500">*</span>
          </label>
          <span className="text-[10px] text-slate-400">Authoritative facts for AI grounding</span>
        </div>
        <textarea
          {...register("content")}
          rows={5}
          className={`w-full rounded-lg border bg-white p-2.5 font-mono text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8] ${
            errors.content ? "border-red-400 focus:ring-red-400" : "border-slate-200"
          }`}
          placeholder="Enter exact hospital tariffs, visiting times, emergency extensions, or department rosters..."
        />
        {errors.content && (
          <p className="text-red-500 text-[11px] mt-1">{errors.content.message}</p>
        )}
      </div>

      {/* Malayalam Phrasing Script */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="font-semibold text-slate-800">
            Malayalam Voice Phrasing / Spoken Script (മലയാളം)
          </label>
          <span className="text-[10px] text-[#0E7A71]">Spoken dialect & pronunciation instructions</span>
        </div>
        <textarea
          {...register("contentMalayalam")}
          rows={3}
          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0C5DB8]"
          placeholder="Enter approved Malayalam conversational phrasing for the Smrko Voice model..."
        />
      </div>

      {/* Mandatory Internal Audit / Change Note */}
      <div>
        <label className="font-semibold text-slate-800 block mb-1">
          Internal Change & Audit Note <span className="text-red-500">*</span>
        </label>
        <Input
          {...register("internalNotes")}
          placeholder="e.g. Revised OPD consultation charges as per medical superintendent order"
          className={errors.internalNotes ? "border-red-400 focus:ring-red-400" : ""}
        />
        <span className="text-[10px] text-slate-500 mt-0.5 block">
          Required for hospital audit trail and version provenance.
        </span>
        {errors.internalNotes && (
          <p className="text-red-500 text-[11px] mt-1">{errors.internalNotes.message}</p>
        )}
      </div>

      {/* Modal Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handlePreviewClick}
          className="gap-1.5 text-xs text-slate-600 hover:text-slate-900 w-full sm:w-auto cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Preview Formatted Grounding</span>
        </Button>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDraftSubmit}
            disabled={isSaving}
            className="gap-1.5 text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Save className="h-3.5 w-3.5 text-slate-500" />
            <span>{isSaving ? "Saving..." : "Save Draft Revision"}</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handlePublishSubmit}
            disabled={isSaving}
            className="gap-1.5 text-xs bg-[#0C5DB8] hover:bg-[#0A4D98] text-white"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Publish Live...</span>
          </Button>
        </div>
      </div>
    </form>
  );
}

export function KnowledgeEditorModal({
  isOpen,
  onClose,
  article,
  onSaveDraft,
  onTriggerPublish,
  onPreview,
  isSaving,
}: KnowledgeEditorModalProps) {
  if (!isOpen) return null;

  const isNew = !article;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[#0C5DB8]" />
          <span>
            {isNew
              ? "Create Approved Hospital Knowledge Article"
              : `Edit Article: ${article.title}`}
          </span>
        </div>
      }
      description="Validated clinical and administrative information for Smrko Voice Malayalam AI voice grounding. Changes are strictly version-controlled."
    >
      <KnowledgeEditorModalForm
        key={article?.id || "new-article"}
        article={article}
        onClose={onClose}
        onSaveDraft={onSaveDraft}
        onTriggerPublish={onTriggerPublish}
        onPreview={onPreview}
        isSaving={isSaving}
      />
    </Modal>
  );
}
