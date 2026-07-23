/**
 * Prepare Client QA Demo environment:
 * - Demo users (sysmgr, pm1, opsmgr, fieldmgr) / WegoAudit123!
 * - Minimum demo data for full portal walkthrough
 *
 * Safe to re-run (idempotent where practical).
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();
const PASS = "WegoAudit123!";

function tokenPair() {
  const raw = randomBytes(32).toString("base64url");
  const publicId = randomBytes(9).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  return { raw, publicId, tokenHash };
}

async function ensureUser(
  username: string,
  email: string,
  name: string,
  role: string
) {
  const passwordHash = await hash(PASS, 10);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { username, email, name, role, passwordHash },
    });
  }
  return prisma.user.create({
    data: { username, email, name, role, passwordHash },
  });
}

async function ensureFieldEmployee(userId: string) {
  const linked = await prisma.employee.findFirst({ where: { userId } });
  if (linked) return linked;

  const free = await prisma.employee.findFirst({
    where: { isDeleted: false, status: "active", userId: null, role: "foreman" },
  });
  if (free) {
    return prisma.employee.update({
      where: { id: free.id },
      data: { userId },
    });
  }

  return prisma.employee.create({
    data: {
      firstName: "דמו",
      lastName: "שטח",
      phone: "0500000001",
      email: `field.demo.${Date.now()}@audit.local`,
      role: "foreman",
      status: "active",
      joinedAt: new Date(),
      userId,
    },
  });
}

async function main() {
  console.log("=== QA Demo prepare ===");

  const sys = await ensureUser(
    "sysmgr",
    "sys.scenario@audit.local",
    "System Manager",
    "SYSTEM_MANAGER"
  );
  const pm = await ensureUser(
    "pm1",
    "pm1.scenario@audit.local",
    "Project Manager Demo",
    "PROJECT_MANAGER"
  );
  const ops = await ensureUser(
    "opsmgr",
    "ops.scenario@audit.local",
    "Operations Manager Demo",
    "OPERATIONS_MANAGER"
  );
  const fieldUser = await ensureUser(
    "fieldmgr",
    "field.ux@audit.local",
    "Field Manager Demo",
    "FIELD_MANAGER"
  );
  const foreman = await ensureFieldEmployee(fieldUser.id);
  console.log("Users OK:", {
    sysmgr: sys.id,
    pm1: pm.id,
    opsmgr: ops.id,
    fieldmgr: fieldUser.id,
    foreman: foreman.id,
  });

  // "Companies" ≈ distinct contractors on projects (no Company model)
  const contractors = ["קבלן דמו א׳ — אסאדי", "קבלן דמו ב׳ — אלקטרו"];

  const projectSpecs = [
    { name: "פרויקט דמו — מגדל צפון", contractNumber: "DEMO-P-001", contractor: contractors[0], location: "תל אביב" },
    { name: "פרויקט דמו — קניון דרום", contractNumber: "DEMO-P-002", contractor: contractors[0], location: "ראשון לציון" },
    { name: "פרויקט דמו — בית חולים", contractNumber: "DEMO-P-003", contractor: contractors[1], location: "חיפה" },
    { name: "פרויקט דמו — משרדים", contractNumber: "DEMO-P-004", contractor: contractors[1], location: "ירושלים" },
    { name: "פרויקט דמו — מחסן לוגיסטי", contractNumber: "DEMO-P-005", contractor: contractors[0], location: "מודיעין" },
  ];

  const projects = [];
  for (const spec of projectSpecs) {
    let p = await prisma.project.findUnique({
      where: { contractNumber: spec.contractNumber },
    });
    if (!p) {
      const start = new Date();
      const end = new Date(start.getTime() + 180 * 24 * 3600 * 1000);
      p = await prisma.project.create({
        data: {
          name: spec.name,
          contractNumber: spec.contractNumber,
          contractor: spec.contractor,
          location: spec.location,
          foremanId: foreman.id,
          status: "active",
          contractValue: 1500000,
          ownerId: pm.id,
          createdById: pm.id,
          updatedById: pm.id,
          progress: 35,
          startDate: start,
          endDate: end,
          description: "פרויקט דמו לבדיקות Client QA",
        },
      });
      console.log("Created project", p.contractNumber);
    } else {
      // ensure foreman linked
      await prisma.project.update({
        where: { id: p.id },
        data: { foremanId: foreman.id, ownerId: pm.id },
      });
    }
    projects.push(p);
  }

  const mainProject = projects[0]!;

  // Link field manager to projects
  for (const p of projects) {
    await prisma.projectEmployee.upsert({
      where: {
        projectId_employeeId: { projectId: p.id, employeeId: foreman.id },
      },
      create: { projectId: p.id, employeeId: foreman.id },
      update: {},
    });
  }

  // BOQ items on first 2 projects
  for (const p of projects.slice(0, 2)) {
    const count = await prisma.boqItem.count({ where: { projectId: p.id } });
    if (count < 3) {
      const items = [
        { code: "1.01", description: "התקנת לוחות חשמל", unit: "יח'", qty: 10, price: 2500 },
        { code: "1.02", description: "כבלים מא״ז", unit: "מ׳", qty: 500, price: 45 },
        { code: "1.03", description: "תאורה LED", unit: "יח'", qty: 80, price: 180 },
      ];
      for (const it of items) {
        const exists = await prisma.boqItem.findFirst({
          where: { projectId: p.id, code: it.code },
        });
        if (!exists) {
          await prisma.boqItem.create({
            data: {
              projectId: p.id,
              code: it.code,
              description: it.description,
              unit: it.unit,
              contractQuantity: it.qty,
              remainingQuantity: it.qty,
              unitPrice: it.price,
              createdById: pm.id,
              updatedById: pm.id,
            },
          });
        }
      }
      console.log("BOQ seeded for", p.contractNumber);
    }
  }

  // Rooms on main project
  const roomCount = await prisma.projectRoom.count({
    where: { projectId: mainProject.id, deletedAt: null },
  });
  if (roomCount < 3) {
    const rooms = [
      { name: "לובי", floor: "0", code: "R-01", sortOrder: 1 },
      { name: "חדר חשמל", floor: "-1", code: "R-02", sortOrder: 2 },
      { name: "קומה 1 — משרדים", floor: "1", code: "R-03", sortOrder: 3 },
    ];
    for (const r of rooms) {
      const exists = await prisma.projectRoom.findFirst({
        where: { projectId: mainProject.id, code: r.code, deletedAt: null },
      });
      if (!exists) {
        await prisma.projectRoom.create({
          data: { projectId: mainProject.id, ...r },
        });
      }
    }
    console.log("Rooms seeded");
  }

  // Document (hub) sample
  const docCount = await prisma.document.count({
    where: { projectId: mainProject.id },
  });
  if (docCount < 1) {
    try {
      await prisma.document.create({
        data: {
          name: "תוכנית חשמל — דמו.pdf",
          type: "other",
          extension: "pdf",
          size: 1024,
          bucket: "local",
          path: "demo/plan.pdf",
          url: "https://placehold.co/600x400/png?text=Demo+Document",
          ownerId: pm.id,
          project: { connect: { id: mainProject.id } },
          uploadedBy: { connect: { id: pm.id } },
          createdBy: { connect: { id: pm.id } },
          updatedBy: { connect: { id: pm.id } },
        },
      });
      console.log("Document seeded");
    } catch (e) {
      console.log("Document seed skipped:", (e as Error).message.slice(0, 120));
    }
  }

  // Work diaries — one pending approval, one draft
  let pendingDiary = await prisma.workDiary.findFirst({
    where: {
      projectId: mainProject.id,
      documentNumber: { startsWith: "WD-DEMO-" },
      status: { in: ["pending_approval", "in_approval"] },
    },
  });

  if (!pendingDiary) {
    const seq =
      (await prisma.workDiary.count({ where: { projectId: mainProject.id } })) +
      1;
    const docNum = `WD-DEMO-${String(seq).padStart(4, "0")}`;

    // Prefer creating via statuses that exist in enum — inspect via create draft then update
    pendingDiary = await prisma.workDiary.create({
      data: {
        documentNumber: docNum,
        sequenceNumber: seq,
        status: "draft",
        projectId: mainProject.id,
        clientName: "לקוח דמו",
        address: mainProject.location,
        foremanId: foreman.id,
        workDate: new Date(),
        workSummary: "עבודות חשמל — דמו לאישור",
        notes: "יומן דמו לבדיקת Approval Center",
        createdById: fieldUser.id,
        updatedById: fieldUser.id,
        workItems: {
          create: [
            {
              lineNumber: 1,
              description: "התקנת לוח קומתי",
              unit: "יח'",
              quantity: 1,
              sortOrder: 0,
            },
          ],
        },
        media: {
          create: [
            {
              stage: "during",
              name: "demo-photo-1.png",
              url: "https://placehold.co/800x600/png?text=Field+Photo+1",
              size: 2048,
            },
            {
              stage: "after",
              name: "demo-photo-2.png",
              url: "https://placehold.co/800x600/png?text=Field+Photo+2",
              size: 2048,
            },
          ],
        },
      },
    });

    // Try workflow-linked pending state
    try {
      await prisma.workDiary.update({
        where: { id: pendingDiary.id },
        data: { status: "pending_approval" },
      });
    } catch {
      console.log("Could not set diary pending status — left draft");
    }

    // Legacy approval row for ApprovalsInbox
    const existingAppr = await prisma.workDiaryApproval.findFirst({
      where: { workDiaryId: pendingDiary.id, approverId: ops.id, status: "pending" },
    });
    if (!existingAppr) {
      await prisma.workDiaryApproval.create({
        data: {
          workDiaryId: pendingDiary.id,
          approverId: ops.id,
          status: "pending",
        },
      });
      // also PM
      await prisma.workDiaryApproval.create({
        data: {
          workDiaryId: pendingDiary.id,
          approverId: pm.id,
          status: "pending",
        },
      });
    }

    // Workflow document + pending approvals + conversation
    let wf = await prisma.workflowDocument.findFirst({
      where: {
        legacyEntityType: "WorkDiary",
        legacyEntityId: pendingDiary.id,
      },
    });
    if (!wf) {
      wf = await prisma.workflowDocument.create({
        data: {
          kind: "WORK_DIARY",
          documentNumber: pendingDiary.documentNumber,
          projectId: mainProject.id,
          title: "יומן דמו לאישור",
          status: "pending_approval",
          legacyEntityType: "WorkDiary",
          legacyEntityId: pendingDiary.id,
          createdById: fieldUser.id,
          updatedById: fieldUser.id,
          currentOwnerId: ops.id,
        },
      });
      await prisma.workDiary.update({
        where: { id: pendingDiary.id },
        data: { workflowDocumentId: wf.id },
      });
    }
    for (const approverId of [ops.id, pm.id]) {
      const wa = await prisma.workflowApproval.findFirst({
        where: { documentId: wf.id, approverId, status: "pending" },
      });
      if (!wa) {
        await prisma.workflowApproval.create({
          data: { documentId: wf.id, approverId, status: "pending" },
        });
      }
    }

    const convCount = await prisma.workflowEvent.count({
      where: { documentId: wf.id, type: "conversation.message" },
    });
    if (convCount < 2) {
      await prisma.workflowEvent.createMany({
        data: [
          {
            documentId: wf.id,
            type: "conversation.message",
            message: "שטח: היומן מוכן לבדיקה — צירפתי תמונות.",
            actorId: fieldUser.id,
          },
          {
            documentId: wf.id,
            type: "conversation.message",
            message: "תפעול: בודקים כמויות מול BOQ.",
            actorId: ops.id,
          },
        ],
      });
    }

    // Share link token (public URL needs raw — store note in console)
    const existingToken = await prisma.workDiarySignToken.findFirst({
      where: { workDiaryId: pendingDiary.id },
    });
    if (!existingToken) {
      const { publicId, tokenHash, raw } = tokenPair();
      await prisma.workDiarySignToken.create({
        data: {
          workDiaryId: pendingDiary.id,
          publicId,
          tokenHash,
          createdById: pm.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });
      console.log(
        "Share link sample (sign URL path):",
        `/sign/work-diary/${pendingDiary.documentNumber}?t=${publicId}.${raw}`
      );
    }

    // Workflow attachment (sample image)
    const att = await prisma.workflowAttachment.findFirst({
      where: { documentId: wf.id },
    });
    if (!att) {
      await prisma.workflowAttachment.create({
        data: {
          documentId: wf.id,
          name: "demo-attachment.jpg",
          fileType: "image",
          extension: "jpg",
          size: 4096,
          bucket: "local",
          path: "demo/attachment.jpg",
          url: "https://placehold.co/640x480/png?text=Attachment",
          uploadedById: fieldUser.id,
        },
      });
    }

    console.log("Pending diary + workflow + conversation OK", pendingDiary.documentNumber);
  }

  // Draft diary for field work
  const draftExists = await prisma.workDiary.findFirst({
    where: { projectId: mainProject.id, status: "draft", documentNumber: { startsWith: "WD-DEMO-DRAFT" } },
  });
  if (!draftExists) {
    await prisma.workDiary.create({
      data: {
        documentNumber: "WD-DEMO-DRAFT-0001",
        sequenceNumber: 9001,
        status: "draft",
        projectId: mainProject.id,
        foremanId: foreman.id,
        workDate: new Date(),
        workSummary: "טיוטה — להשלמה ובדיקת Submit",
        createdById: fieldUser.id,
        updatedById: fieldUser.id,
      },
    });
  }

  // Delivery note
  let dn = await prisma.opsDeliveryNote.findFirst({
    where: { documentNumber: { startsWith: "DN-DEMO-" } },
  });
  if (!dn) {
    dn = await prisma.opsDeliveryNote.create({
      data: {
        documentNumber: "DN-DEMO-0001",
        sequenceNumber: 1,
        status: "draft",
        projectId: mainProject.id,
        clientName: "לקוח דמו",
        address: mainProject.location,
        foremanId: foreman.id,
        noteDate: new Date(),
        createdById: fieldUser.id,
        updatedById: fieldUser.id,
        notes: "תעודת משלוח דמו",
      },
    });
    console.log("Delivery note", dn.documentNumber);
  }

  // Partial invoice
  let inv = await prisma.partialInvoice.findFirst({
    where: { invoiceNumber: "INV-DEMO-0001" },
  });
  if (!inv) {
    const now = new Date();
    const due = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    inv = await prisma.partialInvoice.create({
      data: {
        projectId: mainProject.id,
        invoiceNumber: "INV-DEMO-0001",
        sequenceNumber: 1,
        billingMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        amount: 45000,
        subtotal: 45000,
        vatPercent: 17,
        vatAmount: 7650,
        totalWithVat: 52650,
        status: "draft",
        date: now,
        dueDate: due,
        notes: "חשבון חלקי דמו",
        ownerId: pm.id,
        createdById: pm.id,
        updatedById: pm.id,
      },
    });
    console.log("Partial invoice", inv.invoiceNumber);
  }

  // Notifications for all demo users
  for (const u of [sys, pm, ops, fieldUser]) {
    const n = await prisma.notification.count({ where: { userId: u.id } });
    if (n < 2) {
      await prisma.notification.createMany({
        data: [
          {
            userId: u.id,
            projectId: mainProject.id,
            type: "document",
            title: "דמו: מסמך ממתין",
            message: "יש מסמך דמו לבדיקה ב־Approval Center",
            link: "/operations/approvals",
            read: false,
          },
          {
            userId: u.id,
            projectId: mainProject.id,
            type: "system",
            title: "ברוכים הבאים לדמו",
            message: "סביבת Client QA — סיסמה WegoAudit123!",
            link: "/",
            read: false,
          },
        ],
      });
    }
  }
  console.log("Notifications OK");

  // Summary counts
  const summary = {
    projects: await prisma.project.count(),
    contractors: (
      await prisma.project.findMany({ select: { contractor: true }, distinct: ["contractor"] })
    ).length,
    boq: await prisma.boqItem.count(),
    rooms: await prisma.projectRoom.count({ where: { deletedAt: null } }),
    diaries: await prisma.workDiary.count(),
    pendingApprovals: await prisma.workDiaryApproval.count({
      where: { status: "pending" },
    }),
    workflowPending: await prisma.workflowApproval.count({
      where: { status: "pending" },
    }),
    documents: await prisma.document.count(),
    deliveryNotes: await prisma.opsDeliveryNote.count(),
    partialInvoices: await prisma.partialInvoice.count(),
    conversationMessages: await prisma.workflowEvent.count({
      where: { type: "conversation.message" },
    }),
    shareLinks: await prisma.workDiarySignToken.count(),
    notifications: await prisma.notification.count(),
  };

  console.log("=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log("Password for all:", PASS);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
