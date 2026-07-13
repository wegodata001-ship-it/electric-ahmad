import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

export class AuditRepository {
  static async log(params: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    userId: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  }
}
