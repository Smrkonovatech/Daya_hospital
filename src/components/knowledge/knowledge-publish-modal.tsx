import * as React from "react";
import { Send, AlertTriangle, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KnowledgeArticle } from "@/types";

interface KnowledgePublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: KnowledgeArticle | null;
  onConfirmPublish: (authorName: string, changeNote: string) => Promise<void>;
  isPublishing: boolean;
}

interface FormContentProps {
  article: KnowledgeArticle;
  onClose: () => void;
  onConfirmPublish: (authorName: string, changeNote: string) => Promise<void>;
  isPublishing: boolean;
}

function KnowledgePublishModalContent({
  article,
  onClose,
  onConfirmPublish,
  isPublishing,
}: FormContentProps) {
  const [authorName, setAuthorName] = React.useState(
    "Dr. Anjali Menon (Medical Supt.)"
  );
  const [changeNote, setChangeNote] = React.useState("");

  const currentVersion = article.version;
  const nextVersion = currentVersion + 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirmPublish(
      authorName.trim() || "Dr. Anjali Menon (Medical Supt.)",
      changeNote.trim() || `Authorized clinical publication of version ${nextVersion}`
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      {/* Warning Banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-amber-900 text-[11px]">
          <p className="font-semibold">Healthcare Publication Safety Notice:</p>
          <p>
            Once published, incoming hospital callers will receive answers based on this exact content. Please ensure all tariff numbers, timings, and clinical escalation extensions are verified.
          </p>
        </div>
      </div>

      {/* Article Summary & Version Increment */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            Target Article
          </span>
          <h4 className="text-xs font-bold text-slate-900 mt-0.5">{article.title}</h4>
          {article.titleMalayalam && (
            <p className="text-[11px] text-[#0E7A71]">{article.titleMalayalam}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="text-slate-600">Current Status:</span>
          <span className="font-semibold text-slate-800">
            {article.status} (v{currentVersion})
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600">New Published Version:</span>
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
            v{nextVersion} (Live Grounding)
          </span>
        </div>
      </div>

      {/* Author Details */}
      <div>
        <label className="font-semibold text-slate-800 block mb-1">
          Authorised Clinical Reviewer Name *
        </label>
        <Input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="e.g. Dr. Anjali Menon (Medical Supt.)"
          required
        />
      </div>

      {/* Audit Publication Note */}
      <div>
        <label className="font-semibold text-slate-800 block mb-1">
          Publication Authorization Note (Recorded in Audit Trail)
        </label>
        <Input
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="e.g. Tariff approved as per Management Circular #2026/18"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isPublishing}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          variant="default"
          size="sm"
          disabled={isPublishing}
          className="bg-[#0C5DB8] hover:bg-[#0A4D98] text-white gap-1.5"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{isPublishing ? "Authorising..." : "Confirm & Authorise Publish"}</span>
        </Button>
      </div>
    </form>
  );
}

export function KnowledgePublishModal({
  isOpen,
  onClose,
  article,
  onConfirmPublish,
  isPublishing,
}: KnowledgePublishModalProps) {
  if (!article) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-[#0C5DB8]" />
          <span>Authorise Publication to Live AI Grounding</span>
        </div>
      }
      description="Publication immediately promotes this article to the approved knowledge base used by the Malayalam voice assistant."
    >
      <KnowledgePublishModalContent
        key={article.id}
        article={article}
        onClose={onClose}
        onConfirmPublish={onConfirmPublish}
        isPublishing={isPublishing}
      />
    </Modal>
  );
}
