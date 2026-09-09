import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  OFFICE_SESSION_COOKIE,
  signOfficeSession,
} from "../src/lib/auth/office-cookie";

const BASE_URL = process.env.USER_MANAGEMENT_QA_URL ?? "http://localhost:3002";
const runId = Date.now().toString(36);
const originalPassword = `Qa!${runId}Aa9`;
const resetPassword = `Reset!${runId}Z9`;

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string };
type CreatedUser = {
  user: {
    id: string;
    username: string;
    role: string;
    status: string;
    employee: { id: string } | null;
    projects: Array<{ id: string }>;
  };
};

const results: Record<string, boolean | string> = {};
const createdUserIds: string[] = [];
let createdEmployeeId: string | null = null;
let temporaryApprovalId: string | null = null;
let assignedProjectId: string | null = null;
let originalProjectOwnerId: string | null = null;

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
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
  });
  const json = (await response.json().catch(() => ({
    success: false,
    error: `Non-JSON response (${response.status})`,
  }))) as ApiEnvelope<T>;
  return { response, json };
}

async function login(username: string, password: string, field = false) {
  const { response, json } = await request<{
    role: string;
    portalPath?: string;
  }>(field ? "/api/field/auth/login" : "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const setCookie = response.headers.get("set-cookie");
  return {
    status: response.status,
    json,
    cookie: setCookie?.split(";")[0] ?? "",
  };
}

async function createUser(
  adminCookie: string,
  role:
    | "SYSTEM_MANAGER"
    | "OPERATIONS_MANAGER"
    | "PROJECT_MANAGER"
    | "FIELD_MANAGER"
    | "TRUCK_DRIVER",
  projectIds: string[] = []
) {
  const suffix = role.toLowerCase().replaceAll("_", "-");
  const username = `qa-${suffix}-${runId}`;
  const payload = {
    name: `QA ${role} ${runId}`,
    username,
    email: `${username}@test.invalid`,
    phone: role === "FIELD_MANAGER" ? `059${Date.now().toString().slice(-7)}` : "",
    role,
    projectIds,
    allowNoProjects: role === "PROJECT_MANAGER" && projectIds.length === 0,
    password: originalPassword,
  };
  const { response, json } = await request<CreatedUser>(
    "/api/system/users",
    { method: "POST", body: JSON.stringify(payload) },
    adminCookie
  );
  assert(response.status === 201 && json.data, `Create ${role}: ${json.error}`);
  createdUserIds.push(json.data.user.id);
  if (json.data.user.employee) {
    createdEmployeeId = json.data.user.employee.id;
  }
  return { ...json.data.user, password: originalPassword, payload };
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { username: "admin", role: "SYSTEM_MANAGER", status: "ACTIVE" },
    select: { id: true, role: true, sessionVersion: true },
  });
  assert(admin, "Active admin SYSTEM_MANAGER not found");
  const adminToken = await signOfficeSession({
    userId: admin.id,
    role: admin.role,
    sessionVersion: admin.sessionVersion,
  });
  const adminCookie = `${OFFICE_SESSION_COOKIE}=${adminToken}`;

  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      status: { in: ["active", "planning"] },
      contractNumber: { notIn: ["__OTHER_SITES__", "DEMO-P-001"] },
    },
    select: { id: true, ownerId: true },
    take: 2,
  });
  assert(projects.length >= 2, "Two projects are required for scope QA");
  assignedProjectId = projects[0]!.id;
  originalProjectOwnerId = projects[0]!.ownerId;
  const unassignedProjectId = projects[1]!.id;

  const page = await fetch(`${BASE_URL}/system/users`, {
    headers: { cookie: adminCookie },
  });
  results["USER MANAGEMENT PAGE"] = page.status === 200;

  const system = await createUser(adminCookie, "SYSTEM_MANAGER");
  results["CREATE SYSTEM MANAGER"] = true;
  const operations = await createUser(adminCookie, "OPERATIONS_MANAGER");
  results["CREATE OPERATIONS MANAGER"] = true;
  const projectManager = await createUser(adminCookie, "PROJECT_MANAGER", [
    assignedProjectId,
  ]);
  results["CREATE PROJECT MANAGER"] = true;
  results["PROJECT ASSIGNMENT"] = projectManager.projects.some(
    (project) => project.id === assignedProjectId
  );
  const field = await createUser(adminCookie, "FIELD_MANAGER", [
    assignedProjectId,
  ]);
  results["CREATE FIELD MANAGER"] = true;
  results["EMPLOYEE AUTO-LINK"] = Boolean(field.employee);
  const driver = await createUser(adminCookie, "TRUCK_DRIVER");
  results["CREATE DRIVER"] = true;

  const systemLogin = await login(system.username, system.password);
  const operationsLogin = await login(operations.username, operations.password);
  const projectLogin = await login(
    projectManager.username,
    projectManager.password
  );
  const fieldLogin = await login(field.username, field.password, true);
  const driverLogin = await login(driver.username, driver.password);
  results["LOGIN EACH ROLE"] =
    systemLogin.status === 200 &&
    operationsLogin.status === 200 &&
    projectLogin.status === 200 &&
    fieldLogin.status === 200 &&
    driverLogin.status === 200;

  const systemUsersAccess = await request(
    "/api/system/users",
    {},
    systemLogin.cookie
  );
  const operationsUsersAccess = await request(
    "/api/system/users",
    {},
    operationsLogin.cookie
  );
  results["ROLE API SECURITY"] =
    systemUsersAccess.response.status === 200 &&
    operationsUsersAccess.response.status === 403;

  const assignedAccess = await request(
    `/api/projects/${assignedProjectId}`,
    {},
    projectLogin.cookie
  );
  const unassignedAccess = await request(
    `/api/projects/${unassignedProjectId}`,
    {},
    projectLogin.cookie
  );
  const fieldDashboard = await request<{ projects: Array<{ id: string }> }>(
    "/api/field/me",
    {},
    fieldLogin.cookie
  );
  const scopedHub = await request(
    "/api/documents/hub",
    {},
    projectLogin.cookie
  );
  const unassignedHub = await request(
    `/api/documents/hub?projectId=${unassignedProjectId}`,
    {},
    projectLogin.cookie
  );
  const unassignedInvoices = await request(
    `/api/partial-invoices?projectId=${unassignedProjectId}`,
    {},
    projectLogin.cookie
  );
  const unassignedBoq = await request(
    `/api/boq?projectId=${unassignedProjectId}`,
    {},
    projectLogin.cookie
  );
  const unassignedGallery = await request(
    `/api/gallery?projectId=${unassignedProjectId}`,
    {},
    projectLogin.cookie
  );
  const unassignedReports = await request(
    `/api/reports?projectId=${unassignedProjectId}`,
    {},
    projectLogin.cookie
  );
  const unassignedOrders = await request(
    `/api/work-orders?projectId=${unassignedProjectId}`,
    {},
    projectLogin.cookie
  );
  results["PROJECT SCOPE"] =
    assignedAccess.response.status === 200 &&
    unassignedAccess.response.status === 403 &&
    fieldDashboard.response.status === 200 &&
    fieldDashboard.json.data?.projects.length === 1 &&
    fieldDashboard.json.data.projects[0]?.id === assignedProjectId &&
    scopedHub.response.status === 200 &&
    unassignedHub.response.status === 403 &&
    unassignedInvoices.response.status === 403 &&
    unassignedBoq.response.status === 403 &&
    unassignedGallery.response.status === 403 &&
    unassignedReports.response.status === 403 &&
    unassignedOrders.response.status === 403;

  const invoice = await prisma.partialInvoice.findFirst({
    select: { id: true, projectId: true },
  });
  assert(invoice, "Existing invoice required for approver security QA");
  const approval = await prisma.projectInvoiceApproval.create({
    data: {
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      approverUserId: projectManager.id,
      createdById: admin.id,
      status: "pending",
      sentAt: new Date(),
    },
  });
  temporaryApprovalId = approval.id;
  const unauthorizedApproval = await request(
    `/api/partial-invoices/approvals/${approval.id}/approve`,
    { method: "POST", body: JSON.stringify({}) },
    operationsLogin.cookie
  );
  results["APPROVER VALIDATION"] =
    unauthorizedApproval.response.status === 403;

  const reset = await request(
    `/api/system/users/${driver.id}/reset-password`,
    { method: "POST", body: JSON.stringify({ password: resetPassword }) },
    adminCookie
  );
  const staleDriverSession = await request(
    "/api/driver/projects",
    {},
    driverLogin.cookie
  );
  const oldDriverLogin = await login(driver.username, originalPassword);
  const newDriverLogin = await login(driver.username, resetPassword);
  results["RESET PASSWORD"] =
    reset.response.status === 200 &&
    staleDriverSession.response.status === 403 &&
    oldDriverLogin.status === 401 &&
    newDriverLogin.status === 200;

  const disable = await request(
    `/api/system/users/${operations.id}/status`,
    { method: "POST", body: JSON.stringify({ status: "DISABLED" }) },
    adminCookie
  );
  const disabledLogin = await login(operations.username, originalPassword);
  const disabledExistingSession = await request(
    "/api/projects",
    {},
    operationsLogin.cookie
  );
  results["DISABLE LOGIN"] =
    disable.response.status === 200 &&
    disabledLogin.status === 403 &&
    disabledExistingSession.response.status === 403;
  const reactivate = await request(
    `/api/system/users/${operations.id}/status`,
    { method: "POST", body: JSON.stringify({ status: "ACTIVE" }) },
    adminCookie
  );
  const reactivatedLogin = await login(operations.username, originalPassword);
  results["REACTIVATE"] =
    reactivate.response.status === 200 && reactivatedLogin.status === 200;

  const editedPayload = {
    ...system.payload,
    name: `${system.payload.name} Edited`,
    role: "OPERATIONS_MANAGER",
    password: undefined,
  };
  const editRole = await request(
    `/api/system/users/${system.id}`,
    { method: "PATCH", body: JSON.stringify(editedPayload) },
    adminCookie
  );
  assert(editRole.response.status === 200, `Role edit: ${editRole.json.error}`);
  const restoreRole = await request(
    `/api/system/users/${system.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...editedPayload,
        role: "SYSTEM_MANAGER",
      }),
    },
    adminCookie
  );
  assert(
    restoreRole.response.status === 200,
    `Role restore: ${restoreRole.json.error}`
  );

  const auditActions = await prisma.auditLog.findMany({
    where: {
      entityType: "User",
      entityId: { in: createdUserIds },
    },
    select: { action: true },
  });
  const actionSet = new Set(auditActions.map(({ action }) => action));
  results["AUDIT LOG"] = [
    "USER_CREATED",
    "USER_UPDATED",
    "ROLE_CHANGED",
    "PROJECT_ASSIGNMENT_CHANGED",
    "USER_DISABLED",
    "USER_REACTIVATED",
    "PASSWORD_RESET",
  ].every((action) => actionSet.has(action as never));

  const archivedDemoUsers = await prisma.user.findMany({
    where: {
      username: {
        in: ["pm1", "pm2", "sysmgr", "opsmgr", "fieldmgr", "driver1"],
      },
    },
    select: { status: true },
  });
  results["DEMO ACCOUNTS DISABLED/ARCHIVED"] =
    archivedDemoUsers.length === 6 &&
    archivedDemoUsers.every(({ status }) => status === "ARCHIVED");

  const preservedDemoHistory = await prisma.user.count({
    where: {
      username: {
        in: ["pm1", "pm2", "sysmgr", "opsmgr", "fieldmgr", "driver1"],
      },
      OR: [
        { createdDocuments: { some: {} } },
        { createdWorkDiaries: { some: {} } },
        { createdOpsDeliveryNotes: { some: {} } },
        { auditLogs: { some: {} } },
        { ownedProjects: { some: {} } },
      ],
    },
  });
  results["HISTORICAL DATA PRESERVED"] = preservedDemoHistory === 6;

  for (const [name, passed] of Object.entries(results)) {
    console.log(`${name}: ${passed === true ? "PASS" : `FAIL (${passed})`}`);
  }
  assert(
    Object.values(results).every((result) => result === true),
    "One or more user-management assertions failed"
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (temporaryApprovalId) {
      await prisma.projectInvoiceApproval
        .delete({ where: { id: temporaryApprovalId } })
        .catch(() => undefined);
    }
    if (assignedProjectId && originalProjectOwnerId) {
      await prisma.project
        .update({
          where: { id: assignedProjectId },
          data: { ownerId: originalProjectOwnerId },
        })
        .catch(() => undefined);
    }
    if (createdEmployeeId) {
      await prisma.projectEmployee.deleteMany({
        where: { employeeId: createdEmployeeId },
      });
    }
    if (createdUserIds.length) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityType: "User", entityId: { in: createdUserIds } },
            { userId: { in: createdUserIds } },
          ],
        },
      });
      if (createdEmployeeId) {
        await prisma.employee
          .delete({ where: { id: createdEmployeeId } })
          .catch(() => undefined);
      }
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });
