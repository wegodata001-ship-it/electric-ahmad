import { prisma } from "../src/lib/prisma";
import { COMPANY_PROFILE } from "../src/config/company";

async function main() {
  const invoices = await prisma.partialInvoice.findMany({
    orderBy: [{ projectId: "asc" }, { sequenceNumber: "asc" }],
    include: {
      project: {
        select: {
          name: true,
          contractNumber: true,
          location: true,
          foreman: { select: { firstName: true, lastName: true } },
        },
      },
      approvals: {
        where: { status: "approved" },
        orderBy: { approvedAt: "desc" },
        take: 1,
        include: {
          approverUser: { select: { name: true } },
          manager: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const runningByProject = new Map<string, number>();
  for (const invoice of invoices) {
    const previousTotal = runningByProject.get(invoice.projectId) ?? 0;
    const amount = Number(invoice.amount);
    const approval = invoice.approvals[0];
    const approverName =
      approval?.approverUser?.name ||
      (approval?.manager
        ? `${approval.manager.firstName} ${approval.manager.lastName}`.trim()
        : null);

    await prisma.partialInvoice.update({
      where: { id: invoice.id },
      data: {
        projectNameSnapshot:
          invoice.projectNameSnapshot || invoice.project.name,
        projectContractNumberSnapshot:
          invoice.projectContractNumberSnapshot ||
          invoice.project.contractNumber,
        projectLocationSnapshot:
          invoice.projectLocationSnapshot || invoice.project.location,
        projectForemanNameSnapshot:
          invoice.projectForemanNameSnapshot ||
          `${invoice.project.foreman.firstName} ${invoice.project.foreman.lastName}`.trim(),
        companySnapshotJson:
          invoice.companySnapshotJson || JSON.stringify(COMPANY_PROFILE),
        approverNameSnapshot:
          invoice.approverNameSnapshot || approverName || null,
        previousTotal,
        cumulativeTotal: previousTotal + amount,
      },
    });

    runningByProject.set(invoice.projectId, previousTotal + amount);
  }

  console.log(`Backfilled ${invoices.length} partial invoice snapshots.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
