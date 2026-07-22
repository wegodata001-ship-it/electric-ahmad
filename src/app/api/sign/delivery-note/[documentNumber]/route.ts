import { NextRequest } from "next/server";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ documentNumber: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { documentNumber } = await ctx.params;
    const token = req.nextUrl.searchParams.get("t");
    if (!token) return apiError("חסר קישור מאובטח", 401);
    const note = await OpsDeliveryNotesRepository.getPublicForSign(documentNumber, token);
    return apiSuccess(note);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { documentNumber } = await ctx.params;
    const body = await req.json();
    const token = String(body.t ?? body.token ?? "");
    if (!token) return apiError("חסר קישור מאובטח", 401);
    if (!body.signatureDataUrl) return apiError("חסרה חתימה");
    if (!body.signerName?.trim()) return apiError("יש להזין שם החותם");

    const note = await OpsDeliveryNotesRepository.applyClientSignature({
      documentNumber,
      tokenParam: token,
      signatureDataUrl: String(body.signatureDataUrl),
      signerName: String(body.signerName).trim(),
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
      device: req.headers.get("user-agent"),
    });

    return apiSuccess(note);
  } catch (error) {
    return handleApiError(error);
  }
}
