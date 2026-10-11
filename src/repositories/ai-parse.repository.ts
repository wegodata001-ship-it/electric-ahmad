import { prisma } from "@/lib/prisma";
import { PipelineError } from "@/lib/api/pipeline-log";
import { jobTimeoutAt, SCAN_STATUS } from "@/lib/ai/scan-job";

export class AiParseRepository {
  private static assertModel() {
    const client = prisma as unknown as {
      aiParseLog?: { create?: unknown };
    };
    if (typeof client.aiParseLog?.create !== "function") {
      throw new PipelineError(
        "DATABASE",
        "AI Parse Log model",
        "prisma.aiParseLog אינו זמין. הרץ npx prisma generate והפעל מחדש את השרת."
      );
    }
  }

  static async create(params: {
    documentType: string;
    documentId?: string;
    projectId?: string;
    status: string;
    startedAt: Date;
    endedAt?: Date;
    durationMs?: number;
    itemsDetected?: number;
    fieldsMissing?: number;
    error?: string;
    resultJson?: string;
    createdById: string;
    timeoutAt?: Date;
    maxAttempts?: number;
  }) {
    this.assertModel();

    return prisma.aiParseLog.create({
      data: {
        documentType: params.documentType,
        documentId: params.documentId,
        projectId: params.projectId,
        status: params.status,
        startedAt: params.startedAt,
        endedAt: params.endedAt,
        durationMs: params.durationMs,
        itemsDetected: params.itemsDetected ?? 0,
        fieldsMissing: params.fieldsMissing ?? 0,
        error: params.error,
        resultJson: params.resultJson,
        createdById: params.createdById,
        timeoutAt: params.timeoutAt ?? jobTimeoutAt(params.startedAt),
        maxAttempts: params.maxAttempts ?? 3,
        nextRetryAt: params.startedAt,
      },
    });
  }

  static async findById(id: string) {
    this.assertModel();
    return prisma.aiParseLog.findUnique({ where: { id } });
  }

  static async findLatestForProject(projectId: string) {
    this.assertModel();
    return prisma.aiParseLog.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Claim a queued/uploaded job so only one worker proceeds. */
  static async claim(id: string): Promise<boolean> {
    this.assertModel();
    const now = new Date();
    const updated = await prisma.aiParseLog.updateMany({
      where: {
        id,
        status: { in: [SCAN_STATUS.UPLOADED, SCAN_STATUS.QUEUED] },
      },
      data: {
        status: SCAN_STATUS.PROCESSING,
        lockedAt: now,
        heartbeatAt: now,
        attempts: { increment: 1 },
        error: null,
        errorCode: null,
      },
    });
    return updated.count === 1;
  }

  static async update(
    id: string,
    data: Partial<{
      status: string;
      endedAt: Date;
      durationMs: number;
      itemsDetected: number;
      fieldsMissing: number;
      error: string | null;
      resultJson: string | null;
      projectId: string;
      documentId: string;
      lockedAt: Date | null;
      heartbeatAt: Date;
      nextRetryAt: Date | null;
      timeoutAt: Date | null;
      errorCode: string | null;
    }>
  ) {
    this.assertModel();
    return prisma.aiParseLog.update({ where: { id }, data });
  }
}
