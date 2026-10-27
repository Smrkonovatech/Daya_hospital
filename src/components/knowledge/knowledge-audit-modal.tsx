import * as React from "react";
import { History, Edit, Send, Archive, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KnowledgeArticle } from "@/types";
import { formatDateTime } from "@/lib/utils";

interface KnowledgeAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: KnowledgeArticle | null;
}

export function KnowledgeAuditModal({
  isOpen,
  onClose,
  article,
}: KnowledgeAuditModalProps) {
  if (!article) return null;

  const getActionBadge = (action?: string) => {
    switch (action) {
      case "PUBLISHED":
        return (
          <Badge variant="success" size="sm" className="gap-1">
            <Send className="h-3 w-3" />
            <span>Published</span>
          </Badge>
        );
      case "EDITED_DRAFT":
        return (
          <Badge variant="teal" size="sm" className="gap-1">
            <Edit className="h-3 w-3" />
            <span>Draft Edited</span>
          </Badge>
        );
      case "CREATED":
        return (
          <Badge variant="info" size="sm" className="gap-1">
            <Plus className="h-3 w-3" />
            <span>Created</span>
          </Badge>
        );
      case "ARCHIVED":
        return (
          <Badge variant="secondary" size="sm" className="gap-1">
            <Archive className="h-3 w-3" />
            <span>Archived</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" size="sm">
            {action || "Updated"}
          </Badge>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[#0C5DB8]" />
          <span>Version History & Audit Trail</span>
        </div>
      }
      description={`Regulatory revision log and provenance for "${article.title}"`}
    >
      <div className="space-y-4 text-xs">
        {/* Article Summary Header */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">{article.title}</span>
            <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
              Current: v{article.version} ({article.status})
            </span>
          </div>
          {article.lastPublishedAt && (
            <p className="text-[11px] text-slate-500">
              Last published on {formatDateTime(article.lastPublishedAt)} by{" "}
              <strong className="text-slate-700">{article.lastPublishedBy || article.lastUpdatedBy}</strong>
            </p>
          )}
        </div>

        {/* Audit Timeline */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {article.auditHistory.length === 0 ? (
            <p className="text-slate-400 italic py-4 text-center">No audit records logged yet.</p>
          ) : (
            article.auditHistory.map((item, idx) => (
              <div
                key={idx}
                className="relative flex gap-3 pb-3 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8F2FC] text-[#0C5DB8] font-bold text-xs shrink-0 mt-0.5">
                  v{item.version}
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{item.updatedBy}</span>
                      {getActionBadge(item.action)}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatDateTime(item.timestamp)}
                    </span>
                  </div>

                  <p className="text-slate-700 leading-snug text-xs bg-white rounded p-2 border border-slate-100">
                    {item.summaryOfChanges}
                  </p>

                  {(item.previousStatus || item.newStatus) && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span>Status transition:</span>
                      <span className="font-medium text-slate-600">
                        {item.previousStatus || "NEW"} → {item.newStatus || "UNCHANGED"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
