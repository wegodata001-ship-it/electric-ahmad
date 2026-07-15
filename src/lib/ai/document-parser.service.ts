import { pipelineLog } from "@/lib/api/pipeline-log";
import { getGeminiClient, getGeminiModel } from "./gemini.client";
import {
  CONTRACT_BOQ_SYSTEM_PROMPT,
  CONTRACT_BOQ_USER_PROMPT,
} from "./prompts/contract-boq.prompt";
import type {
  AiDocumentType,
  AiParseRequest,
  AiParseResult,
  ParsedContractBoqResult,
} from "./types";
import { cleanBoqDescription } from "@/utils/boq-text";

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("לא התקבל JSON תקין מ-Gemini");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeContractBoq(raw: unknown): ParsedContractBoqResult {
  const data = (raw ?? {}) as Partial<ParsedContractBoqResult>;
  const project = data.project ?? ({} as ParsedContractBoqResult["project"]);

  const items = Array.isArray(data.items)
    ? data.items.map((item, index) => {
        const qty =
          typeof item.contractQuantity === "number" ? item.contractQuantity : null;
        const unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : null;
        let totalPrice =
          typeof item.totalPrice === "number" ? item.totalPrice : null;
        if (totalPrice == null && qty != null && unitPrice != null) {
          totalPrice = qty * unitPrice;
        }

        return {
          code: item.code ?? null,
          description: cleanBoqDescription(item.description) || null,
          unit: item.unit ?? null,
          contractQuantity: qty,
          unitPrice,
          totalPrice,
          chapter: item.chapter ?? null,
          subChapter: item.subChapter ?? null,
          category: item.category ?? null,
          sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index + 1,
        };
      })
    : [];

  const missingFields = Array.isArray(data.missingFields)
    ? data.missingFields
    : [];

  const requiredProjectFields: (keyof typeof project)[] = [
    "name",
    "contractNumber",
    "contractor",
    "location",
    "contractValue",
  ];

  for (const field of requiredProjectFields) {
    const value = project[field];
    if (value == null || value === "") {
      const key = `project.${field}`;
      if (!missingFields.includes(key)) missingFields.push(key);
    }
  }

  const subtotal = asNullableNumber(project.subtotal);
  const vatPercent = asNullableNumber(project.vatPercent);
  const vatAmount = asNullableNumber(project.vatAmount);
  const totalWithVat = asNullableNumber(project.totalWithVat);
  let contractValue = asNullableNumber(project.contractValue);
  // Prefer document total when contractValue missing — never invent VAT math
  if (contractValue == null && totalWithVat != null) {
    contractValue = totalWithVat;
  } else if (contractValue == null && subtotal != null && vatAmount == null) {
    contractValue = subtotal;
  }

  return {
    documentType: "contract_boq",
    project: {
      name: project.name ?? null,
      contractNumber: project.contractNumber ?? null,
      contractor: project.contractor ?? null,
      client: project.client ?? null,
      location: project.location ?? null,
      date: project.date ?? null,
      contractValue,
      subtotal,
      vatPercent,
      vatAmount,
      totalWithVat,
      paymentTerms: project.paymentTerms ?? null,
      currency: project.currency ?? null,
      notes: project.notes ?? null,
    },
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
    items,
    missingFields,
    confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
  };
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

    try {
      const ai = getGeminiClient();
      const model = getGeminiModel();
      const { system, user } = getPromptForType(request.documentType);

      pipelineLog("AI", "Calling Gemini generateContent", {
        model,
        fileName: request.fileName,
        bytes: request.buffer.length,
      });

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: `${system}\n\n${user}\n\nשם קובץ: ${request.fileName}` },
              {
                inlineData: {
                  mimeType: request.mimeType || "application/pdf",
                  data: request.buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      const rawText = response.text ?? "";
      if (!rawText) {
        throw new Error("Gemini החזיר תשובה ריקה");
      }

      pipelineLog("AI", "Gemini raw response received", {
        chars: rawText.length,
      });

      const parsedRaw = extractJson(rawText);
      pipelineLog("AI", "JSON parsed successfully");
      let data: unknown = parsedRaw;

      if (request.documentType === "contract_boq") {
        data = normalizeContractBoq(parsedRaw);
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
      const endedAt = new Date();
      return {
        success: false,
        data: null,
        missingFields: [],
        itemsDetected: 0,
        error: error instanceof Error ? error.message : "שגיאת ניתוח AI",
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: Date.now() - startMs,
      };
    }
  }
}
