import { prisma } from "@/lib/prisma";

export type WorkflowNotifyInput = {
  userIds: string[];
  projectId: string;
  title: string;
  message: string;
  link?: string;
};

/**
 * Hooks להתראות — Stage 1 כותב לטבלת Notification.
 * שלבים מאוחרים יוסיפו WhatsApp / Email / SMS.
 */
export async function notifyWorkflowUsers(input: WorkflowNotifyInput): Promise<void> {
  const unique = [...new Set(input.userIds.filter(Boolean))];
  if (!unique.length) return;

  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      projectId: input.projectId,
      type: "document" as const,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    })),
  });
}
