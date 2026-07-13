"use client";

import { useEffect, useState } from "react";
import { documentService } from "@/features/documents/services/document.service";
import type { Document } from "@/types";
import { Card, Badge } from "@/components/ui";
import { formatDate } from "@/utils/format";
import { DOCUMENT_TYPE_LABELS } from "@/constants";
import { FileText, FileSpreadsheet, FileImage, File, Download, History } from "lucide-react";

const typeIcons: Record<string, React.ElementType> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  word: FileText,
  dwg: File,
  image: FileImage,
  video: FileImage,
  other: File,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    documentService.getAll().then(setDocuments);
  }, []);

  const filtered =
    filter === "all" ? documents : documents.filter((d) => d.type === filter);

  const typeFilters = ["all", "pdf", "excel", "word", "dwg", "image"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">מסמכים</h1>
        <p className="text-sm text-gray-500 mt-1">{documents.length} מסמכים</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {typeFilters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f === "all" ? "הכל" : DOCUMENT_TYPE_LABELS[f as keyof typeof DOCUMENT_TYPE_LABELS]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((doc) => {
          const Icon = typeIcons[doc.type] || File;
          return (
            <Card key={doc.id} hover>
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{doc.projectName}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="primary">{DOCUMENT_TYPE_LABELS[doc.type]}</Badge>
                    <span className="text-xs text-gray-400">{formatFileSize(doc.size)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-400">
                  {doc.uploadedBy} · {formatDate(doc.uploadedAt)}
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <History className="h-4 w-4" />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {doc.version > 1 && (
                <p className="text-xs text-gray-400 mt-2">גרסה {doc.version}</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
