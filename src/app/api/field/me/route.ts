import { requireFieldManager } from "@/lib/auth/field-session";
import { FieldAttendanceRepository } from "@/repositories/field-attendance.repository";
import { FieldCrewRepository } from "@/repositories/field-crew.repository";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireFieldManager();

    // Company-wide projects — manager is not locked to one project.
    // Hide internal "אחר" bucket used for unlisted temporary sites.
    const projects = await prisma.project.findMany({
      where: {
        status: { in: ["active", "planning"] },
        contractNumber: { not: "__OTHER_SITES__" },
      },
      select: {
        id: true,
        name: true,
        location: true,
        contractor: true,
      },
      orderBy: { name: "asc" },
    });

    const attendance = await FieldAttendanceRepository.getOpen(
      session.foremanId
    );
    const crew = await FieldCrewRepository.listActive(session.foremanId);

    return apiSuccess({
      foreman: {
        id: session.foremanId,
        name: session.foremanName,
        phone: session.phone,
        username: session.username,
        userId: session.userId,
      },
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        location: p.location,
        contractor: p.contractor,
      })),
      crewCount: crew.length,
      openJournal: null, // removed WorkJournal
      attendance,
      checkedIn: !!attendance,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
