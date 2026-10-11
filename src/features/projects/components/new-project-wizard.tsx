"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui";
import { projectService } from "@/services";
import type { ParsedContractBoqResult } from "@/lib/ai/types";
import {
  isActiveScanStatus,
  SCAN_STATUS,
  SCAN_TIMEOUT,
} from "@/lib/ai/scan-job";
import { AiAnalyzeProgress } from "./ai-analyze-progress";
import { ProjectReviewForm } from "./project-review-form";

type Step = "upload" | "analyzing" | "review" | "failed" | "still_running";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function NewProjectWizard() {
  const searchParams = useSearchParams();
  const resumeProjectId = searchParams.get("projectId");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string>(SCAN_STATUS.UPLOADED);

  const [projectId, setProjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [parseLogId, setParseLogId] = useState("");
  const [parsed, setParsed] = useState<ParsedContractBoqResult | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  useEffect(() => {
    if (!resumeProjectId) return;
    let cancelled = false;
    projectService
      .getProjectScanJob(resumeProjectId)
      .then((result) => {
        if (cancelled || !result.job) return;
        setProjectId(resumeProjectId);
        setParseLogId(result.job.id);
        setDocumentId(result.job.documentId ?? "");
        applyJob(result.job.status, result.job.parsed as ParsedContractBoqResult | null, result.job.error);
        if (isActiveScanStatus(result.job.status)) {
          void waitForParse(result.job.id);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [resumeProjectId]);

  function applyJob(
    status: string,
    nextParsed: ParsedContractBoqResult | null,
    nextError?: string | null
  ) {
    setScanStatus(status);
    if (status === SCAN_STATUS.COMPLETED && nextParsed) {
      setParsed(nextParsed);
      setMissingFields(nextParsed.missingFields ?? []);
      setStep("review");
      return;
    }
    if (status === SCAN_STATUS.FAILED || status === SCAN_STATUS.TIMED_OUT) {
      setParsed(nextParsed);
      setError(
        nextError ||
          "לא הצלחנו להשלים את סריקת המסמך. הקובץ המקורי נשמר בפרויקט."
      );
      setStep("failed");
      return;
    }
    if (isActiveScanStatus(status)) {
      setStep("analyzing");
    }
  }

  async function waitForParse(id: string) {
    const started = Date.now();
    let consecutivePollErrors = 0;
    void projectService.runParse(id).catch(() => undefined);

    while (true) {
      try {
        const log = await projectService.getParseLog(id);
        consecutivePollErrors = 0;
        setScanStatus(log.status);
        if (log.status === SCAN_STATUS.COMPLETED && log.parsed) {
          setParsed(log.parsed as ParsedContractBoqResult);
          setMissingFields(
            (log.parsed as ParsedContractBoqResult).missingFields ?? []
          );
          setStep("review");
          return;
        }
        if (log.status === SCAN_STATUS.FAILED || log.status === SCAN_STATUS.TIMED_OUT) {
          setParsed((log.parsed as ParsedContractBoqResult) ?? null);
          setError(
            log.error ||
              "לא הצלחנו להשלים את סריקת המסמך. הקובץ המקורי נשמר בפרויקט."
          );
          setStep("failed");
          return;
        }
      } catch {
        consecutivePollErrors += 1;
        // A single poll failure is not a job failure.
      }

      if (Date.now() - started > SCAN_TIMEOUT.uiStillRunningMs) {
        setStep("still_running");
        return;
      }
      if (consecutivePollErrors > 20) {
        setStep("still_running");
        return;
      }
      await sleep(SCAN_TIMEOUT.uiPollMs);
    }
  }

  async function runAnalyze(selected: File) {
    setStep("analyzing");
    setScanStatus(SCAN_STATUS.UPLOADED);
    setError(null);

    try {
      const result = await projectService.createFromPdf(selected);
      setProjectId(result.projectId);
      setDocumentId(result.documentId);
      setParseLogId(result.parseLogId);
      setScanStatus(result.status ?? SCAN_STATUS.QUEUED);
      await waitForParse(result.parseLogId);
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
    setScanStatus(SCAN_STATUS.QUEUED);
    setError(null);

    try {
      const result = await projectService.reparse(projectId, documentId);
      setParseLogId(result.parseLogId);
      await waitForParse(result.parseLogId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בניתוח חוזר");
      setStep("failed");
    }
  }

  function startManual() {
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
          subtotal: null,
          vatPercent: null,
          vatAmount: null,
          totalWithVat: null,
          paymentTerms: null,
          currency: "ILS",
          notes: null,
        },
        chapters: [],
        rooms: [],
        items: [],
        missingFields: [
          "project.name",
          "project.contractNumber",
          "project.contractor",
          "project.location",
          "project.contractValue",
          "items",
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
      "items",
    ]);
    setStep("review");
  }

  if (step === "analyzing" || step === "still_running") {
    return (
      <div className="space-y-4">
        <AiAnalyzeProgress
          status={scanStatus}
          stillRunning={step === "still_running"}
        />
        {step === "still_running" && projectId && (
          <div className="flex justify-center">
            <Link href={`/projects/${projectId}`}>
              <Button variant="secondary">חזור לפרויקט</Button>
            </Link>
          </div>
        )}
      </div>
    );
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
        <AiAnalyzeProgress
          status={SCAN_STATUS.FAILED}
          failed
          error={
            error ||
            "לא הצלחנו להשלים את סריקת המסמך. הקובץ המקורי נשמר בפרויקט."
          }
        />
        <div className="flex flex-wrap gap-2 justify-center">
          <Button onClick={handleRetry}>נסה שוב</Button>
          <Button variant="secondary" onClick={startManual} disabled={!projectId}>
            הזנה ידנית
          </Button>
          {projectId && (
            <Link href={`/projects/${projectId}`}>
              <Button variant="secondary">חזור לפרויקט</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">פרויקט חדש מ-PDF</h1>
        <p className="text-sm text-gray-500 mt-1">
          העלה חוזה או כתב כמויות — AI יזהה את הפרטים ואת הסעיפים אוטומטית
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
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            if (!selected) return;
            const isPdf =
              selected.type === "application/pdf" ||
              selected.name.toLowerCase().endsWith(".pdf");
            if (!isPdf) {
              setError("ניתן להעלות קובץ PDF בלבד");
              return;
            }
            setError(null);
            setFile(selected);
          }}
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
        <Button disabled={!file} onClick={() => file && runAnalyze(file)}>
          התחל ניתוח עם AI
        </Button>
      </div>
    </div>
  );
}
