import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Clearing demo data...");

  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.reportMedia.deleteMany();
  await prisma.workReport.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.partialInvoice.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.galleryItem.deleteMany();
  await prisma.boqItem.deleteMany();
  await prisma.projectEmployee.deleteMany();
  await prisma.project.deleteMany();
  await prisma.employee.deleteMany();

  // Keep system admin so auth/session still works
  await prisma.user.deleteMany({
    where: { email: { not: "admin@wego-electric.co.il" } },
  });

  const admin = await prisma.user.findUnique({
    where: { email: "admin@wego-electric.co.il" },
  });

  if (!admin) {
    await prisma.user.create({
      data: {
        email: "admin@wego-electric.co.il",
        name: "אדמין WEGO",
        role: "מנהל מערכת",
        avatarUrl:
          "https://api.dicebear.com/7.x/initials/svg?seed=Admin&backgroundColor=2563eb",
      },
    });
    console.log("✓ Created system admin user");
  } else {
    console.log("✓ Kept system admin user");
  }

  const counts = {
    projects: await prisma.project.count(),
    employees: await prisma.employee.count(),
    boqItems: await prisma.boqItem.count(),
    reports: await prisma.workReport.count(),
    documents: await prisma.document.count(),
    invoices: await prisma.partialInvoice.count(),
    gallery: await prisma.galleryItem.count(),
    activities: await prisma.activity.count(),
    notifications: await prisma.notification.count(),
  };

  console.log("✅ Demo data cleared. Current counts:");
  console.log(counts);
}

main()
  .catch((e) => {
    console.error("❌ Clear failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
