import { pipelineLog } from "@/lib/api/pipeline-log";
import { getGeminiClient, getGeminiModel } from "./gemini.client";
import {
  CONTRACT_BOQ_SYSTEM_PROMPT,
  CONTRACT_BOQ_USER_PROMPT,
} from "./prompts/contract-boq.prompt";
import { normalizeContractBoq } from "./contract-boq.schema";
import {
  classifyGeminiError,
  geminiUserMessage,
  isTransientGeminiError,
} from "./gemini-errors";
import { backoffMs, SCAN_TIMEOUT } from "./scan-job";
import type {
  AiDocumentType,
  AiParseRequest,
  AiParseResult,
  ParsedContractBoqResult,
} from "./types";

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("לא התקבל JSON תקין מ-AI");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new Error("לא התקבל JSON תקין מ-AI");
  }
}

function getPromptForType(documentType: AiDocumentType): {
  system: string;
  user: string;
} {
  switch (documentType) {
    case "contract_boq":
      return {
        system: CONTRACT_BOQ_SYSTEM_PROMPT,
        user: CONTRACT_BOQ_USER_PROMPT,
      };
    default:
      return {
        system: CONTRACT_BOQ_SYSTEM_PROMPT,
        user: `נתח את המסמך מסוג ${documentType} והחזר JSON מובנה ומדויק בלבד.`,
      };
  }
}

const INLINE_PDF_LIMIT_BYTES = 2 * 1024 * 1024;

function parseTimeoutMs() {
  const raw = Number(process.env.GEMINI_PARSE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 30_000 ? raw : SCAN_TIMEOUT.geminiMs;
}

function isAbortError(error: unknown) {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (error instanceof Error && /aborted|timeout/i.test(error.message))
  );
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

type DocumentPart =
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { fileUri: string; mimeType: string } };

async function filePartForBuffer(
  ai: ReturnType<typeof getGeminiClient>,
  request: AiParseRequest,
  abortSignal: AbortSignal
): Promise<{ part: DocumentPart; uploadedName?: string }> {
  const mimeType = request.mimeType || "application/pdf";
  const useFileApi =
    mimeType === "application/pdf" && request.buffer.length > INLINE_PDF_LIMIT_BYTES;

  if (!useFileApi) {
    return {
      part: {
        inlineData: {
          mimeType,
          data: request.buffer.toString("base64"),
        },
      },
    };
  }

  pipelineLog("AI", "Uploading PDF to AI Files API", {
    fileName: request.fileName,
    bytes: request.buffer.length,
  });

  let uploaded = await ai.files.upload({
    file: new Blob([new Uint8Array(request.buffer)], { type: mimeType }),
    config: { mimeType, abortSignal },
  });

  for (let i = 0; i < 30; i++) {
    if (abortSignal.aborted) {
      throw new DOMException("תם הזמן לסריקת AI", "AbortError");
    }
    if (!uploaded.state || uploaded.state === "ACTIVE") break;
    if (uploaded.state === "FAILED") {
      throw new Error("העלאת המסמך ל-AI נכשלה");
    }
    await wait(1000);
    if (!uploaded.name) break;
    uploaded = await ai.files.get({ name: uploaded.name, config: { abortSignal } });
  }

  if (uploaded.state && uploaded.state !== "ACTIVE") {
    throw new Error("המסמך לא מוכן לסריקה");
  }
  if (!uploaded.uri) {
    throw new Error("לא התקבל קישור למסמך ב-AI");
  }

  return {
    part: {
      fileData: {
        fileUri: uploaded.uri,
        mimeType,
      },
    },
    uploadedName: uploaded.name,
  };
}

/**
 * Central AI Document Parser Service.
 * Communicates with Gemini and returns a normalized JSON result.
 * Future document types should plug in here without changing UI modules.
 */
export class AiDocumentParserService {
  static async parse<T = unknown>(
    request: AiParseRequest
  ): Promise<AiParseResult<T>> {
    const startedAt = new Date();
    const startMs = Date.now();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), parseTimeoutMs());
    let uploadedName: string | undefined;

    try {
      const ai = getGeminiClient();
      const model = getGeminiModel();
      const { system, user } = getPromptForType(request.documentType);
      const filePart = await filePartForBuffer(ai, request, abort.signal);
      uploadedName = filePart.uploadedName;

      pipelineLog("AI", "Calling AI generateContent", {
        model,
        fileName: request.fileName,
        bytes: request.buffer.length,
        via: "fileData" in filePart.part ? "files" : "inline",
      });

      let rawText = "";
      for (let attempt = 1; attempt <= SCAN_TIMEOUT.maxAttempts; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { text: `${system}\n\n${user}\n\nשם קובץ: ${request.fileName}` },
                  filePart.part,
                ],
              },
            ],
            config: {
              temperature: 0.1,
              responseMimeType: "application/json",
              abortSignal: abort.signal,
            },
          });
          rawText = response.text ?? "";
          if (!rawText) {
            throw new Error("AI החזיר תשובה ריקה");
          }
          break;
        } catch (error) {
          const kind = classifyGeminiError(error);
          const canRetry =
            isTransientGeminiError(kind) &&
            !isAbortError(error) &&
            attempt < SCAN_TIMEOUT.maxAttempts;
          if (!canRetry) throw error;
          pipelineLog("AI", "Transient Gemini error, retrying", {
            attempt,
            kind,
          });
          await wait(backoffMs(attempt));
        }
      }

      pipelineLog("AI", "AI raw response received", {
        chars: rawText.length,
      });

      const parsedRaw = extractJson(rawText);
      pipelineLog("AI", "JSON parsed successfully");
      let data: unknown = parsedRaw;

      if (request.documentType === "contract_boq") {
        const validated = normalizeContractBoq(parsedRaw);
        if (!validated.ok) {
          throw new Error(validated.error);
        }
        data = validated.data;
      }

      const endedAt = new Date();
      const normalized =
        request.documentType === "contract_boq"
          ? (data as ParsedContractBoqResult)
          : null;

      return {
        success: true,
        data: data as T,
        missingFields: normalized?.missingFields ?? [],
        itemsDetected: normalized?.items.length ?? 0,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: Date.now() - startMs,
        rawText,
      };
    } catch (error) {
      const kind = classifyGeminiError(error);
      const endedAt = new Date();
      return {
        success: false,
        data: null,
        missingFields: [],
        itemsDetected: 0,
        error: geminiUserMessage(
          kind,
          error instanceof Error ? error.message : "שגיאת ניתוח AI"
        ),
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: Date.now() - startMs,
      };
    } finally {
      clearTimeout(timer);
      if (uploadedName) {
        try {
          await getGeminiClient().files.delete({ name: uploadedName });
        } catch {
          // Best-effort cleanup of the temporary AI file.
        }
      }
    }
  }
}
