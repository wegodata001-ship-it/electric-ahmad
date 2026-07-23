import { NextRequest } from "next/server";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const token = req.nextUrl.searchParams.get("t");
    if (!token) return apiError("חסר קישור מאובטח", 401);
    const sheet = await MeasurementSheetsRepository.getPublicForSign(id, token);
    return apiSuccess(sheet);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const token = String(body.t ?? body.token ?? "");
    if (!token) return apiError("חסר קישור מאובטח", 401);
    if (!body.signatureDataUrl) return apiError("חסרה חתימה");
    if (!body.signerName?.trim()) return apiError("יש להזין שם החותם");

    const sheet = await MeasurementSheetsRepository.applyClientSignature({
      sheetId: id,
      tokenParam: token,
      signatureDataUrl: String(body.signatureDataUrl),
      signerName: String(body.signerName).trim(),
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
      device: req.headers.get("user-agent"),
    });

    return apiSuccess(sheet);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
