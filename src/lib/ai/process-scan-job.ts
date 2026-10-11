import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { pipelineLog } from "@/lib/api/pipeline-log";
import { AiParseRepository } from "@/repositories/ai-parse.repository";
import { AiDocumentParserService } from "@/lib/ai/document-parser.service";
import {
  classifyGeminiError,
  geminiErrorCode,
  geminiUserMessage,
  isTransientGeminiError,
} from "@/lib/ai/gemini-errors";
import {
  backoffMs,
  isStaleLock,
  jobTimeoutAt,
  SCAN_STATUS,
} from "@/lib/ai/scan-job";
import type { ParsedContractBoqResult } from "@/lib/ai/types";

export type ProcessScanJobResult = {
  skipped: boolean;
  status: string;
  success: boolean;
  parsed: ParsedContractBoqResult | null;
  missingFields: string[];
  itemsDetected: number;
  durationMs: number;
  error?: string;
  errorCode?: string;
};

async function downloadDocumentBuffer(documentId: string): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    throw new Error("מסמך לא נמצא");
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(document.bucket)
    .download(document.path);

  if (error || !data) {
    throw new Error(`לא ניתן להוריד את הקובץ: ${error?.message ?? "unknown"}`);
  }

  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    fileName: document.name.endsWith(".pdf") ? document.name : `${document.name}.pdf`,
    mimeType: "application/pdf",
  };
}

async function prefillProjectFromParse(
  projectId: string,
  parsed: ParsedContractBoqResult,
  userId: string
) {
  const p = parsed.project;
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      contractNumber: true,
      contractor: true,
      location: true,
      description: true,
    },
  });
  if (!existing) return;

  const nextContract = p.contractNumber?.trim() || existing.contractNumber;

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        name: p.name?.trim() || existing.name,
        contractNumber: nextContract,
        contractor: p.contractor?.trim() || existing.contractor,
        location: p.location?.trim() || existing.location,
        contractValue: p.contractValue && p.contractValue > 0 ? p.contractValue : undefined,
        description:
          [
            p.client ? `לקוח: ${p.client}` : null,
            p.paymentTerms ? `תשלום: ${p.paymentTerms}` : null,
            p.currency ? `מטבע: ${p.currency}` : null,
            p.notes,
          ]
            .filter(Boolean)
            .join("\n") || existing.description,
        updatedById: userId,
      },
    });
  } catch {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        name: p.name?.trim() || existing.name,
        contractor: p.contractor?.trim() || existing.contractor,
        location: p.location?.trim() || existing.location,
        contractValue: p.contractValue && p.contractValue > 0 ? p.contractValue : undefined,
        updatedById: userId,
      },
    });
  }
}

export async function recoverStuckScanJobs(now = new Date()) {
  const staleBefore = new Date(now.getTime() - 4 * 60_000);

  const timedOut = await prisma.aiParseLog.updateMany({
    where: {
      status: {
        in: [
          SCAN_STATUS.UPLOADED,
          SCAN_STATUS.QUEUED,
          SCAN_STATUS.PROCESSING,
          SCAN_STATUS.VALIDATING,
        ],
      },
      timeoutAt: { lte: now },
    },
    data: {
      status: SCAN_STATUS.TIMED_OUT,
      endedAt: now,
      error: "תם הזמן לסריקת AI.",
      errorCode: "TIMEOUT",
      lockedAt: null,
    },
  });

  const stale = await prisma.aiParseLog.findMany({
    where: {
      status: { in: [SCAN_STATUS.PROCESSING, SCAN_STATUS.VALIDATING] },
      OR: [{ heartbeatAt: null }, { heartbeatAt: { lte: staleBefore } }],
    },
    select: { id: true, attempts: true, maxAttempts: true, heartbeatAt: true },
  });

  let requeued = 0;
  let failed = 0;
  for (const job of stale) {
    if (!isStaleLock(job.heartbeatAt, now.getTime())) continue;
    if (job.attempts >= job.maxAttempts) {
      await prisma.aiParseLog.update({
        where: { id: job.id },
        data: {
          status: SCAN_STATUS.TIMED_OUT,
          endedAt: now,
          error: "הסריקה נתקעה ומוצה מספר הניסיונות.",
          errorCode: "TIMEOUT",
          lockedAt: null,
        },
      });
      failed += 1;
      continue;
    }
    await prisma.aiParseLog.update({
      where: { id: job.id },
      data: {
        status: SCAN_STATUS.QUEUED,
        nextRetryAt: now,
        lockedAt: null,
        error: "הסריקה נקטעה — ממתינה לניסיון חוזר.",
        errorCode: "RECOVERED",
      },
    });
    requeued += 1;
  }

  return { timedOut: timedOut.count, requeued, failed };
}

export async function listDueScanJobs(limit = 1) {
  const now = new Date();
  return prisma.aiParseLog.findMany({
    where: {
      status: { in: [SCAN_STATUS.UPLOADED, SCAN_STATUS.QUEUED] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/**
 * Durable worker entry. Claim is CAS in the database.
 * Safe if the browser is closed — cron will call this again.
 */
export async function processScanJob(opts: {
  parseLogId: string;
  userId: string;
  buffer?: Buffer;
  fileName?: string;
  mimeType?: string;
}): Promise<ProcessScanJobResult> {
  const claimed = await AiParseRepository.claim(opts.parseLogId);
  if (!claimed) {
    const existing = await AiParseRepository.findById(opts.parseLogId);
    const parsed = existing?.resultJson
      ? (JSON.parse(existing.resultJson) as ParsedContractBoqResult)
      : null;
    return {
      skipped: true,
      status: existing?.status ?? SCAN_STATUS.PROCESSING,
      success: existing?.status === SCAN_STATUS.COMPLETED,
      parsed,
      missingFields: parsed?.missingFields ?? [],
      itemsDetected: existing?.itemsDetected ?? 0,
      durationMs: existing?.durationMs ?? 0,
      error: existing?.error ?? undefined,
      errorCode: existing?.errorCode ?? undefined,
    };
  }

  const job = await AiParseRepository.findById(opts.parseLogId);
  if (!job?.documentId || !job.projectId) {
    await AiParseRepository.update(opts.parseLogId, {
      status: SCAN_STATUS.FAILED,
      endedAt: new Date(),
      error: "חסר מסמך או פרויקט לסריקה",
      errorCode: "PERMANENT",
    });
    return {
      skipped: false,
      status: SCAN_STATUS.FAILED,
      success: false,
      parsed: null,
      missingFields: [],
      itemsDetected: 0,
      durationMs: 0,
      error: "חסר מסמך או פרויקט לסריקה",
      errorCode: "PERMANENT",
    };
  }

  pipelineLog("AI", "Scan job claimed", {
    parseLogId: opts.parseLogId,
    projectId: job.projectId,
    attempt: job.attempts,
  });

  const startedAt = Date.now();

  try {
    let fileName = opts.fileName;
    let mimeType = opts.mimeType ?? "application/pdf";
    let buffer = opts.buffer;

    if (!buffer) {
      const downloaded = await downloadDocumentBuffer(job.documentId);
      buffer = downloaded.buffer;
      fileName = fileName || downloaded.fileName;
      mimeType = downloaded.mimeType;
    }

    const parseResult = await AiDocumentParserService.parse<ParsedContractBoqResult>({
      documentType: "contract_boq",
      fileName: fileName || "document.pdf",
      mimeType,
      buffer,
      language: "he",
    });

    await AiParseRepository.update(opts.parseLogId, {
      status: SCAN_STATUS.VALIDATING,
      heartbeatAt: new Date(),
    });

    if (!parseResult.success || !parseResult.data) {
      const kind = classifyGeminiError(parseResult.error);
      const transient = isTransientGeminiError(kind);
      const canRetry = transient && job.attempts < job.maxAttempts;
      if (canRetry) {
        await AiParseRepository.update(opts.parseLogId, {
          status: SCAN_STATUS.QUEUED,
          nextRetryAt: new Date(Date.now() + backoffMs(job.attempts)),
          lockedAt: null,
          error: geminiUserMessage(kind, parseResult.error),
          errorCode: geminiErrorCode(kind),
        });
        return {
          skipped: false,
          status: SCAN_STATUS.QUEUED,
          success: false,
          parsed: null,
          missingFields: [],
          itemsDetected: 0,
          durationMs: Date.now() - startedAt,
          error: geminiUserMessage(kind, parseResult.error),
          errorCode: geminiErrorCode(kind),
        };
      }

      const status =
        kind === "timeout" ? SCAN_STATUS.TIMED_OUT : SCAN_STATUS.FAILED;
      await AiParseRepository.update(opts.parseLogId, {
        status,
        endedAt: new Date(),
        durationMs: parseResult.durationMs,
        error: geminiUserMessage(kind, parseResult.error),
        errorCode: geminiErrorCode(kind),
        resultJson: null,
        lockedAt: null,
      });
      return {
        skipped: false,
        status,
        success: false,
        parsed: null,
        missingFields: [],
        itemsDetected: 0,
        durationMs: parseResult.durationMs,
        error: geminiUserMessage(kind, parseResult.error),
        errorCode: geminiErrorCode(kind),
      };
    }

    await AiParseRepository.update(opts.parseLogId, {
      status: SCAN_STATUS.COMPLETED,
      endedAt: new Date(parseResult.endedAt),
      durationMs: parseResult.durationMs,
      itemsDetected: parseResult.itemsDetected,
      fieldsMissing: parseResult.missingFields.length,
      error: null,
      errorCode: null,
      resultJson: JSON.stringify(parseResult.data),
      lockedAt: null,
    });
    await prefillProjectFromParse(job.projectId, parseResult.data, opts.userId);

    pipelineLog("AI", "Scan job completed", {
      parseLogId: opts.parseLogId,
      itemsDetected: parseResult.itemsDetected,
    });

    return {
      skipped: false,
      status: SCAN_STATUS.COMPLETED,
      success: true,
      parsed: parseResult.data,
      missingFields: parseResult.missingFields,
      itemsDetected: parseResult.itemsDetected,
      durationMs: parseResult.durationMs,
    };
  } catch (error) {
    const kind = classifyGeminiError(error);
    const message = geminiUserMessage(
      kind,
      error instanceof Error ? error.message : "שגיאת ניתוח AI"
    );
    await AiParseRepository.update(opts.parseLogId, {
      status: kind === "timeout" ? SCAN_STATUS.TIMED_OUT : SCAN_STATUS.FAILED,
      endedAt: new Date(),
      durationMs: Date.now() - startedAt,
      error: message,
      errorCode: geminiErrorCode(kind),
      resultJson: null,
      lockedAt: null,
    });
    return {
      skipped: false,
      status: kind === "timeout" ? SCAN_STATUS.TIMED_OUT : SCAN_STATUS.FAILED,
      success: false,
      parsed: null,
      missingFields: [],
      itemsDetected: 0,
      durationMs: Date.now() - startedAt,
      error: message,
      errorCode: geminiErrorCode(kind),
    };
  }
}

export { jobTimeoutAt };
