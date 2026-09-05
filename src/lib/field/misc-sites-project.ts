import { prisma } from "@/lib/prisma";

const MISC_CONTRACT = "__OTHER_SITES__";

/**
 * Internal project bucket for field diaries tagged as "אחר" (unlisted sites).
 * Keeps WorkflowDocument.projectId / archive FKs intact.
 */
export async function ensureMiscSitesProject(actorUserId: string): Promise<string> {
  const existing = await prisma.project.findFirst({
    where: { contractNumber: MISC_CONTRACT },
    select: { id: true },
  });
  if (existing) return existing.id;

  const emp = await prisma.employee.findFirst({
    where: { isDeleted: false, status: "active" },
    select: { id: true },
  });
  if (!emp) {
    throw new Error("לא ניתן לשמור אתר זמני — אין עובדים במערכת");
  }

  const created = await prisma.project.create({
    data: {
      name: "אתרים זמניים",
      contractNumber: MISC_CONTRACT,
      contractor: "פנימי",
      location: "שונים",
      foremanId: emp.id,
      status: "active",
      contractValue: 0,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 50)),
      ownerId: actorUserId,
      createdById: actorUserId,
      updatedById: actorUserId,
    },
    select: { id: true },
  });
  return created.id;
}

export function isMiscSitesProject(contractNumber?: string | null) {
  return contractNumber === MISC_CONTRACT;
}
