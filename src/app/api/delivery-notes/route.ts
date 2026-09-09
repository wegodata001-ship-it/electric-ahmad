import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { assertCanCreateWdOrDnForProject } from "@/lib/auth/cross-project-documents";
import { listProjectsForRole } from "@/lib/auth/project-access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { parseListQuery } from "@/lib/api/list-query";

export async function GET(request: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const sp = request.nextUrl.searchParams;
    const projectId = sp.get("projectId") || undefined;
    const status = sp.get("status");
    const parsed = parseListQuery(sp, { defaultTake: 40, maxTake: 200 });

    // Use paged shape when the client asked for pagination or applied filters
    // beyond bare `projectId`. Otherwise keep the legacy array response for BC.
    const usePaged = parsed.paginated || Boolean(parsed.q) || Boolean(status);
    const assignedProjects =
      session.role === "PROJECT_MANAGER"
        ? await listProjectsForRole({
            userId: session.userId,
            role: session.role,
            mode: "assigned",
          })
        : [];
    const access =
      session.role === "PROJECT_MANAGER"
        ? {
            projectIds: assignedProjects.map((project) => project.id),
            ownedByUserId: session.userId,
          }
        : undefined;

    if (usePaged) {
      const result = await DeliveryNotesRepository.listPage({
        projectId,
        q: parsed.q,
        status,
        take: parsed.take,
        skip: parsed.skip,
        sort: parsed.sort,
        dir: parsed.dir,
        ...access,
      });
      return apiSuccess(result);
    }

    if (projectId) {
      return apiSuccess(
        await DeliveryNotesRepository.findByProject(projectId, access)
      );
    }
    return apiSuccess(await DeliveryNotesRepository.findAll(access));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const body = await request.json();
    if (!hasDocumentPermission(session.role, "create")) {
      return apiError("אין הרשאה ליצירת תעודת משלוח", 403);
    }
    const projectId = body.projectId ? String(body.projectId) : null;
    const creationAccess = projectId
      ? await assertCanCreateWdOrDnForProject(
          session,
          projectId,
          "DELIVERY_NOTE"
        )
      : null;
    const note = await DeliveryNotesRepository.create(
      {
        noteNumber: body.noteNumber,
        date: body.date,
        status: body.status,
        client: body.client,
        clientId: body.clientId,
        projectId,
        createdByRole: session.role,
        createdCrossProject: creationAccess?.crossProject ?? false,
        orderNumber: body.orderNumber,
        contactName: body.contactName,
        phone: body.phone,
        phoneSecondary: body.phoneSecondary,
        address: body.address,
        city: body.city,
        notes: body.notes,
        receiverName: body.receiverName,
        receivedAt: body.receivedAt,
        receiverSignatureUrl: body.receiverSignatureUrl,
        employeeSignatureUrl: body.employeeSignatureUrl,
        employeeSignedName: body.employeeSignedName,
        senderSigned: body.senderSigned,
        receiverSigned: body.receiverSigned,
        driverName: body.driverName,
        driverPhone: body.driverPhone,
        vehicle: body.vehicle,
        vehicleNumber: body.vehicleNumber,
        externalCarrier: body.externalCarrier,
        deliveryTime: body.deliveryTime,
        destination: body.destination,
        destinationAddress: body.destinationAddress,
        driverNotes: body.driverNotes,
        items: Array.isArray(body.items) ? body.items : [],
      },
      session.userId
    );
    return apiSuccess(note, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
