import { prisma } from "../src/lib/prisma";

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";

type SignatureCheck = {
  kind: string;
  found: boolean;
  apiStatus?: number;
  signedPageStatus?: number;
  documentResolved?: boolean;
  signerPresent?: boolean;
  signaturePresent?: boolean;
  signedAtPresent?: boolean;
  expectedNumber?: string;
  resolvedNumber?: string | null;
  alreadySignedPostStatus?: number | null;
  alreadySignedPostMessage?: string | null;
};

async function verifySignedPath(input: {
  kind: string;
  signedPath: string | null;
  apiPath: string;
  expectedNumber: string;
}): Promise<SignatureCheck> {
  if (!input.signedPath) return { kind: input.kind, found: false };
  const signedUrl = new URL(input.signedPath, baseUrl);
  const token = signedUrl.searchParams.get("t");
  if (!token) return { kind: input.kind, found: true, apiStatus: 0 };
  const apiUrl = new URL(input.apiPath, baseUrl);
  apiUrl.searchParams.set("t", token);
  const [apiResponse, signedPageResponse] = await Promise.all([
    fetch(apiUrl),
    fetch(signedUrl),
  ]);
  const body = await apiResponse.json();
  const data = body.data ?? body;
  let alreadySignedPostStatus: number | null = null;
  let alreadySignedPostMessage: string | null = null;
  if (
    typeof data.clientSignatureUrl === "string" &&
    data.clientSignatureUrl.startsWith("data:image/")
  ) {
    const post = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        t: token,
        signerName: data.clientSignedName || "חתום",
        signatureDataUrl: data.clientSignatureUrl,
        saveToDocuments: false,
      }),
    });
    const postBody = await post.json();
    alreadySignedPostStatus = post.status;
    alreadySignedPostMessage = postBody.error ?? null;
  }
  return {
    kind: input.kind,
    found: true,
    apiStatus: apiResponse.status,
    signedPageStatus: signedPageResponse.status,
    documentResolved:
      data.portal?.document?.number === input.expectedNumber ||
      data.documentNumber === input.expectedNumber,
    signerPresent: Boolean(data.clientSignedName),
    signaturePresent: Boolean(data.clientSignatureUrl),
    signedAtPresent: Boolean(data.clientSignedAt),
    expectedNumber: input.expectedNumber,
    resolvedNumber:
      data.portal?.document?.number ?? data.documentNumber ?? null,
    alreadySignedPostStatus,
    alreadySignedPostMessage,
  };
}

async function main() {
  const [diary, note, sheet] = await Promise.all([
    prisma.workDiary.findFirst({
      where: { clientSignedAt: { not: null }, signedPdfUrl: { not: null } },
      select: { documentNumber: true, signedPdfUrl: true },
      orderBy: { clientSignedAt: "desc" },
    }),
    prisma.opsDeliveryNote.findFirst({
      where: { clientSignedAt: { not: null }, signedPdfUrl: { not: null } },
      select: { documentNumber: true, signedPdfUrl: true },
      orderBy: { clientSignedAt: "desc" },
    }),
    prisma.measurementSheet.findFirst({
      where: { clientSignedAt: { not: null } },
      select: { id: true, sequenceNumber: true },
      orderBy: { clientSignedAt: "desc" },
    }),
  ]);

  const measurementDocument = sheet
    ? await prisma.document.findFirst({
        where: {
          sourceType: "measurement_sheet_signed",
          sourceId: sheet.id,
        },
        select: { url: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const checks = await Promise.all([
    verifySignedPath({
      kind: "work_diary",
      signedPath: diary?.signedPdfUrl ?? null,
      apiPath: diary
        ? `/api/sign/work-diary/${encodeURIComponent(diary.documentNumber)}`
        : "",
      expectedNumber: diary?.documentNumber ?? "",
    }),
    verifySignedPath({
      kind: "delivery_note",
      signedPath: note?.signedPdfUrl ?? null,
      apiPath: note
        ? `/api/sign/delivery-note/${encodeURIComponent(note.documentNumber)}`
        : "",
      expectedNumber: note?.documentNumber ?? "",
    }),
    verifySignedPath({
      kind: "measurement_sheet",
      signedPath: measurementDocument?.url ?? null,
      apiPath: sheet ? `/api/sign/measurement-sheet/${sheet.id}` : "",
      expectedNumber: sheet ? `MS-${sheet.sequenceNumber}` : "",
    }),
  ]);

  console.log(JSON.stringify({ checks }, null, 2));
}

void main().finally(() => prisma.$disconnect());
