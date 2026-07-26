import { prisma } from "@/lib/prisma";

export type ProjectRoomInput = {
  name: string;
  floor?: string | null;
  code?: string | null;
  sortOrder?: number | null;
};

export type ProjectRoomsListResult =
  | {
      status: "ok";
      items: ReturnType<typeof mapRoom>[];
    }
  | { status: "forbidden" };

function mapRoom(row: {
  id: string;
  projectId: string;
  name: string;
  floor: string | null;
  code: string | null;
  sortOrder: number;
  isHidden: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  hasReports?: boolean;
}) {
  const createdAt =
    typeof row.createdAt === "string"
      ? row.createdAt
      : row.createdAt.toISOString();
  const updatedAt =
    typeof row.updatedAt === "string"
      ? row.updatedAt
      : row.updatedAt.toISOString();
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    floor: row.floor,
    code: row.code,
    sortOrder: row.sortOrder,
    isHidden: row.isHidden,
    hasReports: row.hasReports ?? false,
    createdAt,
    updatedAt,
  };
}

async function roomHasReports(projectRoomId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM "MeasurementCell" mc
      INNER JOIN "MeasurementSheetRow" msr ON msr.id = mc."rowId"
      WHERE msr."projectRoomId" = ${projectRoomId}
        AND mc.quantity <> 0
    ) AS ok
  `;
  return Boolean(rows[0]?.ok);
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

type RoomSqlRow = {
  id: string;
  projectId: string;
  name: string;
  floor: string | null;
  code: string | null;
  sortOrder: number;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
  hasReports: boolean;
  authUserId: string | null;
};

export const ProjectRoomsRepository = {
  /**
   * Hot path: HMAC session user + office auth + orphan link + rooms + hasReports
   * in one SQL round-trip. Response shape unchanged: { items }.
   */
  async listForOffice(
    projectId: string,
    officeUserId: string,
    opts?: { includeHidden?: boolean }
  ): Promise<ProjectRoomsListResult> {
    const includeHidden = Boolean(opts?.includeHidden);
    const rows = await prisma.$queryRaw<RoomSqlRow[]>`
      WITH auth AS (
        SELECT u.id AS user_id
        FROM "User" u
        LEFT JOIN "Employee" emp ON emp."userId" = u.id
        WHERE u.id = ${officeUserId}
          AND u."passwordHash" IS NOT NULL
          AND u.role IN (
            'PROJECT_MANAGER',
            'OPERATIONS_MANAGER',
            'ADMIN',
            'SYSTEM_MANAGER',
            'admin',
            'מנהל מערכת'
          )
          AND (
            emp.id IS NULL
            OR (emp."isDeleted" = false AND emp.status = 'active')
          )
      ),
      -- Link orphan sheet rows to existing rooms by trimmed name (idempotent)
      link_orphans AS (
        UPDATE "MeasurementSheetRow" msr
        SET
          "projectRoomId" = pr.id,
          "sortOrder" = pr."sortOrder"
        FROM "ProjectRoom" pr, "MeasurementSheet" s
        WHERE s.id = msr."sheetId"
          AND pr."projectId" = ${projectId}
          AND pr."deletedAt" IS NULL
          AND s."projectId" = ${projectId}
          AND msr."projectRoomId" IS NULL
          AND btrim(msr.name) = btrim(pr.name)
          AND EXISTS (SELECT 1 FROM auth)
        RETURNING msr.id
      ),
      gate AS (
        SELECT (SELECT user_id FROM auth LIMIT 1) AS "authUserId"
      ),
      rooms AS (
        SELECT
          r.id,
          r."projectId",
          r.name,
          r.floor,
          r.code,
          r."sortOrder",
          r."isHidden",
          r."createdAt",
          r."updatedAt",
          EXISTS (
            SELECT 1
            FROM "MeasurementSheetRow" msr
            INNER JOIN "MeasurementCell" mc ON mc."rowId" = msr.id
            WHERE msr."projectRoomId" = r.id
              AND mc.quantity <> 0
          ) AS "hasReports",
          g."authUserId"
        FROM "ProjectRoom" r
        CROSS JOIN gate g
        WHERE r."projectId" = ${projectId}
          AND r."deletedAt" IS NULL
          AND (
            ${includeHidden}::boolean = true
            OR r."isHidden" = false
          )
          AND g."authUserId" IS NOT NULL
        ORDER BY r."sortOrder" ASC
      )
      SELECT
        r.id,
        r."projectId",
        r.name,
        r.floor,
        r.code,
        r."sortOrder",
        r."isHidden",
        r."createdAt",
        r."updatedAt",
        r."hasReports",
        COALESCE(r."authUserId", g."authUserId") AS "authUserId"
      FROM gate g
      LEFT JOIN rooms r ON true
    `;

    const authUserId = rows[0]?.authUserId ?? null;
    if (!authUserId) return { status: "forbidden" };

    const items = rows
      .filter((r) => r.id != null)
      .map((r) =>
        mapRoom({
          id: r.id,
          projectId: r.projectId,
          name: r.name!,
          floor: r.floor,
          code: r.code,
          sortOrder: r.sortOrder,
          isHidden: r.isHidden,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          hasReports: r.hasReports,
        })
      );

    // Rare bootstrap: no ProjectRoom yet but sheet rows exist — keep prior logic
    if (!items.length) {
      await this.ensureMigrated(projectId);
      const again = await this.listWithFlags(projectId, opts);
      return { status: "ok", items: again };
    }

    return { status: "ok", items };
  },

  async list(projectId: string, opts?: { includeHidden?: boolean }) {
    await this.ensureMigrated(projectId);
    return this.listWithFlags(projectId, opts);
  },

  /** Single-query list + hasReports (no auth) — used after mutations / bootstrap */
  async listWithFlags(projectId: string, opts?: { includeHidden?: boolean }) {
    const includeHidden = Boolean(opts?.includeHidden);
    const rows = await prisma.$queryRaw<
      Omit<RoomSqlRow, "authUserId">[]
    >`
      SELECT
        r.id,
        r."projectId",
        r.name,
        r.floor,
        r.code,
        r."sortOrder",
        r."isHidden",
        r."createdAt",
        r."updatedAt",
        EXISTS (
          SELECT 1
          FROM "MeasurementSheetRow" msr
          INNER JOIN "MeasurementCell" mc ON mc."rowId" = msr.id
          WHERE msr."projectRoomId" = r.id
            AND mc.quantity <> 0
        ) AS "hasReports"
      FROM "ProjectRoom" r
      WHERE r."projectId" = ${projectId}
        AND r."deletedAt" IS NULL
        AND (
          ${includeHidden}::boolean = true
          OR r."isHidden" = false
        )
      ORDER BY r."sortOrder" ASC
    `;
    return rows.map((r) =>
      mapRoom({
        ...r,
        hasReports: r.hasReports,
      })
    );
  },

  /**
   * Migration — optimized: bulk orphan link when rooms exist.
   * Full bootstrap only when zero rooms (rare).
   */
  async ensureMigrated(projectId: string) {
    const stats = await prisma.$queryRaw<
      { rooms: number; orphans: number }[]
    >`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "ProjectRoom"
          WHERE "projectId" = ${projectId} AND "deletedAt" IS NULL
        ) AS rooms,
        (
          SELECT COUNT(*)::int
          FROM "MeasurementSheetRow" msr
          INNER JOIN "MeasurementSheet" s ON s.id = msr."sheetId"
          WHERE s."projectId" = ${projectId}
            AND msr."projectRoomId" IS NULL
        ) AS orphans
    `;
    const rooms = Number(stats[0]?.rooms ?? 0);
    const orphans = Number(stats[0]?.orphans ?? 0);

    if (rooms > 0 && orphans === 0) return;

    if (rooms > 0 && orphans > 0) {
      // Bulk link by name + create rooms for unmatched orphan names
      await prisma.$executeRaw`
        WITH unmatched AS (
          SELECT DISTINCT ON (btrim(msr.name))
            btrim(msr.name) AS name,
            msr."sortOrder" AS "sortOrder"
          FROM "MeasurementSheetRow" msr
          INNER JOIN "MeasurementSheet" s ON s.id = msr."sheetId"
          WHERE s."projectId" = ${projectId}
            AND msr."projectRoomId" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "ProjectRoom" pr
              WHERE pr."projectId" = ${projectId}
                AND pr."deletedAt" IS NULL
                AND btrim(pr.name) = btrim(msr.name)
            )
          ORDER BY btrim(msr.name), msr."sortOrder"
        ),
        created AS (
          INSERT INTO "ProjectRoom" (
            id, "projectId", name, "sortOrder", "isHidden", "createdAt", "updatedAt"
          )
          SELECT
            replace(gen_random_uuid()::text, '-', ''),
            ${projectId},
            u.name,
            u."sortOrder",
            false,
            NOW(),
            NOW()
          FROM unmatched u
          RETURNING id, name
        ),
        linked AS (
          UPDATE "MeasurementSheetRow" msr
          SET
            "projectRoomId" = pr.id,
            "sortOrder" = pr."sortOrder"
          FROM "ProjectRoom" pr, "MeasurementSheet" s
          WHERE s.id = msr."sheetId"
            AND pr."projectId" = ${projectId}
            AND pr."deletedAt" IS NULL
            AND s."projectId" = ${projectId}
            AND msr."projectRoomId" IS NULL
            AND btrim(msr.name) = btrim(pr.name)
          RETURNING msr.id
        )
        SELECT 1
      `;
      return;
    }

    // Zero rooms — bootstrap from sheet rows (legacy one-time)
    const sheetRows = await prisma.measurementSheetRow.findMany({
      where: { sheet: { projectId } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (!sheetRows.length) return;

    const seen = new Map<string, string>();
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

    return this.listWithFlags(projectId, { includeHidden: true });
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

    const delta = direction === "left" || direction === "up" ? -1 : 1;
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= siblings.length) {
      return this.listWithFlags(room.projectId, { includeHidden: true });
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
