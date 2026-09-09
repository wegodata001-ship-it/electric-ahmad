import { prisma } from "../src/lib/prisma";
import {
  canViewTimelineEvent,
  DocumentTimelineRepository,
} from "../src/repositories/document-timeline.repository";

async function main() {
  const systemUser = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      role: { in: ["SYSTEM_MANAGER", "ADMIN", "admin", "מנהל מערכת"] },
    },
    select: { id: true, name: true, role: true },
  });
  if (!systemUser) throw new Error("No active system manager found");

  const global = await DocumentTimelineRepository.list(
    {
      userId: systemUser.id,
      userName: systemUser.name,
      role: systemUser.role,
      employeeId: null,
    },
    { period: "all", take: 500 }
  );
  const sample = global.items[0];
  if (!sample) throw new Error("Timeline has no events");

  const projectFiltered = sample.projectId
    ? await DocumentTimelineRepository.list(
        {
          userId: systemUser.id,
          userName: systemUser.name,
          role: systemUser.role,
          employeeId: null,
        },
        { period: "all", projectId: sample.projectId, take: 500 }
      )
    : { items: [] };
  const kindFiltered = await DocumentTimelineRepository.list(
    {
      userId: systemUser.id,
      userName: systemUser.name,
      role: systemUser.role,
      employeeId: null,
    },
    { period: "all", kind: sample.kind, take: 500 }
  );
  const statusFiltered = await DocumentTimelineRepository.list(
    {
      userId: systemUser.id,
      userName: systemUser.name,
      role: systemUser.role,
      employeeId: null,
    },
    { period: "all", category: sample.category, take: 500 }
  );
  const searched = await DocumentTimelineRepository.list(
    {
      userId: systemUser.id,
      userName: systemUser.name,
      role: systemUser.role,
      employeeId: null,
    },
    { period: "all", query: sample.documentNumber, take: 500 }
  );
  const detail = await DocumentTimelineRepository.list(
    {
      userId: systemUser.id,
      userName: systemUser.name,
      role: systemUser.role,
      employeeId: null,
    },
    { period: "all", documentKey: sample.documentKey, take: 500 }
  );

  const duplicateKeys = new Set<string>();
  const seen = new Set<string>();
  for (const event of global.items) {
    const key = [
      event.documentKey,
      event.category,
      event.action.replace(/[^a-z0-9א-ת]/gi, "").toLowerCase(),
      event.occurredAt.slice(0, 16),
    ].join(":");
    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
  }

  const pm = await prisma.user.findFirst({
    where: { status: "ACTIVE", role: "PROJECT_MANAGER" },
    select: { id: true, name: true, role: true },
  });
  let pmScope: boolean | null = null;
  let ownershipException: boolean | null = null;
  if (pm) {
    const [pmTimeline, assigned, crossProjectDocuments] = await Promise.all([
      DocumentTimelineRepository.list(
        {
          userId: pm.id,
          userName: pm.name,
          role: pm.role,
          employeeId: null,
        },
        { period: "all", take: 500 }
      ),
      prisma.project.findMany({
        where: { ownerId: pm.id, deletedAt: null },
        select: { id: true },
      }),
      Promise.all([
        prisma.workDiary.findMany({
          where: { createdById: pm.id, createdCrossProject: true },
          select: { id: true },
        }),
        prisma.opsDeliveryNote.findMany({
          where: { createdById: pm.id, createdCrossProject: true },
          select: { id: true },
        }),
      ]),
    ]);
    const assignedIds = new Set(assigned.map((project) => project.id));
    pmScope = pmTimeline.items.every(
      (event) =>
        (event.projectId ? assignedIds.has(event.projectId) : false) ||
        ((event.kind === "work_diary" ||
          event.kind === "delivery_note") &&
          event.createdById === pm.id)
    );
    const exceptionIds = new Set([
      ...crossProjectDocuments[0].map((row) => `work_diary:${row.id}`),
      ...crossProjectDocuments[1].map((row) => `delivery_note:${row.id}`),
    ]);
    ownershipException =
      exceptionIds.size > 0
        ? pmTimeline.items.some((event) => exceptionIds.has(event.documentKey))
        : canViewTimelineEvent(
            {
              ...sample,
              kind: "work_diary",
              projectId: "unassigned-project",
              createdById: pm.id,
            },
            {
              userId: pm.id,
              userName: pm.name,
              role: pm.role,
              employeeId: null,
            },
            new Set()
          ) &&
          !canViewTimelineEvent(
            {
              ...sample,
              kind: "measurement",
              projectId: "unassigned-project",
              createdById: pm.id,
            },
            {
              userId: pm.id,
              userName: pm.name,
              role: pm.role,
              employeeId: null,
            },
            new Set()
          );
  }

  const fieldUser = await prisma.user.findFirst({
    where: { status: "ACTIVE", role: "FIELD_MANAGER", employee: { isNot: null } },
    select: {
      id: true,
      name: true,
      role: true,
      employee: { select: { id: true } },
    },
  });
  let fieldScope: boolean | null = null;
  if (fieldUser?.employee) {
    const [fieldTimeline, diaries, notes, sheets] = await Promise.all([
      DocumentTimelineRepository.list(
        {
          userId: fieldUser.id,
          userName: fieldUser.name,
          role: fieldUser.role,
          employeeId: fieldUser.employee.id,
        },
        { period: "all", take: 500 }
      ),
      prisma.workDiary.findMany({
        where: { foremanId: fieldUser.employee.id, deletedAt: null },
        select: { id: true },
      }),
      prisma.opsDeliveryNote.findMany({
        where: { foremanId: fieldUser.employee.id, deletedAt: null },
        select: { id: true },
      }),
      prisma.measurementSheet.findMany({
        where: {
          approvals: {
            some: { approverId: fieldUser.id, status: "pending" },
          },
        },
        select: { id: true },
      }),
    ]);
    const allowedKeys = new Set([
      ...diaries.map((row) => `work_diary:${row.id}`),
      ...notes.map((row) => `delivery_note:${row.id}`),
      ...sheets.map((row) => `measurement:${row.id}`),
    ]);
    fieldScope = fieldTimeline.items.every(
      (event) =>
        allowedKeys.has(event.documentKey) &&
        event.documentUrl.startsWith("/field/")
    );
  }

  const driver = await prisma.user.findFirst({
    where: { status: "ACTIVE", role: "TRUCK_DRIVER" },
    select: { id: true, name: true, role: true },
  });
  let driverScope: boolean | null = null;
  if (driver) {
    const driverTimeline = await DocumentTimelineRepository.list(
      {
        userId: driver.id,
        userName: driver.name,
        role: driver.role,
        employeeId: null,
      },
      { period: "all", take: 500 }
    );
    driverScope = driverTimeline.items.every(
      (event) =>
        event.kind === "delivery_note" && event.createdById === driver.id
    );
  }

  const kinds = new Set(global.items.map((event) => event.kind));
  console.log(
    JSON.stringify(
      {
        globalTimeline: global.items.length > 0,
        totalEvents: global.items.length,
        projectFilter:
          projectFiltered.items.length > 0 &&
          projectFiltered.items.every(
            (event) => event.projectId === sample.projectId
          ),
        documentTypeFilter:
          kindFiltered.items.length > 0 &&
          kindFiltered.items.every((event) => event.kind === sample.kind),
        statusFilter:
          statusFiltered.items.length > 0 &&
          statusFiltered.items.every(
            (event) => event.category === sample.category
          ),
        search:
          searched.items.length > 0 &&
          searched.items.every((event) =>
            event.documentNumber
              .toLowerCase()
              .includes(sample.documentNumber.toLowerCase())
          ),
        documentTimeline:
          detail.items.length > 0 &&
          detail.items.every(
            (event) => event.documentKey === sample.documentKey
          ),
        returnForCorrectionHistory: global.items.some(
          (event) => event.category === "revision"
        ),
        correctionReasonVisible: global.items.some(
          (event) => event.category === "revision" && Boolean(event.note)
        ),
        approvalHistory: global.items.some(
          (event) => event.source === "approval"
        ),
        kinds: {
          workDiary: kinds.has("work_diary"),
          deliveryNote: kinds.has("delivery_note"),
          measurement: kinds.has("measurement"),
          invoice: kinds.has("invoice"),
        },
        projectManagerScope: pmScope,
        wdDnOwnershipException: ownershipException,
        fieldManagerScope: fieldScope,
        truckDriverScope: driverScope,
        duplicateNormalizedEvents: duplicateKeys.size,
        summary: global.summary,
      },
      null,
      2
    )
  );
}

void main().finally(() => prisma.$disconnect());
