import { Prisma, PrismaClient } from "@prisma/client";

/** Bump when DeliveryNote / MeasurementSheet schema fields change so hot-reload drops stale clients */
const SCHEMA_VERSION = "project-rooms-v1";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion?: string;
};

/** Slow-query threshold in ms — anything above logs to stderr in dev only. */
const SLOW_QUERY_MS = Number(process.env.PRISMA_SLOW_QUERY_MS ?? 500);

function createPrismaClient() {
  const isDev = process.env.NODE_ENV === "development";

  // We only subscribe to `query` events in development — the Node driver would
  // otherwise flood every request with SQL, and forwarding to stdout in prod
  // adds latency + leaks table names into log aggregators. In dev, we log
  // only queries slower than SLOW_QUERY_MS to keep the console readable.
  const client = new PrismaClient({
    log: isDev
      ? [
          { level: "error", emit: "stdout" },
          { level: "warn", emit: "stdout" },
          { level: "query", emit: "event" },
        ]
      : [{ level: "error", emit: "stdout" }],
  });

  if (isDev) {
    try {
      // Prisma's typed `$on` requires the union of emit-event levels; a small
      // cast keeps the call site clean without disabling checks elsewhere.
      (client as unknown as {
        $on: (event: "query", cb: (e: Prisma.QueryEvent) => void) => void;
      }).$on("query", (event: Prisma.QueryEvent) => {
        if (event.duration >= SLOW_QUERY_MS) {
          const query = event.query.length > 400
            ? `${event.query.slice(0, 400)}…`
            : event.query;
          console.warn(
            `[prisma] slow query ${event.duration}ms — ${query}`
          );
        }
      });
    } catch (err) {
      console.warn("[prisma] failed to attach slow-query logger", err);
    }
  }

  return client;
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
    projectRoom?: { create?: unknown };
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
    typeof c.projectRoom?.create === "function" &&
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
