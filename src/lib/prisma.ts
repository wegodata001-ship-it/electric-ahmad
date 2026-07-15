import { PrismaClient } from "@prisma/client";

const SCHEMA_VERSION = "crew-time-entries-v1";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function hasRequiredModels(client: PrismaClient): boolean {
  const c = client as unknown as {
    aiParseLog?: { create?: unknown };
    projectInvoiceApproval?: { create?: unknown };
    deliveryNote?: { create?: unknown };
    boqExecution?: { create?: unknown };
    workJournal?: { create?: unknown };
    fieldAttendance?: { create?: unknown };
    fieldCrewMember?: { create?: unknown };
    client?: { create?: unknown };
    dailyReport?: { create?: unknown };
    deliveryNoteVersion?: { create?: unknown };
    fieldCrewTimeEntry?: { create?: unknown };
  };
  return (
    typeof c.aiParseLog?.create === "function" &&
    typeof c.projectInvoiceApproval?.create === "function" &&
    typeof c.deliveryNote?.create === "function" &&
    typeof c.boqExecution?.create === "function" &&
    typeof c.workJournal?.create === "function" &&
    typeof c.fieldAttendance?.create === "function" &&
    typeof c.fieldCrewMember?.create === "function" &&
    typeof c.client?.create === "function" &&
    typeof c.dailyReport?.create === "function" &&
    typeof c.deliveryNoteVersion?.create === "function" &&
    typeof c.fieldCrewTimeEntry?.create === "function"
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
