import { PrismaClient } from "@prisma/client";
import {
  projects as mockProjects,
  employees as mockEmployees,
  boqItems as mockBoqItems,
  reports as mockReports,
  documents as mockDocuments,
  partialInvoices as mockInvoices,
  galleryItems as mockGallery,
  activities as mockActivities,
  notifications as mockNotifications,
} from "../src/mock";

const prisma = new PrismaClient();

const idMap = {
  users: new Map<string, string>(),
  employees: new Map<string, string>(),
  projects: new Map<string, string>(),
  boqItems: new Map<string, string>(),
  reports: new Map<string, string>(),
};

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.workJournalMedia.deleteMany();
  await prisma.workJournalBoqLine.deleteMany();
  await prisma.workJournalWorker.deleteMany();
  await prisma.workJournal.deleteMany();
  await prisma.fieldCrewMember.deleteMany();
  await prisma.fieldAttendance.deleteMany();
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
  await prisma.user.deleteMany();

  const { hashPassword } = await import("../src/lib/auth/password");
  const {
    FIELD_MANAGER_ROLE,
    PROJECT_MANAGER_ROLE,
  } = await import("../src/lib/auth/roles");

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@wego-electric.co.il",
      username: "admin",
      passwordHash: await hashPassword("Admin123!"),
      name: "אדמין WEGO",
      role: PROJECT_MANAGER_ROLE,
      avatarUrl:
        "https://api.dicebear.com/7.x/initials/svg?seed=Admin&backgroundColor=2563eb",
    },
  });
  idMap.users.set("user_001", adminUser.id);
  console.log("Office login: username=admin password=Admin123!");
  let demoForemanLinked = false;

  for (let i = 0; i < mockEmployees.length; i++) {
    const emp = mockEmployees[i];
    const email = `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}.${i}@wego-electric.co.il`;

    let userId: string | undefined;
    if (!demoForemanLinked && emp.role === "foreman") {
      const fieldUser = await prisma.user.create({
        data: {
          email: `field.${email}`,
          username: "foreman1",
          passwordHash: await hashPassword("Foreman123!"),
          name: `${emp.firstName} ${emp.lastName}`,
          role: FIELD_MANAGER_ROLE,
        },
      });
      userId = fieldUser.id;
      demoForemanLinked = true;
      console.log("Field login: username=foreman1 password=Foreman123!");
    }

    const created = await prisma.employee.create({
      data: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        phone: emp.phone,
        email,
        role: emp.role,
        status: emp.status,
        avatarUrl: emp.avatarUrl,
        completedQuantity: emp.completedQuantity,
        openQuantity: emp.openQuantity,
        joinedAt: new Date(emp.joinedAt),
        userId,
      },
    });
    idMap.employees.set(emp.id, created.id);
  }

  for (const proj of mockProjects) {
    const foremanId = idMap.employees.get(proj.foremanId);
    if (!foremanId) continue;

    const created = await prisma.project.create({
      data: {
        name: proj.name,
        contractNumber: proj.contractNumber,
        contractor: proj.contractor,
        location: proj.location,
        foremanId,
        status: proj.status,
        contractValue: proj.contractValue,
        completedValue: proj.completedValue,
        progress: proj.progress,
        imageUrl: proj.imageUrl,
        startDate: new Date(proj.startDate),
        endDate: new Date(proj.endDate),
        description: proj.description,
        ownerId: adminUser.id,
        createdById: adminUser.id,
        updatedById: adminUser.id,
      },
    });
    idMap.projects.set(proj.id, created.id);
  }

  for (const emp of mockEmployees) {
    const employeeId = idMap.employees.get(emp.id);
    if (!employeeId) continue;
    for (const projectId of emp.projectIds) {
      const mappedProjectId = idMap.projects.get(projectId);
      if (mappedProjectId) {
        await prisma.projectEmployee.create({
          data: { projectId: mappedProjectId, employeeId },
        });
      }
    }
  }

  for (const item of mockBoqItems) {
    const projectId = idMap.projects.get(item.projectId);
    if (!projectId) continue;

    const created = await prisma.boqItem.create({
      data: {
        projectId,
        code: item.code,
        description: item.description,
        unit: item.unit,
        contractQuantity: item.contractQuantity,
        completedQuantity: item.completedQuantity,
        remainingQuantity: item.remainingQuantity,
        unitPrice: item.unitPrice,
        completedValue: item.completedValue,
        remainingValue: item.remainingValue,
        progress: item.progress,
        status: item.status,
        level: item.level,
        createdById: adminUser.id,
        updatedById: adminUser.id,
      },
    });
    idMap.boqItems.set(item.id, created.id);
  }

  for (const report of mockReports) {
    const projectId = idMap.projects.get(report.projectId);
    const boqItemId = idMap.boqItems.get(report.boqItemId);
    const employeeId = idMap.employees.get(report.employeeId);
    if (!projectId || !boqItemId || !employeeId) continue;

    const created = await prisma.workReport.create({
      data: {
        projectId,
        boqItemId,
        employeeId,
        quantity: report.quantity,
        notes: report.notes,
        reportedAt: new Date(report.reportedAt),
        createdById: adminUser.id,
        updatedById: adminUser.id,
        media: {
          create: [
            ...report.photoUrls.map((url) => ({
              type: "image" as const,
              name: "תמונת דיווח",
              extension: "jpg",
              size: 100000,
              bucket: "images",
              path: url,
              url,
            })),
            ...report.videoUrls.map((url) => ({
              type: "video" as const,
              name: "סרטון דיווח",
              extension: "mp4",
              size: 500000,
              bucket: "videos",
              path: url,
              url,
            })),
          ],
        },
      },
    });
    idMap.reports.set(report.id, created.id);
  }

  for (const doc of mockDocuments) {
    const projectId = idMap.projects.get(doc.projectId);
    if (!projectId) continue;

    await prisma.document.create({
      data: {
        projectId,
        name: doc.name,
        type: doc.type,
        extension: doc.type,
        size: doc.size,
        bucket: "documents",
        path: `${projectId}/${doc.id}`,
        url: doc.url === "#" ? `https://placeholder.wego.local/${doc.id}` : doc.url,
        version: doc.version,
        uploadedById: adminUser.id,
        ownerId: adminUser.id,
        createdById: adminUser.id,
        updatedById: adminUser.id,
        createdAt: new Date(doc.uploadedAt),
        versions: {
          create: {
            version: 1,
            size: doc.size,
            bucket: "documents",
            path: `${projectId}/${doc.id}`,
            url: doc.url === "#" ? `https://placeholder.wego.local/${doc.id}` : doc.url,
            uploadedById: adminUser.id,
          },
        },
      },
    });
  }

  for (const inv of mockInvoices) {
    const projectId = idMap.projects.get(inv.projectId);
    if (!projectId) continue;

    await prisma.partialInvoice.create({
      data: {
        projectId,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        status: inv.status,
        date: new Date(inv.date),
        dueDate: new Date(inv.dueDate),
        notes: inv.notes,
        ownerId: adminUser.id,
        createdById: adminUser.id,
        updatedById: adminUser.id,
        items: {
          create: inv.includedItems
            .map((item) => {
              const boqItemId = idMap.boqItems.get(item.boqItemId);
              if (!boqItemId) return null;
              return {
                boqItemId,
                code: item.code,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
              };
            })
            .filter(Boolean) as {
            boqItemId: string;
            code: string;
            description: string;
            quantity: number;
            unitPrice: number;
            total: number;
          }[],
        },
      },
    });
  }

  for (const gal of mockGallery) {
    const projectId = idMap.projects.get(gal.projectId);
    if (!projectId) continue;

    await prisma.galleryItem.create({
      data: {
        projectId,
        type: gal.type,
        title: gal.title,
        bucket: "images",
        path: `${projectId}/${gal.id}`,
        url: gal.url,
        thumbnailUrl: gal.thumbnailUrl,
        boqItemId: gal.boqItemId ? idMap.boqItems.get(gal.boqItemId) : undefined,
        reportId: gal.reportId ? idMap.reports.get(gal.reportId) : undefined,
        uploadedById: adminUser.id,
        createdAt: new Date(gal.uploadedAt),
      },
    });
  }

  for (const act of mockActivities) {
    const projectId = idMap.projects.get(act.projectId);
    if (!projectId) continue;

    await prisma.activity.create({
      data: {
        projectId,
        type: act.type,
        title: act.title,
        description: act.description,
        userId: adminUser.id,
        metadata: act.metadata ? JSON.stringify(act.metadata) : null,
        createdAt: new Date(act.createdAt),
      },
    });
  }

  for (const notif of mockNotifications) {
    const projectId = notif.projectId ? idMap.projects.get(notif.projectId) : undefined;

    await prisma.notification.create({
      data: {
        userId: adminUser.id,
        projectId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        read: notif.read,
        link: notif.link,
        createdAt: new Date(notif.createdAt),
      },
    });
  }

  console.log("✅ Seed completed successfully!");
  console.log(`   Users: 1`);
  console.log(`   Employees: ${mockEmployees.length}`);
  console.log(`   Projects: ${mockProjects.length}`);
  console.log(`   BOQ Items: ${mockBoqItems.length}`);
  console.log(`   Reports: ${mockReports.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
