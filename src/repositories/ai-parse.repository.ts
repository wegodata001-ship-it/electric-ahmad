import { prisma } from "@/lib/prisma";
import { PipelineError } from "@/lib/api/pipeline-log";

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
      },
    });
  }

  static async findById(id: string) {
    this.assertModel();
    return prisma.aiParseLog.findUnique({ where: { id } });
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
    }>
  ) {
    this.assertModel();
    return prisma.aiParseLog.update({ where: { id }, data });
  }
}
