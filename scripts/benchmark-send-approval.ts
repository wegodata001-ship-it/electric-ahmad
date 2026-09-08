import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

const ROLLBACK = "ROLLBACK_SEND_APPROVAL_BENCHMARK";

async function benchmark(mode: "before" | "after", approverCount: number) {
  const overallStarted = performance.now();
  const validationStarted = performance.now();
  const loadInvoice = () =>
    prisma.partialInvoice.findFirstOrThrow({
      where: { status: "draft" },
      select: {
        id: true,
        projectId: true,
        invoiceNumber: true,
        sequenceNumber: true,
        createdById: true,
        project: { select: { name: true } },
      },
    });
  const loadUsers = () =>
    prisma.user.findMany({
      where: {
        role: {
          in: [
            "SYSTEM_MANAGER",
            "PROJECT_MANAGER",
            "OPERATIONS_MANAGER",
            "ADMIN",
            "admin",
            "מנהל מערכת",
          ],
        },
      },
      take: approverCount,
      select: {
        id: true,
        name: true,
        employee: { select: { id: true, isDeleted: true } },
      },
    });

  const [resolvedInvoice, users] =
    mode === "before"
      ? [await loadInvoice(), await loadUsers()]
      : await Promise.all([loadInvoice(), loadUsers()]);
  if (users.length < approverCount) {
    throw new Error(`Need ${approverCount} approvers, found ${users.length}`);
  }
  const validationMs = performance.now() - validationStarted;
  let coreDbMs = 0;
  let secondaryMs = 0;
  let approvalRecordsMs = 0;
  let tasksMs = 0;
  let notificationsMs = 0;
  let statusActivityAuditMs = 0;

  try {
    await prisma.$transaction(async (tx) => {
      const dbStarted = performance.now();
      const now = new Date();

      if (mode === "before") {
        await tx.projectInvoiceApproval.updateMany({
          where: { invoiceId: resolvedInvoice.id, status: "pending" },
          data: { status: "cancelled" },
        });
        const approvalIds: string[] = [];
        for (const user of users) {
          const approvalStarted = performance.now();
          const approval = await tx.projectInvoiceApproval.create({
            data: {
              invoiceId: resolvedInvoice.id,
              projectId: resolvedInvoice.projectId,
              managerId:
                user.employee && !user.employee.isDeleted
                  ? user.employee.id
                  : null,
              approverUserId: user.id,
              status: "pending",
              sentAt: now,
              createdById: resolvedInvoice.createdById,
            },
            include: {
              manager: { select: { firstName: true, lastName: true } },
              approverUser: { select: { id: true, name: true } },
              createdBy: { select: { id: true, name: true } },
              invoice: {
                select: {
                  sequenceNumber: true,
                  invoiceNumber: true,
                  amount: true,
                },
              },
            },
          });
          approvalRecordsMs += performance.now() - approvalStarted;
          approvalIds.push(approval.id);
          const taskStarted = performance.now();
          await tx.activity.create({
            data: {
              projectId: resolvedInvoice.projectId,
              type: "status_changed",
              title: "משימת אישור חשבון",
              description: resolvedInvoice.invoiceNumber,
              userId: user.id,
            },
          });
          tasksMs += performance.now() - taskStarted;
          const notificationStarted = performance.now();
          await tx.notification.create({
            data: {
              userId: user.id,
              projectId: resolvedInvoice.projectId,
              type: "invoice",
              title: "חשבון ממתין לאישורך",
              message: resolvedInvoice.invoiceNumber,
            },
          });
          notificationsMs += performance.now() - notificationStarted;
        }
        const statusStarted = performance.now();
        await tx.partialInvoice.updateMany({
          where: { id: resolvedInvoice.id },
          data: {
            status: "pending_foreman_approval",
            updatedById: resolvedInvoice.createdById,
          },
        });
        await tx.activity.create({
          data: {
            projectId: resolvedInvoice.projectId,
            type: "status_changed",
            title: "חשבון נשלח לאישור",
            description: users.map((user) => user.name).join(", "),
            userId: resolvedInvoice.createdById,
          },
        });
        await tx.auditLog.create({
          data: {
            action: "UPDATE",
            entityType: "ProjectInvoiceApproval",
            entityId: approvalIds[0]!,
            userId: resolvedInvoice.createdById,
          },
        });
        statusActivityAuditMs += performance.now() - statusStarted;
        coreDbMs = performance.now() - dbStarted;
      } else {
        const approvals = users.map((user) => ({
          id: randomUUID(),
          invoiceId: resolvedInvoice.id,
          projectId: resolvedInvoice.projectId,
          managerId:
            user.employee && !user.employee.isDeleted
              ? user.employee.id
              : null,
          approverUserId: user.id,
          status: "pending" as const,
          sentAt: now,
          createdById: resolvedInvoice.createdById,
        }));
        await tx.partialInvoice.updateMany({
          where: {
            id: resolvedInvoice.id,
            status: { in: ["draft", "rejected_by_foreman", "rejected"] },
          },
          data: {
            status: "pending_foreman_approval",
            updatedById: resolvedInvoice.createdById,
          },
        });
        await tx.projectInvoiceApproval.updateMany({
          where: { invoiceId: resolvedInvoice.id, status: "pending" },
          data: { status: "cancelled" },
        });
        await tx.projectInvoiceApproval.createMany({ data: approvals });
        coreDbMs = performance.now() - dbStarted;

        const secondaryStarted = performance.now();
        await Promise.all([
          tx.activity.createMany({
            data: users.map((user, index) => ({
              projectId: resolvedInvoice.projectId,
              type: "status_changed",
              title: "משימת אישור חשבון",
              description: resolvedInvoice.invoiceNumber,
              userId: user.id,
              metadata: approvals[index]!.id,
            })),
          }),
          tx.notification.createMany({
            data: users.map((user) => ({
              userId: user.id,
              projectId: resolvedInvoice.projectId,
              type: "invoice",
              title: "חשבון ממתין לאישורך",
              message: resolvedInvoice.invoiceNumber,
            })),
          }),
          tx.activity.create({
            data: {
              projectId: resolvedInvoice.projectId,
              type: "status_changed",
              title: "חשבון נשלח לאישור",
              description: users.map((user) => user.name).join(", "),
              userId: resolvedInvoice.createdById,
            },
          }),
          tx.auditLog.create({
            data: {
              action: "UPDATE",
              entityType: "ProjectInvoiceApproval",
              entityId: approvals[0]!.id,
              userId: resolvedInvoice.createdById,
            },
          }),
        ]);
        secondaryMs = performance.now() - secondaryStarted;
      }

      throw new Error(ROLLBACK);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK) throw error;
  }

  return {
    mode,
    approvers: approverCount,
    validationMs: Math.round(validationMs),
    coreDbMs: Math.round(coreDbMs),
    secondaryMs: Math.round(secondaryMs),
    approvalRecordsMs: Math.round(approvalRecordsMs),
    tasksMs: Math.round(tasksMs),
    notificationsMs: Math.round(notificationsMs),
    statusActivityAuditMs: Math.round(statusActivityAuditMs),
    synchronousTotalMs:
      mode === "before"
        ? Math.round(performance.now() - overallStarted)
        : Math.round(validationMs + coreDbMs),
  };
}

async function main() {
  const results = [];
  for (const count of [1, 2, 3]) {
    results.push(await benchmark("before", count));
    results.push(await benchmark("after", count));
  }
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
