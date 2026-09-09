import { NextRequest } from "next/server";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseJsonBody, ValidationError } from "@/lib/validation/parse-body";
import { clientSignatureBodySchema } from "@/lib/validation/schemas";
import {
  enforceRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

const SIGN_BUCKET = "sign-measurement-sheet";
const SIGN_LIMIT = 30;
const SIGN_WINDOW_MS = 60 * 60 * 1000;

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const token = req.nextUrl.searchParams.get("t");
    if (!token) return apiError("חסר קישור מאובטח", 401);
    const sheet = await MeasurementSheetsRepository.getPublicForSign(id, token);
    return apiSuccess(sheet);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const ip = getClientIp(req);
  const limited = enforceRateLimit(
    {
      key: `${SIGN_BUCKET}:${ip}`,
      limit: SIGN_LIMIT,
      windowMs: SIGN_WINDOW_MS,
    },
    "יותר מדי חתימות. נסו שוב בעוד רגע."
  );
  if (limited) return limited;

  try {
    const { id } = await ctx.params;
    const body = await parseJsonBody(req, clientSignatureBodySchema);
    const token = String(body.t ?? body.token ?? "");
    if (!token) return apiError("חסר קישור מאובטח", 401);

    const sheet = await MeasurementSheetsRepository.applyClientSignature({
      sheetId: id,
      tokenParam: token,
      signatureDataUrl: body.signatureDataUrl,
      signerName: body.signerName,
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
      device: req.headers.get("user-agent"),
      saveToDocuments: body.saveToDocuments !== false,
    });

    return apiSuccess(sheet);
  } catch (error) {
    if (error instanceof ValidationError) return handleApiError(error);
    return handleApiError(error);
  }
}
