import { prisma } from "@/lib/prisma";
import { AuditRepository } from "./audit.repository";

export type FieldCrewInput = {
  name: string;
  phone?: string;
  profession?: string;
  status?: string;
  notes?: string;
};

function mapCrew(row: {
  id: string;
  managerId: string;
  name: string;
  phone: string | null;
  profession: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    managerId: row.managerId,
    name: row.name,
    phone: row.phone ?? "",
    profession: row.profession ?? "",
    status: row.status,
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class FieldCrewRepository {
  static async list(managerId: string) {
    const rows = await prisma.fieldCrewMember.findMany({
      where: { managerId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
    return rows.map(mapCrew);
  }

  static async listActive(managerId: string) {
    const rows = await prisma.fieldCrewMember.findMany({
      where: { managerId, status: "active" },
      orderBy: { name: "asc" },
    });
    return rows.map(mapCrew);
  }

  static async create(
    managerId: string,
    input: FieldCrewInput,
    userId: string
  ) {
    const name = input.name.trim();
    if (!name) throw new Error("שם עובד חובה");

    const row = await prisma.fieldCrewMember.create({
      data: {
        managerId,
        name,
        phone: input.phone?.trim() || null,
        profession: input.profession?.trim() || null,
        status: input.status?.trim() || "active",
        notes: input.notes?.trim() || null,
      },
    });

    await AuditRepository.log({
      action: "CREATE",
      entityType: "FieldCrewMember",
      entityId: row.id,
      userId,
      metadata: { managerId, name },
    });

    return mapCrew(row);
  }

  static async update(
    id: string,
    managerId: string,
    input: Partial<FieldCrewInput>,
    userId: string
  ) {
    const existing = await prisma.fieldCrewMember.findUnique({ where: { id } });
    if (!existing || existing.managerId !== managerId) {
      throw new Error("עובד לא נמצא");
    }

    const row = await prisma.fieldCrewMember.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        phone:
          input.phone !== undefined ? input.phone.trim() || null : undefined,
        profession:
          input.profession !== undefined
            ? input.profession.trim() || null
            : undefined,
        status: input.status !== undefined ? input.status.trim() : undefined,
        notes:
          input.notes !== undefined ? input.notes.trim() || null : undefined,
      },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "FieldCrewMember",
      entityId: id,
      userId,
      metadata: { managerId },
    });

    return mapCrew(row);
  }

  static async remove(id: string, managerId: string, userId: string) {
    const existing = await prisma.fieldCrewMember.findUnique({ where: { id } });
    if (!existing || existing.managerId !== managerId) {
      throw new Error("עובד לא נמצא");
    }
    await prisma.fieldCrewMember.delete({ where: { id } });
    await AuditRepository.log({
      action: "DELETE",
      entityType: "FieldCrewMember",
      entityId: id,
      userId,
      metadata: { managerId },
    });
  }
}
