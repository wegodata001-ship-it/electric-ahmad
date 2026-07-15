"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui";
import { projectService } from "@/services";
import type { ParsedContractBoqResult } from "@/lib/ai/types";
import { AiAnalyzeProgress } from "./ai-analyze-progress";
import { ProjectReviewForm } from "./project-review-form";

type Step = "upload" | "analyzing" | "review" | "failed";

export function NewProjectWizard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [analyzeDone, setAnalyzeDone] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [parseLogId, setParseLogId] = useState("");
  const [parsed, setParsed] = useState<ParsedContractBoqResult | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;
    const isPdf =
      selected.type === "application/pdf" || selected.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("ניתן להעלות קובץ PDF בלבד");
      return;
    }
    setError(null);
    setFile(selected);
  }

  async function runAnalyze(selected: File) {
    setStep("analyzing");
    setAnalyzeDone(false);
    setError(null);

    try {
      const result = await projectService.createFromPdf(selected);
      setProjectId(result.projectId);
      setDocumentId(result.documentId);
      setParseLogId(result.parseLogId);
      setParsed((result.parsed as ParsedContractBoqResult) ?? null);
      setMissingFields(result.missingFields ?? []);
      setAnalyzeDone(true);

      if (result.success && result.parsed) {
        setTimeout(() => setStep("review"), 700);
      } else {
        setStep("failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאה / ניתוח");
      setStep("failed");
    }
  }

  async function handleRetry() {
    if (!projectId || !documentId) {
      if (file) await runAnalyze(file);
      return;
    }

    setStep("analyzing");
    setAnalyzeDone(false);
    setError(null);

    try {
      const result = await projectService.reparse(projectId, documentId);
      setParseLogId(result.parseLogId);
      setParsed((result.parsed as ParsedContractBoqResult) ?? null);
      setMissingFields(result.missingFields ?? []);
      setAnalyzeDone(true);

      if (result.success && result.parsed) {
        setTimeout(() => setStep("review"), 700);
      } else {
        setStep("failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בניתוח חוזר");
      setStep("failed");
    }
  }

  if (step === "analyzing") {
    return <AiAnalyzeProgress active done={analyzeDone} />;
  }

  if (step === "review" && parsed) {
    return (
      <ProjectReviewForm
        projectId={projectId}
        parseLogId={parseLogId}
        documentId={documentId}
        initialParsed={parsed}
        missingFields={missingFields}
        onRetry={handleRetry}
      />
    );
  }

  if (step === "failed") {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <AiAnalyzeProgress active={false} failed />
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={handleRetry}>נסה שוב</Button>
          <Button
            variant="secondary"
            onClick={() => {
              // Continue with empty/manual review using whatever was parsed
              setParsed(
                parsed ?? {
                  documentType: "contract_boq",
                  project: {
                    name: file?.name.replace(/\.pdf$/i, "") ?? "",
                    contractNumber: "",
                    contractor: "",
                    client: null,
                    location: "",
                    date: null,
                    contractValue: null,
                    paymentTerms: null,
                    currency: "ILS",
                    notes: null,
                  },
                  chapters: [],
                  items: [],
                  missingFields: [
                    "project.name",
                    "project.contractNumber",
                    "project.contractor",
                    "project.location",
                    "project.contractValue",
                  ],
                  confidence: 0,
                }
              );
              setMissingFields([
                "project.name",
                "project.contractNumber",
                "project.contractor",
                "project.location",
                "project.contractValue",
              ]);
              setStep("review");
            }}
            disabled={!projectId}
          >
            המשך בהזנה ידנית
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">פרויקט חדש מ-PDF</h1>
        <p className="text-sm text-gray-500 mt-1">
          העלה חוזה או כתב כמויות — Gemini יזהה את הפרטים ואת הסעיפים אוטומטית
        </p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border border-dashed border-gray-300 rounded-2xl p-10 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-colors bg-white"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary-50 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              onClick={(ev) => {
                ev.stopPropagation();
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-900">העלה קובץ PDF</p>
            <p className="text-sm text-gray-500 mt-1">ללא Excel · ללא מילוי ידני בשלב זה</p>
          </>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          disabled={!file}
          onClick={() => file && runAnalyze(file)}
        >
          התחל ניתוח עם Gemini
        </Button>
      </div>
    </div>
  );
}
