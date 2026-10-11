import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { SUBCONTRACTOR_ROLE } from "@/lib/auth/roles";
import { AuditRepository } from "@/repositories/audit.repository";
import {
  ACCOUNT_STATUS_LABELS,
  ENGAGEMENT_LABELS,
  MEASUREMENT_STATUS_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  WORK_STATUS_LABELS,
  money,
  qty,
} from "@/lib/subcontractors/constants";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";

export class SubcontractorError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "SubcontractorError";
    this.status = status;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    ""
  ).replace(/\/$/, "");
}

function activationUrl(token: string): string {
  const path = `/subcontractor/activate?token=${encodeURIComponent(token)}`;
  const origin = appOrigin();
  if (!origin) return path;
  const withProto = origin.startsWith("http") ? origin : `https://${origin}`;
  return `${withProto}${path}`;
}

async function nextCode(): Promise<string> {
  const last = await prisma.subcontractor.findFirst({
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  const n = last?.code?.match(/(\d+)$/)?.[1];
  const next = (n ? Number(n) : 0) + 1;
  return `SC-${String(next).padStart(4, "0")}`;
}

async function notifyUsers(opts: {
  userIds: string[];
  projectId?: string | null;
  title: string;
  message: string;
  link?: string;
}) {
  const unique = [...new Set(opts.userIds.filter(Boolean))];
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      projectId: opts.projectId ?? null,
      type: "system" as const,
      title: opts.title,
      message: opts.message,
      link: opts.link ?? null,
    })),
  });
}

async function addLedger(opts: {
  subcontractorId: string;
  projectId?: string | null;
  type: string;
  amount: number;
  date?: Date;
  reference?: string | null;
  sourceType?: string;
  sourceId?: string;
  actorId?: string | null;
  notes?: string | null;
}) {
  return prisma.subcontractorLedgerEntry.create({
    data: {
      subcontractorId: opts.subcontractorId,
      projectId: opts.projectId ?? null,
      type: opts.type,
      amount: new Prisma.Decimal(money(opts.amount)),
      date: opts.date ?? new Date(),
      reference: opts.reference ?? null,
      sourceType: opts.sourceType ?? null,
      sourceId: opts.sourceId ?? null,
      actorId: opts.actorId ?? null,
      notes: opts.notes ?? null,
    },
  });
}

function mapContractor(
  row: {
    id: string;
    code: string;
    companyName: string;
    taxId: string | null;
    contactName: string;
    phone: string;
    email: string;
    address: string | null;
    specialty: string | null;
    status: string;
    preferredPaymentMethod: string | null;
    bankDetails: string | null;
    paymentTerms: string | null;
    taxNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  includeBank: boolean
) {
  return {
    id: row.id,
    code: row.code,
    companyName: row.companyName,
    taxId: row.taxId,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    address: row.address,
    specialty: row.specialty,
    status: row.status,
    preferredPaymentMethod: row.preferredPaymentMethod,
    bankDetails: includeBank ? row.bankDetails : null,
    paymentTerms: row.paymentTerms,
    taxNotes: row.taxNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const SubcontractorsRepository = {
  async summary(projectIds?: string[]) {
    const assignmentWhere = projectIds
      ? { projectId: { in: projectIds }, status: "active" }
      : { status: "active" };
    const [active, working, projectsWith, pendingAccounts, approvedAccounts, payments] =
      await Promise.all([
        prisma.subcontractor.count({ where: { status: "active" } }),
        prisma.subcontractorAssignment.groupBy({
          by: ["subcontractorId"],
          where: assignmentWhere,
        }),
        prisma.subcontractorAssignment.groupBy({
          by: ["projectId"],
          where: assignmentWhere,
        }),
        prisma.subcontractorAccount.aggregate({
          where: {
            status: { in: ["submitted", "pm_review"] },
            ...(projectIds ? { projectId: { in: projectIds } } : {}),
          },
          _count: true,
          _sum: { payable: true },
        }),
        prisma.subcontractorAccount.aggregate({
          where: {
            status: { in: ["approved", "ready_for_payment"] },
            ...(projectIds ? { projectId: { in: projectIds } } : {}),
          },
          _sum: { payable: true },
        }),
        prisma.subcontractorPayment.aggregate({
          where: {
            voidedAt: null,
            ...(projectIds
              ? { account: { projectId: { in: projectIds } } }
              : {}),
          },
          _sum: { amount: true },
        }),
      ]);
    const [withoutUser, inProgressWorks, pendingReports] = await Promise.all([
      prisma.subcontractor.count({
        where: { status: "active", users: { none: {} } },
      }),
      prisma.subcontractorAssignment.count({
        where: {
          workStatus: "in_progress",
          status: { not: "cancelled" },
          ...(projectIds ? { projectId: { in: projectIds } } : {}),
        },
      }),
      prisma.subcontractorAssignment.count({
        where: {
          workStatus: "submitted",
          status: { not: "cancelled" },
          ...(projectIds ? { projectId: { in: projectIds } } : {}),
        },
      }),
    ]);
    const approved = money(approvedAccounts._sum.payable);
    const paid = money(payments._sum.amount);
    return {
      activeContractors: active,
      withoutUser,
      workingNow: working.length,
      inProgressWorks,
      pendingReports,
      projectsWithContractors: projectsWith.length,
      pendingAccounts: pendingAccounts._count,
      payableBalance: Math.max(0, money(approved - paid)),
    };
  },

  async list(opts: {
    q?: string;
    status?: string;
    projectId?: string;
    projectIds?: string[];
    userStatus?: string;
  }) {
    const where: Prisma.SubcontractorWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { companyName: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { taxId: { contains: q, mode: "insensitive" } },
      ];
    }
    const scopedProjectIds = opts.projectId
      ? [opts.projectId]
      : opts.projectIds;
    if (scopedProjectIds) {
      where.assignments = { some: { projectId: { in: scopedProjectIds } } };
    }
    if (opts.userStatus === "none") where.users = { none: {} };
    if (opts.userStatus === "active") where.users = { some: { status: "active" } };
    const rows = await prisma.subcontractor.findMany({
      where,
      orderBy: { companyName: "asc" },
      include: {
        users: { select: { status: true } },
        assignments: {
          where: { status: { not: "cancelled" } },
          select: { id: true, projectId: true, status: true, workStatus: true },
        },
        accounts: {
          where: { status: { in: ["approved", "ready_for_payment", "paid"] } },
          select: { payable: true, payments: { where: { voidedAt: null }, select: { amount: true } } },
        },
      },
    });
    return rows.map((row) => {
      const approved = row.accounts.reduce((s, a) => s + money(a.payable), 0);
      const paid = row.accounts.reduce(
        (s, a) => s + a.payments.reduce((x, p) => x + money(p.amount), 0),
        0
      );
      const hasActiveUser = row.users.some((u) => u.status === "active");
      return {
        ...mapContractor(row, false),
        assignmentCount: row.assignments.length,
        userCount: row.users.length,
        userStatus: hasActiveUser ? "active" : row.users.length ? "disabled" : "none",
        userStatusLabel: hasActiveUser
          ? "יש משתמש"
          : row.users.length
            ? "גישה מושבתת"
            : "ללא משתמש",
        activeAssignments: row.assignments.filter((a) => a.status === "active").length,
        openWorks: row.assignments.filter(
          (a) => a.status === "active" && !["approved", "cancelled"].includes(a.workStatus)
        ).length,
        payableBalance: Math.max(0, money(approved - paid)),
      };
    });
  },

  async getById(id: string, includeBank: boolean) {
    const row = await prisma.subcontractor.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                status: true,
                lastLoginAt: true,
                role: true,
              },
            },
          },
        },
        invites: {
          where: { acceptedAt: null, revokedAt: null },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            email: true,
            contactName: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        assignments: {
          orderBy: { createdAt: "desc" },
          include: {
            project: {
              select: { id: true, name: true, contractNumber: true, location: true },
            },
            workSite: { select: { id: true, name: true } },
            _count: { select: { rates: true, measurements: true, accounts: true } },
          },
        },
        documents: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });
    if (!row) throw new SubcontractorError("קבלן משנה לא נמצא", 404);
    return {
      ...mapContractor(row, includeBank),
      users: row.users.map((u) => ({
        id: u.id,
        userId: u.userId,
        contactName: u.contactName,
        status: u.status,
        portalRole: u.portalRole === "worker" ? "worker" : "owner",
        name: u.user.name,
        email: u.user.email,
        username: u.user.username,
        userStatus: u.user.status,
        lastLoginAt: u.user.lastLoginAt?.toISOString() ?? null,
      })),
      pendingInvites: row.invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        contactName: inv.contactName,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
      assignments: row.assignments.map((a) => ({
        id: a.id,
        projectId: a.projectId,
        projectName: a.project.name,
        contractNumber: a.project.contractNumber,
        workSiteId: a.workSiteId,
        workSiteName: a.workSite?.name ?? null,
        managerId: a.managerId,
        description: a.description,
        startDate: a.startDate?.toISOString() ?? null,
        plannedEndDate: a.plannedEndDate?.toISOString() ?? null,
        engagementType: a.engagementType,
        engagementLabel: ENGAGEMENT_LABELS[a.engagementType] ?? a.engagementType,
        amount: money(a.amount),
        notes: a.notes,
        status: a.status,
        workStatus: a.workStatus,
        workStatusLabel: WORK_STATUS_LABELS[a.workStatus] ?? a.workStatus,
        rateCount: a._count.rates,
        measurementCount: a._count.measurements,
        accountCount: a._count.accounts,
      })),
      documents: row.documents.map((d) => ({
        id: d.id,
        category: d.category,
        categoryLabel: DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category,
        title: d.title,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  },

  async create(
    input: {
      companyName: string;
      taxId?: string;
      contactName: string;
      phone: string;
      email: string;
      address?: string;
      specialty?: string;
      status?: string;
      preferredPaymentMethod?: string;
      bankDetails?: string;
      paymentTerms?: string;
      taxNotes?: string;
    },
    actorId: string
  ) {
    const companyName = input.companyName.trim();
    if (!companyName) throw new SubcontractorError("יש להזין שם קבלן / חברה");
    if (!input.contactName?.trim()) throw new SubcontractorError("יש להזין איש קשר");
    if (!input.phone?.trim()) throw new SubcontractorError("יש להזין מספר טלפון");
    if (!input.email?.trim()) throw new SubcontractorError("יש להזין אימייל");
    const code = await nextCode();
    const row = await prisma.subcontractor.create({
      data: {
        code,
        companyName,
        taxId: input.taxId?.trim() || null,
        contactName: input.contactName.trim(),
        phone: input.phone.trim(),
        email: input.email.trim().toLowerCase(),
        address: input.address?.trim() || null,
        specialty: input.specialty?.trim() || null,
        status: input.status === "inactive" ? "inactive" : "active",
        preferredPaymentMethod: input.preferredPaymentMethod?.trim() || null,
        bankDetails: input.bankDetails?.trim() || null,
        paymentTerms: input.paymentTerms?.trim() || null,
        taxNotes: input.taxNotes?.trim() || null,
        createdById: actorId,
      },
    });
    await AuditRepository.log({
      action: "CREATE",
      entityType: "Subcontractor",
      entityId: row.id,
      userId: actorId,
      metadata: { code, companyName },
    });
    return mapContractor(row, true);
  },

  async update(
    id: string,
    input: Record<string, unknown>,
    actorId: string,
    canEditBank: boolean
  ) {
    const existing = await prisma.subcontractor.findUnique({ where: { id } });
    if (!existing) throw new SubcontractorError("קבלן משנה לא נמצא", 404);
    const data: Prisma.SubcontractorUpdateInput = {};
    if (typeof input.companyName === "string") data.companyName = input.companyName.trim();
    if (typeof input.taxId === "string") data.taxId = input.taxId.trim() || null;
    if (typeof input.contactName === "string") data.contactName = input.contactName.trim();
    if (typeof input.phone === "string") data.phone = input.phone.trim();
    if (typeof input.email === "string") data.email = input.email.trim().toLowerCase();
    if (typeof input.address === "string") data.address = input.address.trim() || null;
    if (typeof input.specialty === "string") data.specialty = input.specialty.trim() || null;
    if (input.status === "active" || input.status === "inactive") data.status = input.status;
    if (typeof input.preferredPaymentMethod === "string") {
      data.preferredPaymentMethod = input.preferredPaymentMethod.trim() || null;
    }
    if (typeof input.paymentTerms === "string") data.paymentTerms = input.paymentTerms.trim() || null;
    if (typeof input.taxNotes === "string") data.taxNotes = input.taxNotes.trim() || null;
    if (canEditBank && typeof input.bankDetails === "string") {
      data.bankDetails = input.bankDetails.trim() || null;
    }
    const row = await prisma.subcontractor.update({ where: { id }, data });
    await AuditRepository.log({
      action: "UPDATE",
      entityType: "Subcontractor",
      entityId: id,
      userId: actorId,
      metadata: { fields: Object.keys(data) },
    });
    return mapContractor(row, canEditBank);
  },

  async openAccess(
    subcontractorId: string,
    input: { email: string; contactName: string; portalRole?: string },
    actorId: string
  ) {
    const contractor = await prisma.subcontractor.findUnique({
      where: { id: subcontractorId },
    });
    if (!contractor) throw new SubcontractorError("קבלן משנה לא נמצא", 404);
    const email = input.email.trim().toLowerCase();
    const contactName = input.contactName.trim() || contractor.contactName;
    if (!email) throw new SubcontractorError("יש להזין אימייל");

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { subcontractorMembership: true },
    });
    if (existingUser && existingUser.role !== SUBCONTRACTOR_ROLE) {
      throw new SubcontractorError("האימייל כבר שייך למשתמש במערכת");
    }
    if (
      existingUser?.subcontractorMembership &&
      existingUser.subcontractorMembership.subcontractorId !== subcontractorId
    ) {
      throw new SubcontractorError("המשתמש כבר משויך לקבלן משנה אחר");
    }

    const user =
      existingUser ??
      (await prisma.user.create({
        data: {
          email,
          name: contactName,
          role: SUBCONTRACTOR_ROLE,
          status: "ACTIVE",
          username: await uniqueUsername(email),
        },
      }));

    if (user.role !== SUBCONTRACTOR_ROLE) {
      throw new SubcontractorError("לא ניתן לשייך משתמש קיים שאינו קבלן משנה");
    }

    const existingCount = await prisma.subcontractorUser.count({
      where: { subcontractorId },
    });
    const portalRole =
      input.portalRole === "worker" && existingCount > 0 ? "worker" : "owner";
    await prisma.subcontractorUser.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        subcontractorId,
        contactName,
        portalRole,
        status: "active",
      },
      update: { status: "active", contactName, portalRole },
    });

    await prisma.subcontractorInvite.updateMany({
      where: { subcontractorId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const token = randomBytes(32).toString("base64url");
    const invite = await prisma.subcontractorInvite.create({
      data: {
        subcontractorId,
        email,
        contactName,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdById: actorId,
      },
    });

    await notifyUsers({
      userIds: [user.id],
      title: "הוזמנתם לפורטל קבלני המשנה",
      message: `נפתחה גישה עבור ${contractor.companyName}. יש להפעיל את החשבון בקישור שנשלח.`,
      link: "/login",
    });
    await AuditRepository.log({
      action: "USER_CREATED",
      entityType: "SubcontractorInvite",
      entityId: invite.id,
      userId: actorId,
      metadata: { subcontractorId, email },
    });

    return {
      inviteId: invite.id,
      email,
      expiresAt: invite.expiresAt.toISOString(),
      activationUrl: activationUrl(token),
      userId: user.id,
    };
  },

  async setUserAccess(
    subcontractorId: string,
    membershipId: string,
    status: "active" | "disabled",
    actorId: string
  ) {
    const membership = await prisma.subcontractorUser.findFirst({
      where: { id: membershipId, subcontractorId },
    });
    if (!membership) throw new SubcontractorError("משתמש הקבלן לא נמצא", 404);
    await prisma.subcontractorUser.update({
      where: { id: membershipId },
      data: { status },
    });
    if (status === "disabled") {
      await prisma.user.update({
        where: { id: membership.userId },
        data: { sessionVersion: { increment: 1 } },
      });
    }
    await AuditRepository.log({
      action: status === "disabled" ? "USER_DISABLED" : "USER_REACTIVATED",
      entityType: "SubcontractorUser",
      entityId: membershipId,
      userId: actorId,
      metadata: { subcontractorId, status },
    });
    return { ok: true };
  },

  async activateInvite(token: string, password: string) {
    if (!token?.trim()) throw new SubcontractorError("קישור ההפעלה אינו תקין");
    if (!password || password.length < 8) {
      throw new SubcontractorError("הסיסמה חייבת להכיל לפחות 8 תווים");
    }
    const invite = await prisma.subcontractorInvite.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!invite || invite.revokedAt) {
      throw new SubcontractorError("קישור ההפעלה אינו תקין", 404);
    }
    if (invite.acceptedAt) throw new SubcontractorError("הקישור כבר נוצל");
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new SubcontractorError("תוקף הקישור הסתיים", 410);
    }
    const user = await prisma.user.findFirst({
      where: { email: { equals: invite.email, mode: "insensitive" } },
    });
    if (!user) throw new SubcontractorError("המשתמש לא נמצא", 404);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(password),
          status: "ACTIVE",
          role: SUBCONTRACTOR_ROLE,
        },
      }),
      prisma.subcontractorInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
      prisma.subcontractorUser.updateMany({
        where: { userId: user.id, subcontractorId: invite.subcontractorId },
        data: { status: "active" },
      }),
    ]);
    return { email: user.email, name: user.name };
  },

  async projectSummary(projectId: string) {
    const [assignments, pendingMeasurements, pendingAccounts] = await Promise.all([
      prisma.subcontractorAssignment.findMany({
        where: { projectId, status: { not: "cancelled" } },
        include: { subcontractor: { select: { companyName: true, status: true } } },
      }),
      prisma.subcontractorMeasurement.count({
        where: { projectId, status: { in: ["submitted", "in_review"] } },
      }),
      prisma.subcontractorAccount.count({
        where: { projectId, status: { in: ["submitted", "pm_review"] } },
      }),
    ]);
    return {
      contractorCount: assignments.length,
      activeContractors: assignments.filter((a) => a.status === "active").length,
      openWorks: assignments.filter((a) => a.status === "active").length,
      pendingMeasurements,
      pendingAccounts,
    };
  },

  async listAssignments(opts: {
    subcontractorId?: string;
    projectId?: string;
    projectIds?: string[];
    membershipId?: string;
    portalRole?: string;
    workStatus?: string;
  }) {
    const rows = await prisma.subcontractorAssignment.findMany({
      where: {
        subcontractorId: opts.subcontractorId,
        projectId: opts.projectId,
        workStatus: opts.workStatus,
        ...(opts.projectIds ? { projectId: { in: opts.projectIds } } : {}),
        ...(opts.portalRole === "worker" && opts.membershipId
          ? { assignedUserId: opts.membershipId }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        subcontractor: { select: { id: true, code: true, companyName: true, status: true } },
        project: { select: { id: true, name: true, contractNumber: true, location: true, owner: { select: { name: true } } } },
        workSite: { select: { id: true, name: true } },
        _count: { select: { rates: true, measurements: true, accounts: true, workDiaries: true } },
      },
    });
    return rows.map((a) => ({
      id: a.id,
      subcontractorId: a.subcontractorId,
      companyName: a.subcontractor.companyName,
      contractorStatus: a.subcontractor.status,
      code: a.subcontractor.code,
      projectId: a.projectId,
      projectName: a.project.name,
      contractNumber: a.project.contractNumber,
      location: a.project.location,
      workSiteId: a.workSiteId,
      workSiteName: a.workSite?.name ?? null,
      managerId: a.managerId,
      managerName: a.project.owner?.name ?? null,
      description: a.description,
      startDate: a.startDate?.toISOString() ?? null,
      plannedEndDate: a.plannedEndDate?.toISOString() ?? null,
      engagementType: a.engagementType,
      engagementLabel: ENGAGEMENT_LABELS[a.engagementType] ?? a.engagementType,
      amount: money(a.amount),
      notes: a.notes,
      status: a.status,
      workStatus: a.workStatus,
      workStatusLabel: WORK_STATUS_LABELS[a.workStatus] ?? a.workStatus,
      reviewNotes: a.reviewNotes,
      rateCount: a._count.rates,
      measurementCount: a._count.measurements,
      accountCount: a._count.accounts,
      diaryCount: a._count.workDiaries,
    }));
  },

  async createAssignment(
    input: {
      subcontractorId: string;
      projectId: string;
      workSiteId?: string | null;
      managerId?: string | null;
      description: string;
      startDate?: string | null;
      plannedEndDate?: string | null;
      engagementType?: string;
      amount?: number | null;
      notes?: string | null;
    },
    actorId: string
  ) {
    const contractor = await prisma.subcontractor.findUnique({
      where: { id: input.subcontractorId },
    });
    if (!contractor) throw new SubcontractorError("קבלן משנה לא נמצא", 404);
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true, name: true, ownerId: true },
    });
    if (!project) throw new SubcontractorError("פרויקט לא נמצא", 404);
    if (!input.description?.trim()) throw new SubcontractorError("יש להזין תיאור עבודה");
    if (input.workSiteId) {
      const site = await prisma.projectWorkSite.findFirst({
        where: { id: input.workSiteId, projectId: input.projectId },
      });
      if (!site) throw new SubcontractorError("סניף העבודה אינו שייך לפרויקט");
    }
    const row = await prisma.subcontractorAssignment.create({
      data: {
        subcontractorId: input.subcontractorId,
        projectId: input.projectId,
        workSiteId: input.workSiteId || null,
        managerId: input.managerId || project.ownerId || null,
        description: input.description.trim(),
        startDate: input.startDate ? new Date(input.startDate) : null,
        plannedEndDate: input.plannedEndDate ? new Date(input.plannedEndDate) : null,
        engagementType: input.engagementType || "mixed",
        amount:
          input.amount != null ? new Prisma.Decimal(money(input.amount)) : null,
        notes: input.notes?.trim() || null,
        workStatus: "assigned",
        createdById: actorId,
      },
    });
    if (row.amount) {
      await addLedger({
        subcontractorId: row.subcontractorId,
        projectId: row.projectId,
        type: "engagement",
        amount: money(row.amount),
        sourceType: "assignment",
        sourceId: row.id,
        actorId,
        notes: row.description,
      });
    }
    const userIds = (
      await prisma.subcontractorUser.findMany({
        where: { subcontractorId: row.subcontractorId, status: "active" },
        select: { userId: true },
      })
    ).map((u) => u.userId);
    await notifyUsers({
      userIds,
      projectId: row.projectId,
      title: "עבודה חדשה",
      message: `הוקצתה עבודה בפרויקט ${project.name}: ${row.description}`,
      link: `/subcontractor/works/${row.id}`,
    });
    await AuditRepository.log({
      action: "CREATE",
      entityType: "SubcontractorAssignment",
      entityId: row.id,
      userId: actorId,
      metadata: { projectId: row.projectId, subcontractorId: row.subcontractorId },
    });
    return { id: row.id };
  },

  async listRates(subcontractorId: string, assignmentId?: string | null) {
    return prisma.subcontractorRate.findMany({
      where: {
        subcontractorId,
        ...(assignmentId ? { assignmentId } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  },

  async upsertRates(
    subcontractorId: string,
    assignmentId: string | null,
    items: Array<{ description: string; unit: string; unitPrice: number }>,
    actorId: string
  ) {
    if (assignmentId) {
      const assignment = await prisma.subcontractorAssignment.findFirst({
        where: { id: assignmentId, subcontractorId },
      });
      if (!assignment) throw new SubcontractorError("ההקצאה לא נמצאה", 404);
    }
    const created = await prisma.$transaction(
      items
        .filter((item) => item.description?.trim() && item.unit?.trim())
        .map((item, i) =>
          prisma.subcontractorRate.create({
            data: {
              subcontractorId,
              assignmentId,
              description: item.description.trim(),
              unit: item.unit.trim(),
              unitPrice: new Prisma.Decimal(money(item.unitPrice)),
              sortOrder: i,
            },
          })
        )
    );
    await AuditRepository.log({
      action: "CREATE",
      entityType: "SubcontractorRate",
      entityId: subcontractorId,
      userId: actorId,
      metadata: { assignmentId, count: created.length },
    });
    return created;
  },

  async addDocument(
    input: {
      subcontractorId: string;
      category: string;
      title: string;
      bucket: string;
      path: string;
      mimeType: string;
      sizeBytes: number;
    },
    actorId: string
  ) {
    return prisma.subcontractorDocument.create({
      data: { ...input, uploadedById: actorId },
    });
  },

  async listDocuments(subcontractorId: string) {
    const rows = await prisma.subcontractorDocument.findMany({
      where: { subcontractorId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((d) => ({
      id: d.id,
      category: d.category,
      categoryLabel: DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category,
      title: d.title,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      bucket: d.bucket,
      path: d.path,
      createdAt: d.createdAt.toISOString(),
    }));
  },

  async createWorkDiary(
    input: {
      assignmentId: string;
      workDate: Date;
      workSummary?: string;
      notes?: string;
      workItems?: Array<{ description: string; unit?: string; quantity?: number; notes?: string }>;
      hours?: number;
    },
    actor: { userId: string; role: string; subcontractorId?: string }
  ) {
    const assignment = await prisma.subcontractorAssignment.findUnique({
      where: { id: input.assignmentId },
      include: { project: { select: { id: true, name: true, foremanId: true } } },
    });
    if (!assignment) throw new SubcontractorError("הקצאה לא נמצאה", 404);
    if (
      actor.subcontractorId &&
      actor.subcontractorId !== assignment.subcontractorId
    ) {
      throw new SubcontractorError("אין הרשאה להקצאה זו", 403);
    }
    const diary = await WorkDiariesRepository.create({
      projectId: assignment.projectId,
      workSiteId: assignment.workSiteId,
      foremanId: assignment.project.foremanId,
      workDate: input.workDate,
      workType: "קבלן משנה",
      workSummary: input.workSummary ?? assignment.description,
      notes: input.notes ?? null,
      workItems: input.workItems,
      workers: input.hours
        ? [{ name: "קבלן משנה", hours: input.hours, role: "קבלן" }]
        : [],
      createdById: actor.userId,
      createdByRole: actor.role,
    });
    if (!diary) throw new SubcontractorError("יצירת היומן נכשלה");
    await prisma.workDiary.update({
      where: { id: diary.id },
      data: {
        subcontractorId: assignment.subcontractorId,
        assignmentId: assignment.id,
      },
    });
    const officeIds = (
      await prisma.user.findMany({
        where: {
          OR: [
            ...(assignment.managerId ? [{ id: assignment.managerId }] : []),
            { role: { in: ["SYSTEM_MANAGER", "OPERATIONS_MANAGER"] } },
          ],
        },
        select: { id: true },
        take: 20,
      })
    ).map((u) => u.id);
    await notifyUsers({
      userIds: officeIds,
      projectId: assignment.projectId,
      title: "יומן חדש מקבלן משנה",
      message: `דווח יומן עבור ${assignment.project.name}`,
      link: `/system/accounts?projectId=${assignment.projectId}&module=workDiaries`,
    });
    return { id: diary.id, documentNumber: diary.documentNumber };
  },

  async listWorkDiaries(opts: { subcontractorId?: string; projectId?: string }) {
    const rows = await prisma.workDiary.findMany({
      where: {
        deletedAt: null,
        subcontractorId: opts.subcontractorId,
        projectId: opts.projectId,
      },
      orderBy: { workDate: "desc" },
      take: 80,
      include: {
        project: { select: { id: true, name: true } },
        workSite: { select: { id: true, name: true } },
        workflowDocument: { select: { status: true } },
        media: { select: { id: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignmentId,
      documentNumber: row.documentNumber,
      projectId: row.projectId,
      projectName: row.project.name,
      workSiteName: row.workSite?.name ?? row.customSiteName,
      workDate: row.workDate.toISOString().slice(0, 10),
      workSummary: row.workSummary,
      status: row.workflowDocument?.status ?? row.status,
      mediaCount: row.media.length,
      signedPdfUrl: row.signedPdfUrl,
    }));
  },

  async createMeasurement(
    input: {
      assignmentId: string;
      notes?: string;
      items: Array<{
        rateId?: string;
        description: string;
        unit: string;
        reportedQty: number;
        unitPrice?: number;
        notes?: string;
      }>;
    },
    actor: { userId: string; subcontractorId?: string }
  ) {
    const assignment = await prisma.subcontractorAssignment.findUnique({
      where: { id: input.assignmentId },
      include: { rates: true },
    });
    if (!assignment) throw new SubcontractorError("הקצאה לא נמצאה", 404);
    if (actor.subcontractorId && actor.subcontractorId !== assignment.subcontractorId) {
      throw new SubcontractorError("אין הרשאה להקצאה זו", 403);
    }
    if (!input.items?.length) throw new SubcontractorError("יש להוסיף לפחות סעיף אחד");
    const row = await prisma.subcontractorMeasurement.create({
      data: {
        subcontractorId: assignment.subcontractorId,
        assignmentId: assignment.id,
        projectId: assignment.projectId,
        notes: input.notes?.trim() || null,
        createdById: actor.userId,
        items: {
          create: input.items.map((item) => {
            const rate = item.rateId
              ? assignment.rates.find((r) => r.id === item.rateId)
              : null;
            return {
              rateId: rate?.id ?? item.rateId ?? null,
              description: item.description.trim(),
              unit: item.unit.trim(),
              reportedQty: new Prisma.Decimal(qty(item.reportedQty)),
              unitPrice: new Prisma.Decimal(
                money(rate ? Number(rate.unitPrice) : item.unitPrice ?? 0)
              ),
              notes: item.notes?.trim() || null,
            };
          }),
        },
      },
      include: { items: true },
    });
    const reported = row.items.reduce(
      (sum, item) => sum + money(item.unitPrice) * qty(item.reportedQty),
      0
    );
    await addLedger({
      subcontractorId: assignment.subcontractorId,
      projectId: assignment.projectId,
      type: "reported",
      amount: reported,
      sourceType: "measurement",
      sourceId: row.id,
      actorId: actor.userId,
      notes: "ביצוע מדווח",
    });
    return this.getMeasurement(row.id);
  },

  async getMeasurement(id: string) {
    const row = await prisma.subcontractorMeasurement.findUnique({
      where: { id },
      include: {
        items: true,
        assignment: {
          select: {
            description: true,
            workSite: { select: { name: true } },
          },
        },
        project: { select: { id: true, name: true } },
        subcontractor: { select: { id: true, companyName: true } },
      },
    });
    if (!row) throw new SubcontractorError("מדידה לא נמצאה", 404);
    return {
      id: row.id,
      subcontractorId: row.subcontractorId,
      companyName: row.subcontractor.companyName,
      assignmentId: row.assignmentId,
      assignmentDescription: row.assignment.description,
      workSiteName: row.assignment.workSite?.name ?? null,
      projectId: row.projectId,
      projectName: row.project.name,
      status: row.status,
      statusLabel: MEASUREMENT_STATUS_LABELS[row.status] ?? row.status,
      notes: row.notes,
      reviewNotes: row.reviewNotes,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      items: row.items.map((item) => ({
        id: item.id,
        rateId: item.rateId,
        description: item.description,
        unit: item.unit,
        reportedQty: qty(item.reportedQty),
        approvedQty: item.approvedQty == null ? null : qty(item.approvedQty),
        unitPrice: money(item.unitPrice),
        reportedAmount: money(qty(item.reportedQty) * money(item.unitPrice)),
        approvedAmount:
          item.approvedQty == null
            ? null
            : money(qty(item.approvedQty) * money(item.unitPrice)),
        billed: item.billed,
        notes: item.notes,
      })),
      reportedTotal: row.items.reduce(
        (s, i) => s + money(qty(i.reportedQty) * money(i.unitPrice)),
        0
      ),
      approvedTotal: row.items.reduce(
        (s, i) =>
          s + (i.approvedQty == null ? 0 : money(qty(i.approvedQty) * money(i.unitPrice))),
        0
      ),
    };
  },

  async submitMeasurement(id: string, actorId: string, subcontractorId?: string) {
    const row = await prisma.subcontractorMeasurement.findUnique({ where: { id } });
    if (!row) throw new SubcontractorError("מדידה לא נמצאה", 404);
    if (subcontractorId && row.subcontractorId !== subcontractorId) {
      throw new SubcontractorError("אין הרשאה למדידה זו", 403);
    }
    if (!["draft", "returned"].includes(row.status)) {
      throw new SubcontractorError("ניתן להגיש רק טיוטה או מדידה שהוחזרה");
    }
    await prisma.subcontractorMeasurement.update({
      where: { id },
      data: { status: "submitted", submittedAt: new Date() },
    });
    await notifyUsers({
      userIds: (
        await prisma.user.findMany({
          where: { role: { in: ["SYSTEM_MANAGER", "OPERATIONS_MANAGER", "PROJECT_MANAGER"] } },
          select: { id: true },
          take: 20,
        })
      ).map((u) => u.id),
      projectId: row.projectId,
      title: "מדידת קבלן הוגשה",
      message: "מדידת ביצוע ממתינה לבדיקה",
      link: `/system/subcontractors/${row.subcontractorId}`,
    });
    await AuditRepository.log({
      action: "UPDATE",
      entityType: "SubcontractorMeasurement",
      entityId: id,
      userId: actorId,
      metadata: { action: "submit" },
    });
    return this.getMeasurement(id);
  },

  async reviewMeasurement(
    id: string,
    input: {
      action: "approve" | "return" | "partial";
      items?: Array<{ id: string; approvedQty: number }>;
      reviewNotes?: string;
    },
    actorId: string
  ) {
    const row = await prisma.subcontractorMeasurement.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!row) throw new SubcontractorError("מדידה לא נמצאה", 404);
    if (!["submitted", "in_review", "partial"].includes(row.status)) {
      throw new SubcontractorError("המדידה אינה ממתינה לבדיקה");
    }
    if (input.action === "return") {
      await prisma.subcontractorMeasurement.update({
        where: { id },
        data: {
          status: "returned",
          reviewNotes: input.reviewNotes?.trim() || null,
          reviewedAt: new Date(),
          reviewedById: actorId,
        },
      });
      await notifyContractor(row.subcontractorId, row.projectId, "החזרה לתיקון", "מדידה הוחזרה לתיקון");
      return this.getMeasurement(id);
    }
    const updates = input.items ?? row.items.map((item) => ({
      id: item.id,
      approvedQty: qty(item.reportedQty),
    }));
    await prisma.$transaction(
      updates.map((item) =>
        prisma.subcontractorMeasurementItem.update({
          where: { id: item.id },
          data: { approvedQty: new Prisma.Decimal(qty(item.approvedQty)) },
        })
      )
    );
    const refreshed = await prisma.subcontractorMeasurementItem.findMany({
      where: { measurementId: id },
    });
    const allApproved = refreshed.every(
      (item) => item.approvedQty != null && qty(item.approvedQty) === qty(item.reportedQty)
    );
    const status = input.action === "partial" || !allApproved ? "partial" : "approved";
    await prisma.subcontractorMeasurement.update({
      where: { id },
      data: {
        status,
        reviewNotes: input.reviewNotes?.trim() || null,
        reviewedAt: new Date(),
        reviewedById: actorId,
      },
    });
    const approvedTotal = refreshed.reduce(
      (s, i) => s + (i.approvedQty == null ? 0 : money(qty(i.approvedQty) * money(i.unitPrice))),
      0
    );
    await addLedger({
      subcontractorId: row.subcontractorId,
      projectId: row.projectId,
      type: "approved",
      amount: approvedTotal,
      sourceType: "measurement",
      sourceId: id,
      actorId,
      notes: status === "approved" ? "מדידה מאושרת" : "אישור חלקי",
    });
    await notifyContractor(row.subcontractorId, row.projectId, "אישור מדידה", "מדידת ביצוע עודכנה");
    return this.getMeasurement(id);
  },

  async listMeasurements(opts: {
    subcontractorId?: string;
    projectId?: string;
    assignmentId?: string;
    status?: string;
  }) {
    const rows = await prisma.subcontractorMeasurement.findMany({
      where: {
        subcontractorId: opts.subcontractorId,
        projectId: opts.projectId,
        assignmentId: opts.assignmentId,
        status: opts.status,
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        project: { select: { name: true } },
        assignment: {
          select: {
            description: true,
            workSite: { select: { name: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignmentId,
      status: row.status,
      statusLabel: MEASUREMENT_STATUS_LABELS[row.status] ?? row.status,
      projectName: row.project.name,
      workSiteName: row.assignment.workSite?.name ?? null,
      assignmentDescription: row.assignment.description,
      itemCount: row.items.length,
      reportedTotal: row.items.reduce(
        (s, i) => s + money(qty(i.reportedQty) * money(i.unitPrice)),
        0
      ),
      approvedTotal: row.items.reduce(
        (s, i) =>
          s + (i.approvedQty == null ? 0 : money(qty(i.approvedQty) * money(i.unitPrice))),
        0
      ),
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async createAccount(
    input: {
      assignmentId: string;
      measurementIds?: string[];
      periodStart?: string | null;
      periodEnd?: string | null;
      vatRate?: number;
      deductions?: number;
      advances?: number;
      retention?: number;
      notes?: string;
      officialInvoiceRef?: string;
    },
    actor: { userId: string; subcontractorId?: string }
  ) {
    const assignment = await prisma.subcontractorAssignment.findUnique({
      where: { id: input.assignmentId },
    });
    if (!assignment) throw new SubcontractorError("הקצאה לא נמצאה", 404);
    if (actor.subcontractorId && actor.subcontractorId !== assignment.subcontractorId) {
      throw new SubcontractorError("אין הרשאה להקצאה זו", 403);
    }
    const items = await prisma.subcontractorMeasurementItem.findMany({
      where: {
        billed: false,
        approvedQty: { not: null },
        measurement: {
          subcontractorId: assignment.subcontractorId,
          assignmentId: assignment.id,
          status: { in: ["approved", "partial"] },
          ...(input.measurementIds?.length
            ? { id: { in: input.measurementIds } }
            : {}),
        },
      },
    });
    const billable = items.filter((item) => qty(item.approvedQty) > 0);
    if (!billable.length) {
      throw new SubcontractorError("אין כמויות מאושרות שטרם חויבו");
    }
    const subtotal = billable.reduce(
      (s, i) => s + money(qty(i.approvedQty) * money(i.unitPrice)),
      0
    );
    const vatRate = input.vatRate ?? 18;
    const vatAmount = money((subtotal * vatRate) / 100);
    const deductions = money(input.deductions);
    const advances = money(input.advances);
    const retention = money(input.retention);
    const payable = money(subtotal + vatAmount - deductions - advances - retention);
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.subcontractorAccount.create({
        data: {
          subcontractorId: assignment.subcontractorId,
          assignmentId: assignment.id,
          projectId: assignment.projectId,
          periodStart: input.periodStart ? new Date(input.periodStart) : null,
          periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
          subtotal: new Prisma.Decimal(subtotal),
          vatRate: new Prisma.Decimal(vatRate),
          vatAmount: new Prisma.Decimal(vatAmount),
          deductions: new Prisma.Decimal(deductions),
          advances: new Prisma.Decimal(advances),
          retention: new Prisma.Decimal(retention),
          payable: new Prisma.Decimal(payable),
          notes: input.notes?.trim() || null,
          officialInvoiceRef: input.officialInvoiceRef?.trim() || null,
          createdById: actor.userId,
          items: {
            create: billable.map((item) => ({
              measurementItemId: item.id,
              description: item.description,
              qty: item.approvedQty ?? new Prisma.Decimal(0),
              unit: item.unit,
              unitPrice: item.unitPrice,
              amount: new Prisma.Decimal(money(qty(item.approvedQty) * money(item.unitPrice))),
            })),
          },
        },
      });
      await tx.subcontractorMeasurementItem.updateMany({
        where: { id: { in: billable.map((i) => i.id) } },
        data: { billed: true },
      });
      return created;
    });
    await addLedger({
      subcontractorId: assignment.subcontractorId,
      projectId: assignment.projectId,
      type: "account_submitted",
      amount: payable,
      sourceType: "account",
      sourceId: account.id,
      actorId: actor.userId,
      notes: "חשבון פנימי נוצר מביצוע מאושר",
    });
    return this.getAccount(account.id);
  },

  async getAccount(id: string) {
    const row = await prisma.subcontractorAccount.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { paidAt: "desc" } },
        project: { select: { id: true, name: true } },
        subcontractor: { select: { id: true, companyName: true } },
        assignment: { select: { description: true } },
      },
    });
    if (!row) throw new SubcontractorError("חשבון לא נמצא", 404);
    const paid = row.payments
      .filter((p) => !p.voidedAt)
      .reduce((s, p) => s + money(p.amount), 0);
    return {
      id: row.id,
      subcontractorId: row.subcontractorId,
      companyName: row.subcontractor.companyName,
      assignmentId: row.assignmentId,
      assignmentDescription: row.assignment.description,
      projectId: row.projectId,
      projectName: row.project.name,
      periodStart: row.periodStart?.toISOString() ?? null,
      periodEnd: row.periodEnd?.toISOString() ?? null,
      status: row.status,
      statusLabel: ACCOUNT_STATUS_LABELS[row.status] ?? row.status,
      subtotal: money(row.subtotal),
      vatRate: money(row.vatRate),
      vatAmount: money(row.vatAmount),
      deductions: money(row.deductions),
      advances: money(row.advances),
      retention: money(row.retention),
      payable: money(row.payable),
      paid,
      remaining: money(money(row.payable) - paid),
      notes: row.notes,
      officialInvoiceRef: row.officialInvoiceRef,
      items: row.items.map((item) => ({
        id: item.id,
        description: item.description,
        qty: qty(item.qty),
        unit: item.unit,
        unitPrice: money(item.unitPrice),
        amount: money(item.amount),
      })),
      payments: row.payments.map((p) => ({
        id: p.id,
        amount: money(p.amount),
        paidAt: p.paidAt.toISOString(),
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        voidedAt: p.voidedAt?.toISOString() ?? null,
        voidReason: p.voidReason,
      })),
      createdAt: row.createdAt.toISOString(),
    };
  },

  async transitionAccount(
    id: string,
    action: "submit" | "pm_review" | "approve" | "return" | "ready",
    actorId: string,
    notes?: string
  ) {
    const row = await prisma.subcontractorAccount.findUnique({ where: { id } });
    if (!row) throw new SubcontractorError("חשבון לא נמצא", 404);
    const next: Record<string, string> = {
      submit: "submitted",
      pm_review: "pm_review",
      approve: "approved",
      return: "returned",
      ready: "ready_for_payment",
    };
    const status = next[action];
    if (!status) throw new SubcontractorError("פעולה לא חוקית");
    await prisma.subcontractorAccount.update({
      where: { id },
      data: {
        status,
        notes: notes?.trim() || row.notes,
        submittedAt: action === "submit" ? new Date() : row.submittedAt,
        approvedAt: action === "approve" || action === "ready" ? new Date() : row.approvedAt,
        approvedById:
          action === "approve" || action === "ready" ? actorId : row.approvedById,
      },
    });
    if (action === "approve" || action === "ready") {
      await addLedger({
        subcontractorId: row.subcontractorId,
        projectId: row.projectId,
        type: "account_approved",
        amount: money(row.payable),
        sourceType: "account",
        sourceId: id,
        actorId,
        notes: "חשבון מאושר לתשלום",
      });
      await notifyContractor(row.subcontractorId, row.projectId, "אישור חשבון", "חשבון אושר");
    }
    if (action === "return") {
      await notifyContractor(row.subcontractorId, row.projectId, "החזרה לתיקון", "חשבון הוחזר לתיקון");
    }
    return this.getAccount(id);
  },

  async listAccounts(opts: { subcontractorId?: string; projectId?: string; status?: string }) {
    const rows = await prisma.subcontractorAccount.findMany({
      where: {
        subcontractorId: opts.subcontractorId,
        projectId: opts.projectId,
        status: opts.status,
      },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true } },
        payments: { where: { voidedAt: null }, select: { amount: true } },
      },
    });
    return rows.map((row) => {
      const paid = row.payments.reduce((s, p) => s + money(p.amount), 0);
      return {
        id: row.id,
        status: row.status,
        statusLabel: ACCOUNT_STATUS_LABELS[row.status] ?? row.status,
        projectName: row.project.name,
        assignmentId: row.assignmentId,
        subtotal: money(row.subtotal),
        vatRate: money(row.vatRate),
        vatAmount: money(row.vatAmount),
        payable: money(row.payable),
        paid,
        remaining: money(money(row.payable) - paid),
        createdAt: row.createdAt.toISOString(),
      };
    });
  },

  async recordPayment(
    input: {
      subcontractorId: string;
      accountId?: string | null;
      amount: number;
      paidAt: string;
      method: string;
      reference?: string;
      notes?: string;
      documentPath?: string;
      documentBucket?: string;
    },
    actorId: string
  ) {
    const amount = money(input.amount);
    if (amount <= 0) throw new SubcontractorError("יש להזין סכום תשלום");
    if (input.reference?.trim()) {
      const dup = await prisma.subcontractorPayment.findFirst({
        where: {
          subcontractorId: input.subcontractorId,
          reference: input.reference.trim(),
          voidedAt: null,
        },
      });
      if (dup) throw new SubcontractorError("תשלום עם אותה אסמכתה כבר קיים");
    }
    let projectId: string | null = null;
    if (input.accountId) {
      const account = await prisma.subcontractorAccount.findUnique({
        where: { id: input.accountId },
        include: { payments: { where: { voidedAt: null } } },
      });
      if (!account || account.subcontractorId !== input.subcontractorId) {
        throw new SubcontractorError("חשבון לא נמצא", 404);
      }
      projectId = account.projectId;
      const paid = account.payments.reduce((s, p) => s + money(p.amount), 0);
      if (paid + amount - money(account.payable) > 0.009) {
        throw new SubcontractorError("התשלום חורג מהיתרה בחשבון");
      }
    }
    const payment = await prisma.subcontractorPayment.create({
      data: {
        subcontractorId: input.subcontractorId,
        accountId: input.accountId || null,
        amount: new Prisma.Decimal(amount),
        paidAt: new Date(input.paidAt),
        method: input.method || "transfer",
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        documentPath: input.documentPath ?? null,
        documentBucket: input.documentBucket ?? null,
        createdById: actorId,
      },
    });
    if (input.accountId) {
      const account = await this.getAccount(input.accountId);
      if (account.remaining <= 0.009) {
        await prisma.subcontractorAccount.update({
          where: { id: input.accountId },
          data: { status: "paid" },
        });
      } else if (account.status === "approved") {
        await prisma.subcontractorAccount.update({
          where: { id: input.accountId },
          data: { status: "ready_for_payment" },
        });
      }
    }
    await addLedger({
      subcontractorId: input.subcontractorId,
      projectId,
      type: "payment",
      amount: -amount,
      date: payment.paidAt,
      reference: payment.reference,
      sourceType: "payment",
      sourceId: payment.id,
      actorId,
      notes: "רישום תשלום",
    });
    await notifyContractor(
      input.subcontractorId,
      projectId,
      "רישום תשלום",
      `נרשם תשלום בסך ${amount.toLocaleString("he-IL")} ₪`
    );
    return { id: payment.id };
  },

  async voidPayment(id: string, reason: string, actorId: string) {
    const payment = await prisma.subcontractorPayment.findUnique({ where: { id } });
    if (!payment) throw new SubcontractorError("תשלום לא נמצא", 404);
    if (payment.voidedAt) throw new SubcontractorError("התשלום כבר בוטל");
    await prisma.subcontractorPayment.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidReason: reason.trim() || "תיקון מתועד",
        voidedById: actorId,
      },
    });
    await addLedger({
      subcontractorId: payment.subcontractorId,
      type: "correction",
      amount: money(payment.amount),
      reference: payment.reference,
      sourceType: "payment",
      sourceId: payment.id,
      actorId,
      notes: reason.trim() || "ביטול תשלום מתועד",
    });
    return { ok: true };
  },

  async ledger(subcontractorId: string) {
    const [contractor, assignments, measurements, accounts, payments, entries] =
      await Promise.all([
        prisma.subcontractor.findUnique({ where: { id: subcontractorId } }),
        prisma.subcontractorAssignment.findMany({ where: { subcontractorId } }),
        prisma.subcontractorMeasurement.findMany({
          where: { subcontractorId },
          include: { items: true },
        }),
        prisma.subcontractorAccount.findMany({ where: { subcontractorId } }),
        prisma.subcontractorPayment.findMany({
          where: { subcontractorId, voidedAt: null },
        }),
        prisma.subcontractorLedgerEntry.findMany({
          where: { subcontractorId },
          orderBy: { date: "desc" },
          include: {
            actor: { select: { name: true } },
            project: { select: { name: true } },
          },
        }),
      ]);
    if (!contractor) throw new SubcontractorError("קבלן משנה לא נמצא", 404);
    const engagement = assignments.reduce((s, a) => s + money(a.amount), 0);
    const reported = measurements.reduce(
      (s, m) =>
        s + m.items.reduce((x, i) => x + money(qty(i.reportedQty) * money(i.unitPrice)), 0),
      0
    );
    const approved = measurements.reduce(
      (s, m) =>
        s +
        m.items.reduce(
          (x, i) =>
            x + (i.approvedQty == null ? 0 : money(qty(i.approvedQty) * money(i.unitPrice))),
          0
        ),
      0
    );
    const submitted = accounts
      .filter((a) => !["draft", "returned"].includes(a.status))
      .reduce((s, a) => s + money(a.payable), 0);
    const approvedAccounts = accounts
      .filter((a) => ["approved", "ready_for_payment", "paid"].includes(a.status))
      .reduce((s, a) => s + money(a.payable), 0);
    const paid = payments.reduce((s, p) => s + money(p.amount), 0);
    const advances = accounts.reduce((s, a) => s + money(a.advances), 0);
    const deductions = accounts.reduce((s, a) => s + money(a.deductions), 0);
    return {
      totals: {
        engagement,
        reported,
        approved,
        submitted,
        approvedAccounts,
        paid,
        advances,
        deductions,
        approvedPayable: Math.max(0, money(approvedAccounts - paid)),
      },
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: money(e.amount),
        date: e.date.toISOString(),
        reference: e.reference,
        projectName: e.project?.name ?? null,
        actorName: e.actor?.name ?? null,
        notes: e.notes,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
      })),
    };
  },

  async portalHome(
    subcontractorId: string,
    access?: { membershipId?: string; portalRole?: string; canViewFinance?: boolean }
  ) {
    const [assignments, diaries, measurements, accounts, payments, documents, notifications] =
      await Promise.all([
        this.listAssignments({
          subcontractorId,
          membershipId: access?.membershipId,
          portalRole: access?.portalRole,
        }),
        this.listWorkDiaries({ subcontractorId }),
        this.listMeasurements({ subcontractorId }),
        this.listAccounts({ subcontractorId }),
        prisma.subcontractorPayment.findMany({
          where: { subcontractorId, voidedAt: null },
          orderBy: { paidAt: "desc" },
          take: 8,
        }),
        this.listDocuments(subcontractorId),
        prisma.notification.findMany({
          where: {
            user: { subcontractorMembership: { subcontractorId } },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
      ]);
    const ledger = await this.ledger(subcontractorId);
    return {
      assignments: assignments.filter((a) => a.status === "active"),
      diaries,
      measurements,
      accounts,
      payments: payments.map((p) => ({
        id: p.id,
        amount: money(p.amount),
        paidAt: p.paidAt.toISOString(),
        method: p.method,
        reference: p.reference,
      })),
      documents,
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        createdAt: n.createdAt.toISOString(),
        read: n.read,
        link: n.link,
      })),
      finance: access?.canViewFinance === false ? null : ledger.totals,
    };
  },

  async getAssignmentDetail(
    id: string,
    access: { subcontractorId?: string; membershipId?: string; portalRole?: string }
  ) {
    const row = await prisma.subcontractorAssignment.findUnique({
      where: { id },
      include: {
        subcontractor: { select: { id: true, companyName: true } },
        project: {
          select: {
            id: true,
            name: true,
            location: true,
            contractNumber: true,
            owner: { select: { name: true } },
          },
        },
        workSite: { select: { id: true, name: true, address: true } },
        rates: { orderBy: { sortOrder: "asc" } },
        workDiaries: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            workflowDocument: { select: { status: true } },
            media: { select: { id: true, name: true, url: true, stage: true } },
          },
        },
        measurements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { items: { select: { id: true } } },
        },
      },
    });
    if (!row) throw new SubcontractorError("עבודה לא נמצאה", 404);
    if (access.subcontractorId && row.subcontractorId !== access.subcontractorId) {
      throw new SubcontractorError("אין הרשאה לעבודה זו", 403);
    }
    if (
      access.portalRole === "worker" &&
      access.membershipId &&
      row.assignedUserId !== access.membershipId
    ) {
      throw new SubcontractorError("אין הרשאה לעבודה זו", 403);
    }
    const documents = (await this.listDocuments(row.subcontractorId)).map(
      ({ id, category, categoryLabel, title, mimeType, sizeBytes, createdAt }) => ({
        id,
        category,
        categoryLabel,
        title,
        mimeType,
        sizeBytes,
        createdAt,
      })
    );
    return {
      id: row.id,
      subcontractorId: row.subcontractorId,
      companyName: row.subcontractor.companyName,
      projectId: row.projectId,
      projectName: row.project.name,
      contractNumber: row.project.contractNumber,
      location: row.workSite?.address || row.project.location,
      workSiteName: row.workSite?.name ?? null,
      managerName: row.project.owner?.name ?? null,
      description: row.description,
      notes: row.notes,
      startDate: row.startDate?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      engagementType: row.engagementType,
      engagementLabel: ENGAGEMENT_LABELS[row.engagementType] ?? row.engagementType,
      workStatus: row.workStatus,
      workStatusLabel: WORK_STATUS_LABELS[row.workStatus] ?? row.workStatus,
      reviewNotes: row.reviewNotes,
      tasks: row.rates.map((r) => ({
        id: r.id,
        description: r.description,
        unit: r.unit,
        unitPrice: money(r.unitPrice),
      })),
      diaries: row.workDiaries.map((d) => ({
        id: d.id,
        documentNumber: d.documentNumber,
        workDate: d.workDate.toISOString().slice(0, 10),
        workSummary: d.workSummary,
        status: d.workflowDocument?.status ?? d.status,
        signedPdfUrl: d.signedPdfUrl,
        media: d.media,
      })),
      measurements: row.measurements.map((m) => ({
        id: m.id,
        status: m.status,
        statusLabel: MEASUREMENT_STATUS_LABELS[m.status] ?? m.status,
        itemCount: m.items.length,
        createdAt: m.createdAt.toISOString(),
      })),
      documents,
      history: [
        { label: "הוקצתה", at: row.createdAt.toISOString() },
        row.startedAt ? { label: "החלה", at: row.startedAt.toISOString() } : null,
        row.submittedAt ? { label: "נשלחה לאישור", at: row.submittedAt.toISOString() } : null,
        row.reviewedAt
          ? {
              label: row.workStatus === "returned" ? "הוחזרה לתיקון" : "נסקרה",
              at: row.reviewedAt.toISOString(),
            }
          : null,
      ].filter((item): item is { label: string; at: string } => Boolean(item)),
    };
  },

  async startWork(
    id: string,
    access: { userId: string; subcontractorId: string; membershipId: string; portalRole: string }
  ) {
    const row = await this.getAssignmentDetail(id, access);
    if (!["assigned", "returned"].includes(row.workStatus)) {
      throw new SubcontractorError("לא ניתן להתחיל עבודה במצב הנוכחי");
    }
    await prisma.subcontractorAssignment.update({
      where: { id },
      data: { workStatus: "in_progress", startedAt: new Date() },
    });
    return this.getAssignmentDetail(id, access);
  },

  async submitWork(
    id: string,
    input: {
      workSummary?: string;
      notes?: string;
      hours?: number;
      workItems?: Array<{ description: string; unit?: string; quantity?: number; notes?: string }>;
    },
    access: {
      userId: string;
      role: string;
      subcontractorId: string;
      membershipId: string;
      portalRole: string;
    }
  ) {
    const row = await prisma.subcontractorAssignment.findUnique({ where: { id } });
    if (!row) throw new SubcontractorError("עבודה לא נמצאה", 404);
    await this.getAssignmentDetail(id, access);
    if (!["in_progress", "returned"].includes(row.workStatus)) {
      throw new SubcontractorError("יש להתחיל את העבודה לפני שליחה לאישור");
    }
    const diary = await this.createWorkDiary(
      {
        assignmentId: id,
        workDate: new Date(),
        workSummary: input.workSummary,
        notes: input.notes,
        workItems: input.workItems,
        hours: input.hours,
      },
      access
    );
    await prisma.subcontractorAssignment.update({
      where: { id },
      data: { workStatus: "submitted", submittedAt: new Date() },
    });
    await notifyUsers({
      userIds: (
        await prisma.user.findMany({
          where: {
            OR: [
              ...(row.managerId ? [{ id: row.managerId }] : []),
              { role: { in: ["SYSTEM_MANAGER", "OPERATIONS_MANAGER"] } },
            ],
          },
          select: { id: true },
          take: 20,
        })
      ).map((u) => u.id),
      projectId: row.projectId,
      title: "דיווח שהוגש",
      message: "קבלן משנה שלח דיווח לאישור",
      link: "/system/subcontractors/inbox",
    });
    return { ...diary, workStatus: "submitted" };
  },

  async reviewWork(
    id: string,
    input: { action: "approve" | "return" | "partial"; reviewNotes?: string },
    actorId: string
  ) {
    const row = await prisma.subcontractorAssignment.findUnique({
      where: { id },
      include: {
        rates: true,
        workDiaries: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { workItems: true },
        },
      },
    });
    if (!row) throw new SubcontractorError("עבודה לא נמצאה", 404);
    if (row.workStatus !== "submitted") {
      throw new SubcontractorError("הדיווח אינו ממתין לאישור");
    }
    if (input.action === "return") {
      if (!input.reviewNotes?.trim()) {
        throw new SubcontractorError("חובה להזין סיבה להחזרה לתיקון");
      }
      await prisma.subcontractorAssignment.update({
        where: { id },
        data: {
          workStatus: "returned",
          reviewNotes: input.reviewNotes.trim(),
          reviewedAt: new Date(),
        },
      });
      await notifyContractor(row.subcontractorId, row.projectId, "דיווח שהוחזר", input.reviewNotes);
      return { id, workStatus: "returned" };
    }
    const diary = row.workDiaries[0];
    const items = (diary?.workItems ?? []).length
      ? diary!.workItems.map((item) => ({
          description: item.description,
          unit: item.unit,
          reportedQty: qty(item.quantity),
          unitPrice:
            Number(row.rates.find((r) => r.description === item.description)?.unitPrice ?? 0),
        }))
      : row.rates.slice(0, 1).map((r) => ({
          description: r.description,
          unit: r.unit,
          reportedQty: 1,
          unitPrice: money(r.unitPrice),
        }));
    if (items.length) {
      const measurement = await this.createMeasurement(
        { assignmentId: id, items, notes: "נוצר מאישור דיווח ביצוע" },
        { userId: actorId, subcontractorId: row.subcontractorId }
      );
      await this.submitMeasurement(measurement.id, actorId, row.subcontractorId);
      await this.reviewMeasurement(
        measurement.id,
        { action: input.action === "partial" ? "partial" : "approve" },
        actorId
      );
    }
    await prisma.subcontractorAssignment.update({
      where: { id },
      data: {
        workStatus: input.action === "partial" ? "partial" : "approved",
        reviewNotes: input.reviewNotes?.trim() || null,
        reviewedAt: new Date(),
      },
    });
    await notifyContractor(
      row.subcontractorId,
      row.projectId,
      "דיווח שאושר",
      "הביצוע אושר וזמין למדידה ולהתחשבנות"
    );
    return { id, workStatus: input.action === "partial" ? "partial" : "approved" };
  },

  async listPendingReports(projectIds?: string[]) {
    const rows = await prisma.subcontractorAssignment.findMany({
      where: {
        workStatus: "submitted",
        status: { not: "cancelled" },
        ...(projectIds ? { projectId: { in: projectIds } } : {}),
      },
      orderBy: { submittedAt: "desc" },
      include: {
        subcontractor: { select: { companyName: true } },
        project: { select: { name: true } },
        workSite: { select: { name: true } },
        workDiaries: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { workItems: true, media: true },
        },
      },
    });
    return rows.map((row) => {
      const diary = row.workDiaries[0];
      return {
        id: row.id,
        companyName: row.subcontractor.companyName,
        projectName: row.project.name,
        workSiteName: row.workSite?.name ?? null,
        workDate: diary?.workDate.toISOString().slice(0, 10) ?? row.submittedAt?.toISOString().slice(0, 10),
        description: row.description,
        workSummary: diary?.workSummary ?? null,
        reportedQty: (diary?.workItems ?? []).reduce((s, i) => s + qty(i.quantity), 0),
        photoCount: diary?.media?.length ?? 0,
        diaryId: diary?.id ?? null,
      };
    });
  },
};

async function notifyContractor(
  subcontractorId: string,
  projectId: string | null,
  title: string,
  message: string
) {
  const users = await prisma.subcontractorUser.findMany({
    where: { subcontractorId, status: "active" },
    select: { userId: true },
  });
  await notifyUsers({
    userIds: users.map((u) => u.userId),
    projectId,
    title,
    message,
    link: "/subcontractor/finance",
  });
}

async function uniqueUsername(email: string): Promise<string> {
  const base = email.split("@")[0]?.replace(/[^a-zA-Z0-9._-]/g, "") || "sub";
  let candidate = base.slice(0, 24);
  for (let i = 0; i < 8; i++) {
    const exists = await prisma.user.findUnique({ where: { username: candidate } });
    if (!exists) return candidate;
    candidate = `${base.slice(0, 18)}${Math.floor(Math.random() * 900 + 100)}`;
  }
  return `${base.slice(0, 12)}${Date.now().toString(36)}`;
}
