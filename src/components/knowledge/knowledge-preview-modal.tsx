import * as React from "react";
import { Eye, Volume2, ShieldCheck, FileText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KnowledgeFormData, KNOWLEDGE_CATEGORY_CONFIG } from "@/lib/validations/knowledge-schema";

interface KnowledgePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: KnowledgeFormData;
}

export function KnowledgePreviewModal({
  isOpen,
  onClose,
  data,
}: KnowledgePreviewModalProps) {
  const catConfig = KNOWLEDGE_CATEGORY_CONFIG[data.category] || {
    label: data.category,
    labelMalayalam: "",
    badgeColor: "bg-slate-100 text-slate-700",
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-[#0C5DB8]" />
          <span>Knowledge Grounding Preview</span>
        </div>
      }
      description="Simulated preview of how this article will be ingested and verbalized by the Smrko Voice Malayalam AI assistant."
    >
      <div className="space-y-4 text-xs">
        {/* Header Metadata */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold border ${catConfig.badgeColor}`}>
              {catConfig.label} {catConfig.labelMalayalam ? `(${catConfig.labelMalayalam})` : ""}
            </span>
            <Badge variant="outline" size="sm">
              Status: {data.status || "DRAFT"}
            </Badge>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900">{data.title || "Untitled Article"}</h4>
            {data.titleMalayalam && (
              <p className="text-xs font-semibold text-[#0E7A71] mt-0.5">
                {data.titleMalayalam}
              </p>
            )}
          </div>

          <p className="text-slate-600 text-[11px] italic">
            &ldquo;{data.summary || "No summary provided."}&rdquo;
          </p>

          {data.sourceReference && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-200">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>Reference Document: <strong>{data.sourceReference}</strong></span>
            </div>
          )}
        </div>

        {/* Malayalam Spoken Voice Simulation */}
        <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-teal-900 font-semibold">
            <Volume2 className="h-4 w-4 text-[#0E7A71]" />
            <span>Malayalam Voice Output (Smrko Voice Spoken Dialogue)</span>
          </div>
          <div className="rounded-md bg-white p-3 border border-teal-100 shadow-2xs">
            <p className="text-xs text-slate-800 leading-relaxed font-sans">
              {data.contentMalayalam || (
                <span className="text-slate-400 italic">
                  (No Malayalam voice script provided; voice agent will synthesize approved English facts into Malayalam conversational response.)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* English Clinical Grounding */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <ShieldCheck className="h-4 w-4 text-[#0C5DB8]" />
            <span>Approved English Clinical Facts (Grounding Prompt Context)</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {data.content || "(No English content entered)"}
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button variant="default" size="sm" onClick={onClose} className="bg-[#0C5DB8] text-xs">
            Close Preview
          </Button>
        </div>
      </div>
    </Modal>
  );
}
