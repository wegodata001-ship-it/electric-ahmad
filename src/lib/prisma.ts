import { Prisma, PrismaClient } from "@prisma/client";

/** Bump when DeliveryNote / MeasurementSheet schema fields change so hot-reload drops stale clients */
const SCHEMA_VERSION = "workflow-diary-bridge-v1.5";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function deliveryNoteClientIsCurrent(): boolean {
  const fields = Prisma.DeliveryNoteScalarFieldEnum as Record<string, string>;
  return (
    fields.receiverSignatureUrl === "receiverSignatureUrl" &&
    fields.employeeSignatureUrl === "employeeSignatureUrl" &&
    fields.employeeSignedName === "employeeSignedName"
  );
}

function hasRequiredModels(client: PrismaClient): boolean {
  const c = client as unknown as {
    aiParseLog?: { create?: unknown };
    projectInvoiceApproval?: { create?: unknown };
    deliveryNote?: { create?: unknown };
    boqExecution?: { create?: unknown };
    fieldAttendance?: { create?: unknown };
    fieldCrewMember?: { create?: unknown };
    client?: { create?: unknown };
    deliveryNoteVersion?: { create?: unknown };
    fieldCrewTimeEntry?: { create?: unknown };
    executionReport?: { create?: unknown };
    workOrder?: { create?: unknown };
    documentAttachment?: { create?: unknown };
    workflowDocument?: { create?: unknown };
  };
  return (
    typeof c.aiParseLog?.create === "function" &&
    typeof c.projectInvoiceApproval?.create === "function" &&
    typeof c.deliveryNote?.create === "function" &&
    typeof c.boqExecution?.create === "function" &&
    typeof c.fieldAttendance?.create === "function" &&
    typeof c.fieldCrewMember?.create === "function" &&
    typeof c.client?.create === "function" &&
    typeof c.deliveryNoteVersion?.create === "function" &&
    typeof c.fieldCrewTimeEntry?.create === "function" &&
    typeof c.executionReport?.create === "function" &&
    typeof c.workOrder?.create === "function" &&
    typeof c.documentAttachment?.create === "function" &&
    typeof c.workflowDocument?.create === "function" &&
    deliveryNoteClientIsCurrent()
  );
}

function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const versionOk = globalForPrisma.prismaSchemaVersion === SCHEMA_VERSION;

  if (existing && versionOk && hasRequiredModels(existing)) {
    return existing;
  }

  if (existing) {
    void existing.$disconnect().catch(() => undefined);
  }

  if (!deliveryNoteClientIsCurrent()) {
    throw new Error(
      "Prisma Client ישן (חסרים שדות חתימה לתעודת משלוח). עצור את השרת והרץ: npx prisma generate"
    );
  }

  const client = createPrismaClient();

  if (!hasRequiredModels(client)) {
    throw new Error(
      "Prisma Client חסר מודלים נדרשים. עצור את השרת והרץ: npx prisma generate"
    );
  }

  globalForPrisma.prisma = client;
  globalForPrisma.prismaSchemaVersion = SCHEMA_VERSION;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
