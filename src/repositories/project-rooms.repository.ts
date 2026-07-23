import { prisma } from "@/lib/prisma";

export type ProjectRoomInput = {
  name: string;
  floor?: string | null;
  code?: string | null;
  sortOrder?: number | null;
};

function mapRoom(row: {
  id: string;
  projectId: string;
  name: string;
  floor: string | null;
  code: string | null;
  sortOrder: number;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { sheetRows: number };
  hasReports?: boolean;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    floor: row.floor,
    code: row.code,
    sortOrder: row.sortOrder,
    isHidden: row.isHidden,
    hasReports: row.hasReports ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function roomHasReports(projectRoomId: string): Promise<boolean> {
  const qty = await prisma.measurementCell.count({
    where: {
      row: { projectRoomId },
      NOT: { quantity: 0 },
    },
  });
  return qty > 0;
}

/** מוודא שכל דפי המדידה בפרויקט כוללים שורה מקושרת לחדר */
async function syncRoomToSheets(
  projectId: string,
  room: { id: string; name: string; sortOrder: number }
) {
  const sheets = await prisma.measurementSheet.findMany({
    where: { projectId },
    select: {
      id: true,
      cells: { select: { boqItemId: true }, distinct: ["boqItemId"] },
    },
  });

  for (const sheet of sheets) {
    const existing = await prisma.measurementSheetRow.findFirst({
      where: { sheetId: sheet.id, projectRoomId: room.id },
    });
    if (existing) {
      await prisma.measurementSheetRow.update({
        where: { id: existing.id },
        data: { name: room.name, sortOrder: room.sortOrder },
      });
      continue;
    }

    let boqIds = [...new Set(sheet.cells.map((c) => c.boqItemId))];
    if (!boqIds.length) {
      boqIds = (
        await prisma.boqItem.findMany({
          where: {
            projectId,
            deletedAt: null,
            status: { not: "cancelled" },
          },
          select: { id: true },
        })
      ).map((b) => b.id);
    }

    const row = await prisma.measurementSheetRow.create({
      data: {
        sheetId: sheet.id,
        name: room.name,
        sortOrder: room.sortOrder,
        projectRoomId: room.id,
      },
    });

    if (boqIds.length) {
      await prisma.measurementCell.createMany({
        data: boqIds.map((boqItemId) => ({
          sheetId: sheet.id,
          rowId: row.id,
          boqItemId,
          quantity: 0,
        })),
        skipDuplicates: true,
      });
    }
  }
}

export const ProjectRoomsRepository = {
  async list(projectId: string, opts?: { includeHidden?: boolean }) {
    await this.ensureMigrated(projectId);
    const rows = await prisma.projectRoom.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(opts?.includeHidden ? {} : { isHidden: false }),
      },
      orderBy: { sortOrder: "asc" },
    });
    const withFlags = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        hasReports: await roomHasReports(r.id),
      }))
    );
    return withFlags.map(mapRoom);
  },

  /** מיגרציה חד-פעמית: שורות דף מדידה קיימות → ProjectRoom */
  async ensureMigrated(projectId: string) {
    const existingCount = await prisma.projectRoom.count({
      where: { projectId, deletedAt: null },
    });
    if (existingCount > 0) {
      // קישור שורות יתומות לפי שם
      const rooms = await prisma.projectRoom.findMany({
        where: { projectId, deletedAt: null },
      });
      const byName = new Map(rooms.map((r) => [r.name.trim(), r]));
      const orphanRows = await prisma.measurementSheetRow.findMany({
        where: {
          projectRoomId: null,
          sheet: { projectId },
        },
      });
      for (const row of orphanRows) {
        const match = byName.get(row.name.trim());
        if (match) {
          await prisma.measurementSheetRow.update({
            where: { id: row.id },
            data: { projectRoomId: match.id, sortOrder: match.sortOrder },
          });
        } else {
          const created = await prisma.projectRoom.create({
            data: {
              projectId,
              name: row.name.trim(),
              sortOrder: row.sortOrder,
            },
          });
          byName.set(created.name, created);
          await prisma.measurementSheetRow.update({
            where: { id: row.id },
            data: { projectRoomId: created.id },
          });
        }
      }
      return;
    }

    const sheetRows = await prisma.measurementSheetRow.findMany({
      where: { sheet: { projectId } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (!sheetRows.length) return;

    const seen = new Map<string, string>(); // name -> roomId
    let sort = 0;
    for (const row of sheetRows) {
      const key = row.name.trim();
      let roomId = seen.get(key);
      if (!roomId) {
        const created = await prisma.projectRoom.create({
          data: {
            projectId,
            name: key,
            sortOrder: sort++,
          },
        });
        roomId = created.id;
        seen.set(key, roomId);
      }
      if (!row.projectRoomId) {
        await prisma.measurementSheetRow.update({
          where: { id: row.id },
          data: { projectRoomId: roomId },
        });
      }
    }
  },

  async create(projectId: string, input: ProjectRoomInput) {
    const name = input.name.trim();
    if (!name) throw new Error("שם החדר חובה");

    await this.ensureMigrated(projectId);

    const last = await prisma.projectRoom.findFirst({
      where: { projectId, deletedAt: null },
      orderBy: { sortOrder: "desc" },
    });
    const sortOrder =
      input.sortOrder != null && !Number.isNaN(Number(input.sortOrder))
        ? Number(input.sortOrder)
        : (last?.sortOrder ?? -1) + 1;

    const room = await prisma.projectRoom.create({
      data: {
        projectId,
        name,
        floor: input.floor?.trim() || null,
        code: input.code?.trim() || null,
        sortOrder,
      },
    });

    await syncRoomToSheets(projectId, room);
    return mapRoom({ ...room, hasReports: false });
  },

  async update(
    id: string,
    input: Partial<ProjectRoomInput> & { isHidden?: boolean }
  ) {
    const existing = await prisma.projectRoom.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("חדר לא נמצא");

    const data: {
      name?: string;
      floor?: string | null;
      code?: string | null;
      sortOrder?: number;
      isHidden?: boolean;
    } = {};
    if (input.name != null) {
      const name = input.name.trim();
      if (!name) throw new Error("שם החדר חובה");
      data.name = name;
    }
    if (input.floor !== undefined) data.floor = input.floor?.trim() || null;
    if (input.code !== undefined) data.code = input.code?.trim() || null;
    if (input.sortOrder != null && !Number.isNaN(Number(input.sortOrder))) {
      data.sortOrder = Number(input.sortOrder);
    }
    if (input.isHidden != null) data.isHidden = Boolean(input.isHidden);

    const room = await prisma.projectRoom.update({
      where: { id },
      data,
    });

    await prisma.measurementSheetRow.updateMany({
      where: { projectRoomId: id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      },
    });

    return mapRoom({
      ...room,
      hasReports: await roomHasReports(id),
    });
  },

  async reorder(projectId: string, orderedIds: string[]) {
    const rooms = await prisma.projectRoom.findMany({
      where: { projectId, deletedAt: null, id: { in: orderedIds } },
    });
    if (rooms.length !== orderedIds.length) {
      throw new Error("רשימת חדרים לא תקינה");
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.projectRoom.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.measurementSheetRow.updateMany({
          where: { projectRoomId: id },
          data: { sortOrder: index },
        })
      )
    );

    return this.list(projectId, { includeHidden: true });
  },

  async move(id: string, direction: "left" | "right" | "up" | "down") {
    const room = await prisma.projectRoom.findFirst({
      where: { id, deletedAt: null },
    });
    if (!room) throw new Error("חדר לא נמצא");

    const siblings = await prisma.projectRoom.findMany({
      where: { projectId: room.projectId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
    });
    const idx = siblings.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error("חדר לא נמצא");

    const delta =
      direction === "left" || direction === "up" ? -1 : 1;
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= siblings.length) {
      return this.list(room.projectId, { includeHidden: true });
    }

    const ids = siblings.map((r) => r.id);
    const tmp = ids[idx];
    ids[idx] = ids[swapIdx];
    ids[swapIdx] = tmp;
    return this.reorder(room.projectId, ids);
  },

  async softDelete(id: string) {
    const existing = await prisma.projectRoom.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("חדר לא נמצא");

    if (await roomHasReports(id)) {
      throw new Error(
        "לא ניתן למחוק חדר שכבר קיימים עבורו דיווחי ביצוע. ניתן להסתיר אותו בלבד."
      );
    }

    await prisma.$transaction(async (tx) => {
      const rows = await tx.measurementSheetRow.findMany({
        where: { projectRoomId: id },
        select: { id: true },
      });
      const rowIds = rows.map((r) => r.id);
      if (rowIds.length) {
        await tx.measurementCell.deleteMany({ where: { rowId: { in: rowIds } } });
        await tx.measurementSheetRow.deleteMany({
          where: { id: { in: rowIds } },
        });
      }
      await tx.projectRoom.update({
        where: { id },
        data: { deletedAt: new Date(), isHidden: true },
      });
    });

    return { ok: true };
  },
};
