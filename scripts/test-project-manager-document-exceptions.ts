import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  OFFICE_SESSION_COOKIE,
  signOfficeSession,
} from "../src/lib/auth/office-cookie";

const BASE_URL = process.env.USER_MANAGEMENT_QA_URL ?? "http://localhost:3000";
const runId = Date.now().toString(36);
const userIds: string[] = [];
const documentIds: string[] = [];
const workflowIds: string[] = [];
const originalProjects = new Map<
  string,
  { ownerId: string; updatedById: string }
>();
const results: Record<string, boolean> = {};
let userSequence = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  cookie?: string
) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && typeof options.body === "string"
        ? { "content-type": "application/json" }
        : {}),
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
  });
  const json = (await response.json().catch(() => null)) as
    | { success: boolean; data?: T; error?: string }
    | null;
  return { response, json };
}

async function makeUser(role: string, name: string) {
  userSequence += 1;
  const identity = `${role.toLowerCase()}-${userSequence}-${runId}`;
  const user = await prisma.user.create({
    data: {
      name,
      username: `qa-${identity}`,
      email: `qa-${identity}@test.invalid`,
      passwordHash: "qa-session-only",
      role,
      status: "ACTIVE",
    },
    select: { id: true, role: true, sessionVersion: true },
  });
  userIds.push(user.id);
  const token = await signOfficeSession({
    userId: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  return {
    ...user,
    cookie: `${OFFICE_SESSION_COOKIE}=${token}`,
  };
}

async function main() {
  const [projectA, projectC] = await prisma.project.findMany({
    where: {
      deletedAt: null,
      status: "active",
      contractNumber: { not: "__OTHER_SITES__" },
    },
    select: { id: true, ownerId: true, updatedById: true, name: true },
    take: 2,
    orderBy: { createdAt: "asc" },
  });
  assert(projectA && projectC, "Two active projects are required");
  const foreman = await prisma.employee.findFirst({
    where: { isDeleted: false, status: "active", role: "foreman" },
    select: { id: true },
  });
  assert(foreman, "An active foreman is required");
  originalProjects.set(projectA.id, {
    ownerId: projectA.ownerId,
    updatedById: projectA.updatedById,
  });
  originalProjects.set(projectC.id, {
    ownerId: projectC.ownerId,
    updatedById: projectC.updatedById,
  });

  const pm = await makeUser("PROJECT_MANAGER", `QA PM ${runId}`);
  const other = await makeUser("PROJECT_MANAGER", `QA Other PM ${runId}`);
  const operations = await makeUser(
    "OPERATIONS_MANAGER",
    `QA Operations ${runId}`
  );
  await prisma.project.update({
    where: { id: projectA.id },
    data: { ownerId: pm.id, updatedById: pm.id },
  });

  const projectList = await request<{ id: string }[]>(
    "/api/projects",
    {},
    pm.cookie
  );
  const listedProjects = projectList.json?.data ?? [];
  results["PM PROJECT A VISIBLE"] = listedProjects.some(
    (project) => project.id === projectA.id
  );
  results["PM PROJECT C HIDDEN"] = !listedProjects.some(
    (project) => project.id === projectC.id
  );

  const directC = await request(`/api/projects/${projectC.id}`, {}, pm.cookie);
  results["PM DIRECT PROJECT C 403"] = directC.response.status === 403;
  const measurementsC = await request(
    `/api/measurement-sheets?projectId=${projectC.id}`,
    {},
    pm.cookie
  );
  results["PM PROJECT C MEASUREMENTS BLOCKED"] =
    measurementsC.response.status === 403;
  const invoicesC = await request(
    `/api/partial-invoices?projectId=${projectC.id}`,
    {},
    pm.cookie
  );
  results["PM PROJECT C INVOICES BLOCKED"] =
    invoicesC.response.status === 403;

  const selector = await request<{
    projects: { id: string; assigned: boolean }[];
  }>("/api/document-creation-projects", {}, pm.cookie);
  const selectorProjects = selector.json?.data?.projects ?? [];
  results["WD/DN SELECTOR INCLUDES A"] = selectorProjects.some(
    (project) => project.id === projectA.id && project.assigned
  );
  results["WD/DN SELECTOR INCLUDES C"] = selectorProjects.some(
    (project) => project.id === projectC.id && !project.assigned
  );

  const ownWd = await request<{ id: string; workflowDocumentId?: string }>(
    "/api/work-diaries",
    {
      method: "POST",
      body: JSON.stringify({
        projectId: projectC.id,
        foremanId: foreman.id,
        workDate: new Date().toISOString(),
        workSummary: `QA cross project ${runId}`,
      }),
    },
    pm.cookie
  );
  assert(
    ownWd.response.status === 201 && ownWd.json?.data,
    `Create cross-project WD failed: ${ownWd.json?.error}`
  );
  documentIds.push(ownWd.json.data.id);
  if (ownWd.json.data.workflowDocumentId) {
    workflowIds.push(ownWd.json.data.workflowDocumentId);
  }
  results["PM CREATE WD FOR C"] = true;
  results["PM OPEN OWN WD FOR C"] =
    (
      await request(
        `/api/work-diaries/${ownWd.json.data.id}`,
        {},
        pm.cookie
      )
    ).response.status === 200;
  results["PM EDIT OWN WD FOR C"] =
    (
      await request(
        `/api/work-diaries/${ownWd.json.data.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ notes: `updated-${runId}` }),
        },
        pm.cookie
      )
    ).response.status === 200;
  results["PM PDF OWN WD FOR C"] =
    (
      await fetch(`${BASE_URL}/print/work-diaries/${ownWd.json.data.id}`, {
        headers: { cookie: pm.cookie },
      })
    ).status === 200;

  const otherWd = await request<{ id: string; workflowDocumentId?: string }>(
    "/api/work-diaries",
    {
      method: "POST",
      body: JSON.stringify({
        projectId: projectC.id,
        foremanId: foreman.id,
        workDate: new Date().toISOString(),
        workSummary: `QA other ${runId}`,
      }),
    },
    other.cookie
  );
  assert(otherWd.response.status === 201 && otherWd.json?.data, "Other WD failed");
  documentIds.push(otherWd.json.data.id);
  if (otherWd.json.data.workflowDocumentId) {
    workflowIds.push(otherWd.json.data.workflowDocumentId);
  }
  results["PM OTHER USER WD BLOCKED"] =
    (
      await request(
        `/api/work-diaries/${otherWd.json.data.id}`,
        {},
        pm.cookie
      )
    ).response.status === 403;
  const ownWdReview = await request<{
    related: { documents: unknown[]; photos: unknown[] };
  }>(
    `/api/approvals/review?kind=work_diary&documentId=${ownWd.json.data.id}`,
    {},
    pm.cookie
  );
  results["PM OWN WD REVIEW WITHOUT PROJECT LEAK"] =
    ownWdReview.response.status === 200 &&
    ownWdReview.json?.data?.related.documents.length === 0 &&
    ownWdReview.json.data.related.photos.length === 0;
  results["PM OTHER USER WD REVIEW BLOCKED"] =
    (
      await request(
        `/api/approvals/review?kind=work_diary&documentId=${otherWd.json.data.id}`,
        {},
        pm.cookie
      )
    ).response.status === 403;

  const ownDn = await request<{ id: string }>(
    "/api/ops-delivery-notes",
    {
      method: "POST",
      body: JSON.stringify({
        projectId: projectC.id,
        foremanId: foreman.id,
        noteDate: new Date().toISOString(),
        clientName: "QA Client",
        items: [{ description: `QA item ${runId}`, quantity: 1 }],
      }),
    },
    pm.cookie
  );
  assert(
    ownDn.response.status === 201 && ownDn.json?.data,
    `Create cross-project DN failed: ${ownDn.json?.error}`
  );
  documentIds.push(ownDn.json.data.id);
  results["PM CREATE DN FOR C"] = true;
  results["PM OPEN OWN DN FOR C"] =
    (
      await request(
        `/api/ops-delivery-notes/${ownDn.json.data.id}`,
        {},
        pm.cookie
      )
    ).response.status === 200;
  results["PM PDF OWN DN FOR C"] =
    (
      await fetch(
        `${BASE_URL}/print/ops-delivery-notes/${ownDn.json.data.id}`,
        { headers: { cookie: pm.cookie } }
      )
    ).status === 200;

  const otherDn = await request<{ id: string }>(
    "/api/ops-delivery-notes",
    {
      method: "POST",
      body: JSON.stringify({
        projectId: projectC.id,
        foremanId: foreman.id,
        noteDate: new Date().toISOString(),
        clientName: "QA Other Client",
        items: [{ description: `QA other item ${runId}`, quantity: 1 }],
      }),
    },
    other.cookie
  );
  assert(otherDn.response.status === 201 && otherDn.json?.data, "Other DN failed");
  documentIds.push(otherDn.json.data.id);
  results["PM OTHER USER DN BLOCKED"] =
    (
      await request(
        `/api/ops-delivery-notes/${otherDn.json.data.id}`,
        {},
        pm.cookie
      )
    ).response.status === 403;
  const ownDnReview = await request<{
    related: { documents: unknown[]; photos: unknown[] };
  }>(
    `/api/approvals/review?kind=delivery_note&documentId=${ownDn.json.data.id}`,
    {},
    pm.cookie
  );
  results["PM OWN DN REVIEW WITHOUT PROJECT LEAK"] =
    ownDnReview.response.status === 200 &&
    ownDnReview.json?.data?.related.documents.length === 0 &&
    ownDnReview.json.data.related.photos.length === 0;
  results["PM OTHER USER DN REVIEW BLOCKED"] =
    (
      await request(
        `/api/approvals/review?kind=delivery_note&documentId=${otherDn.json.data.id}`,
        {},
        pm.cookie
      )
    ).response.status === 403;

  const archive = await request<{ items: { id: string }[] }>(
    "/api/documents-archive",
    {},
    pm.cookie
  );
  const archiveIds = new Set(
    (archive.json?.data?.items ?? []).map((item) => item.id)
  );
  results["PM ARCHIVE INCLUDES OWN CROSS DOCUMENTS"] =
    archiveIds.has(ownWd.json.data.id) && archiveIds.has(ownDn.json.data.id);
  results["PM ARCHIVE EXCLUDES OTHER CROSS DOCUMENTS"] =
    !archiveIds.has(otherWd.json.data.id) &&
    !archiveIds.has(otherDn.json.data.id);

  const assignmentState = await request(
    "/api/project-manager-assignments",
    {},
    operations.cookie
  );
  results["OPERATIONS ASSIGNMENT ACCESS"] =
    assignmentState.response.status === 200;
  const forbiddenUsers = await request("/api/system/users", {}, operations.cookie);
  results["OPERATIONS USER ADMIN BLOCKED"] =
    forbiddenUsers.response.status === 403;

  const persisted = await prisma.project.findUnique({
    where: { id: projectC.id },
    select: { ownerId: true },
  });
  results["CROSS DOCUMENTS DO NOT ASSIGN C"] =
    persisted?.ownerId === originalProjects.get(projectC.id)?.ownerId;
  const assignByOperations = await request(
    "/api/project-manager-assignments",
    {
      method: "PUT",
      body: JSON.stringify({
        userId: pm.id,
        projectIds: [projectA.id, projectC.id],
      }),
    },
    operations.cookie
  );
  const unassignByOperations = await request(
    "/api/project-manager-assignments",
    {
      method: "PUT",
      body: JSON.stringify({ userId: pm.id, projectIds: [projectA.id] }),
    },
    operations.cookie
  );
  results["OPERATIONS CAN ASSIGN AND UNASSIGN"] =
    assignByOperations.response.status === 200 &&
    unassignByOperations.response.status === 200;
  const assignmentAudits = await prisma.auditLog.findMany({
    where: {
      entityType: "Project",
      entityId: projectC.id,
      userId: operations.id,
      action: { in: ["PROJECT_ASSIGNED", "PROJECT_UNASSIGNED"] },
    },
    select: { action: true },
  });
  const assignmentActions = new Set(
    assignmentAudits.map((audit) => audit.action)
  );
  results["ASSIGNMENT AUDIT"] =
    assignmentActions.has("PROJECT_ASSIGNED") &&
    assignmentActions.has("PROJECT_UNASSIGNED");
  const crossAudits = await prisma.auditLog.count({
    where: {
      action: "CROSS_PROJECT_DOCUMENT_CREATED",
      userId: { in: [pm.id, other.id] },
      entityId: { in: documentIds },
    },
  });
  results["CROSS PROJECT AUDIT"] = crossAudits === 4;

  for (const [name, passed] of Object.entries(results)) {
    console.log(`${name}: ${passed ? "PASS" : "FAIL"}`);
  }
  assert(Object.values(results).every(Boolean), "Permission matrix failed");
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const [projectId, original] of originalProjects) {
      await prisma.project
        .update({
          where: { id: projectId },
          data: {
            ownerId: original.ownerId,
            updatedById: original.updatedById,
          },
        })
        .catch(() => undefined);
    }
    await prisma.document.deleteMany({
      where: { sourceId: { in: documentIds } },
    });
    if (workflowIds.length) {
      await prisma.workflowDocument.deleteMany({
        where: { id: { in: workflowIds } },
      });
    }
    await prisma.workDiary.deleteMany({
      where: { id: { in: documentIds } },
    });
    await prisma.opsDeliveryNote.deleteMany({
      where: { id: { in: documentIds } },
    });
    await prisma.activity.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { entityId: { in: documentIds } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });
