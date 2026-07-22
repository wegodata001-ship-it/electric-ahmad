import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { WorkDiaryStatus, OpsDeliveryNoteStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireOfficeUser();
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind"); // work_diary | delivery_note | all
    const documentNumber = sp.get("documentNumber") || undefined;
    const projectId = sp.get("projectId") || undefined;
    const status = sp.get("status") || undefined;
    const clientName = sp.get("clientName") || undefined;

    const diaries =
      !kind || kind === "all" || kind === "work_diary"
        ? await WorkDiariesRepository.archive({
            documentNumber,
            projectId,
            clientName,
            status: status as WorkDiaryStatus | undefined,
            take: 100,
          })
        : [];

    const notes =
      !kind || kind === "all" || kind === "delivery_note"
        ? (
            await OpsDeliveryNotesRepository.list({
              projectId,
              status: status as OpsDeliveryNoteStatus | undefined,
              take: 100,
            })
          )
            .filter((n) =>
              documentNumber
                ? n.documentNumber.toLowerCase().includes(documentNumber.toLowerCase())
                : true
            )
            .filter((n) =>
              clientName
                ? (n.clientName ?? "").toLowerCase().includes(clientName.toLowerCase())
                : true
            )
            .map((n) => ({
              id: n.id,
              kind: "delivery_note" as const,
              documentNumber: n.documentNumber,
              status: n.status,
              workDate: n.noteDate,
              clientName: n.clientName,
              project: n.project,
              foreman: n.foreman,
              approverName: null as string | null,
              clientSignedAt: null as string | null,
              createdAt: n.createdAt,
            }))
        : [];

    const items = [...diaries, ...notes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
