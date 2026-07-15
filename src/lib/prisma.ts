import { PrismaClient } from "@prisma/client";

const SCHEMA_VERSION = "ai-parse-log-v1";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function hasAiParseLog(client: PrismaClient): boolean {
  return (
    typeof (client as unknown as { aiParseLog?: { create?: unknown } }).aiParseLog
      ?.create === "function"
  );
}

function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const versionOk = globalForPrisma.prismaSchemaVersion === SCHEMA_VERSION;

  if (existing && versionOk && hasAiParseLog(existing)) {
    return existing;
  }

  if (existing) {
    void existing.$disconnect().catch(() => undefined);
  }

  const client = createPrismaClient();

  if (!hasAiParseLog(client)) {
    throw new Error(
      "Prisma Client חסר את model AiParseLog. עצור את השרת והרץ: npx prisma generate"
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
