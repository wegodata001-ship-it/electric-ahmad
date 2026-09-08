import type {
  Project,
  BoqItem,
  Employee,
  WorkReport,
  Document,
  PartialInvoice,
  GalleryItem,
  Activity,
  Notification,
  DashboardKPIs,
} from "@/types";
import type {
  Project as PrismaProject,
  BoqItem as PrismaBoqItem,
  Employee as PrismaEmployee,
  WorkReport as PrismaWorkReport,
  Document as PrismaDocument,
  PartialInvoice as PrismaPartialInvoice,
  GalleryItem as PrismaGalleryItem,
  Activity as PrismaActivity,
  Notification as PrismaNotification,
  Prisma,
} from "@prisma/client";
import { cleanBoqDescription } from "@/utils/boq-text";
import { availableForInvoice } from "@/utils/invoice-calc";

type ProjectWithRelations = PrismaProject & {
  foreman: PrismaEmployee;
  employees?: { employeeId: string }[];
  _count?: { employees: number };
};

type BoqItemRow = PrismaBoqItem;
type EmployeeWithProjects = PrismaEmployee & {
  projectLinks?: { projectId: string }[];
};
type ReportWithRelations = PrismaWorkReport & {
  project: { name: string };
  boqItem: { code: string; description: string; unit: string };
  employee: { firstName: string; lastName: string };
  media?: { type: string; url: string }[];
};
type DocumentWithRelations = PrismaDocument & {
  project: { name: string };
  uploadedBy: { name: string };
  versions?: { version: number; uploadedById: string; createdAt: Date; size: number; url: string }[];
  attachments?: {
    id: string;
    documentId: string;
    name: string;
    type: PrismaDocument["type"];
    extension: string;
    size: number;
    url: string;
    createdAt: Date;
    uploadedBy?: { name: string };
  }[];
  _count?: { attachments?: number };
};
type InvoiceWithRelations = PrismaPartialInvoice & {
  project: {
    name: string;
    contractNumber?: string;
    location?: string;
    foreman?: { firstName: string; lastName: string };
  };
  items: {
    id: string;
    boqItemId: string;
    code: string;
    description: string;
    unit: string;
    contractQuantity: Prisma.Decimal;
    previousQuantity: Prisma.Decimal;
    quantity: Prisma.Decimal;
    cumulativeQuantity: Prisma.Decimal;
    quantityPercent: number;
    unitPrice: Prisma.Decimal;
    previousAmount: Prisma.Decimal;
    total: Prisma.Decimal;
    cumulativeAmount: Prisma.Decimal;
    financialPercent: number;
  }[];
};

function parseInvoiceCompanySnapshot(
  value: string | null
): PartialInvoice["companySnapshot"] {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as PartialInvoice["companySnapshot"];
    return parsed && typeof parsed.name === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}
type GalleryWithRelations = PrismaGalleryItem & {
  project: { name: string };
  uploadedBy: { name: string };
};
type ActivityWithRelations = PrismaActivity & {
  project: { name: string };
  user: { name: string };
};

function decimalToNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

export function mapProject(row: ProjectWithRelations): Project {
  return {
    id: row.id,
    name: row.name,
    contractNumber: row.contractNumber,
    contractor: row.contractor,
    location: row.location,
    foremanId: row.foremanId,
    foremanName: `${row.foreman.firstName} ${row.foreman.lastName}`,
    status: row.status,
    contractValue: decimalToNumber(row.contractValue),
    completedValue: decimalToNumber(row.completedValue),
    invoicedValue: decimalToNumber(row.invoicedValue ?? 0),
    progress: row.progress,
    financialProgress: row.financialProgress ?? 0,
    subtotal: row.subtotal != null ? decimalToNumber(row.subtotal) : null,
    vatPercent: row.vatPercent != null ? decimalToNumber(row.vatPercent) : null,
    vatAmount: row.vatAmount != null ? decimalToNumber(row.vatAmount) : null,
    totalWithVat:
      row.totalWithVat != null ? decimalToNumber(row.totalWithVat) : null,
    employeeCount: row._count?.employees ?? row.employees?.length ?? 0,
    imageUrl: row.imageUrl ?? "",
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    description: row.description ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapBoqItem(row: BoqItemRow): BoqItem {
  const executedQuantity = decimalToNumber(row.completedQuantity);
  const invoicedQuantity = decimalToNumber(row.invoicedQuantity ?? 0);
  return {
    id: row.id,
    projectId: row.projectId,
    code: row.code,
    description: cleanBoqDescription(row.description) || row.description,
    unit: row.unit,
    contractQuantity: decimalToNumber(row.contractQuantity),
    executedQuantity,
    completedQuantity: executedQuantity,
    invoicedQuantity,
    availableForInvoice: availableForInvoice(executedQuantity, invoicedQuantity),
    remainingQuantity: decimalToNumber(row.remainingQuantity),
    unitPrice: decimalToNumber(row.unitPrice),
    completedValue: decimalToNumber(row.completedValue),
    remainingValue: decimalToNumber(row.remainingValue),
    progress: row.progress,
    status: row.status,
    itemKind: row.itemKind ?? "regular",
    category: row.category ?? null,
    notes: row.notes ?? null,
    parentId: row.parentId ?? undefined,
    level: row.level,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapEmployee(row: EmployeeWithProjects): Employee {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: `${row.firstName} ${row.lastName}`,
    phone: row.phone,
    email: row.email,
    role: row.role,
    status: row.status,
    avatarUrl: row.avatarUrl ?? "",
    projectIds: row.projectLinks?.map((l) => l.projectId) ?? [],
    completedQuantity: row.completedQuantity,
    openQuantity: row.openQuantity,
    joinedAt: row.joinedAt.toISOString(),
    userId: row.userId ?? null,
    wantsSystemUser: row.wantsSystemUser ?? false,
    hasSystemUser: Boolean(row.userId),
  };
}

export function mapWorkReport(row: ReportWithRelations): WorkReport {
  const photos = row.media?.filter((m) => m.type === "image").map((m) => m.url) ?? [];
  const videos = row.media?.filter((m) => m.type === "video").map((m) => m.url) ?? [];
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    boqItemId: row.boqItemId,
    boqItemCode: row.boqItem.code,
    boqItemDescription: row.boqItem.description,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    quantity: decimalToNumber(row.quantity),
    unit: row.boqItem.unit,
    notes: row.notes ?? undefined,
    photoUrls: photos,
    videoUrls: videos,
    reportedAt: row.reportedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapDocument(row: DocumentWithRelations): Document {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    name: row.name,
    type: row.type,
    extension: row.extension,
    size: row.size,
    url: row.url,
    version: row.version,
    uploadedBy: row.uploadedBy.name,
    uploadedAt: row.createdAt.toISOString(),
    folderPath: row.folderPath ?? null,
    sourceType: row.sourceType ?? null,
    sourceId: row.sourceId ?? null,
    versions:
      row.versions?.map((v) => ({
        version: v.version,
        uploadedBy: row.uploadedBy.name,
        uploadedAt: v.createdAt.toISOString(),
        size: v.size,
        url: v.url,
      })) ?? [],
    attachments:
      row.attachments?.map((a) => ({
        id: a.id,
        documentId: a.documentId,
        name: a.name,
        type: a.type,
        extension: a.extension,
        size: a.size,
        url: a.url,
        uploadedBy: a.uploadedBy?.name ?? row.uploadedBy.name,
        uploadedAt: a.createdAt.toISOString(),
      })) ?? [],
    attachmentCount: row._count?.attachments ?? row.attachments?.length ?? 0,
  };
}

export function mapPartialInvoice(row: InvoiceWithRelations): PartialInvoice {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectNameSnapshot || row.project.name,
    projectContractNumber:
      row.projectContractNumberSnapshot || row.project.contractNumber,
    projectLocation: row.projectLocationSnapshot || row.project.location,
    projectForemanName:
      row.projectForemanNameSnapshot ||
      (row.project.foreman
        ? `${row.project.foreman.firstName} ${row.project.foreman.lastName}`
        : undefined),
    invoiceNumber: row.invoiceNumber,
    sequenceNumber: row.sequenceNumber ?? 0,
    billingMonth: row.billingMonth ?? "",
    billTo: row.billTo ?? undefined,
    contractor: row.contractor ?? undefined,
    amount: decimalToNumber(row.amount),
    subtotal: row.subtotal != null ? decimalToNumber(row.subtotal) : null,
    vatPercent: row.vatPercent != null ? decimalToNumber(row.vatPercent) : null,
    vatAmount: row.vatAmount != null ? decimalToNumber(row.vatAmount) : null,
    totalWithVat:
      row.totalWithVat != null ? decimalToNumber(row.totalWithVat) : null,
    previousTotal: decimalToNumber(row.previousTotal ?? 0),
    cumulativeTotal: decimalToNumber(
      row.cumulativeTotal ?? row.amount
    ),
    projectNameSnapshot: row.projectNameSnapshot ?? undefined,
    projectContractNumberSnapshot:
      row.projectContractNumberSnapshot ?? undefined,
    projectLocationSnapshot: row.projectLocationSnapshot ?? undefined,
    projectForemanNameSnapshot:
      row.projectForemanNameSnapshot ?? undefined,
    companySnapshot: parseInvoiceCompanySnapshot(row.companySnapshotJson),
    approverNameSnapshot: row.approverNameSnapshot ?? undefined,
    snapshotLockedAt: row.snapshotLockedAt?.toISOString(),
    status: row.status,
    date: row.date.toISOString(),
    dueDate: row.dueDate.toISOString(),
    includedItems: row.items.map((item) => ({
      id: item.id,
      boqItemId: item.boqItemId,
      code: item.code,
      description: item.description,
      unit: item.unit ?? "יח'",
      contractQuantity: decimalToNumber(item.contractQuantity ?? 0),
      previousQuantity: decimalToNumber(item.previousQuantity ?? 0),
      quantity: decimalToNumber(item.quantity),
      cumulativeQuantity: decimalToNumber(
        item.cumulativeQuantity ?? item.quantity
      ),
      quantityPercent: item.quantityPercent ?? 0,
      unitPrice: decimalToNumber(item.unitPrice),
      previousAmount: decimalToNumber(item.previousAmount ?? 0),
      total: decimalToNumber(item.total),
      cumulativeAmount: decimalToNumber(
        item.cumulativeAmount ?? item.total
      ),
      financialPercent: item.financialPercent ?? 0,
    })),
    notes: row.notes ?? undefined,
    url: row.url ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapGalleryItem(row: GalleryWithRelations): GalleryItem {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    type: row.type,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    title: row.title,
    uploadedBy: row.uploadedBy.name,
    uploadedAt: row.createdAt.toISOString(),
    boqItemId: row.boqItemId ?? undefined,
    reportId: row.reportId ?? undefined,
  };
}

export function mapActivity(row: ActivityWithRelations): Activity {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    type: row.type,
    title: row.title,
    description: row.description,
    userId: row.userId,
    userName: row.user.name,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapNotification(row: PrismaNotification): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    projectId: row.projectId ?? undefined,
    link: row.link ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapDashboardKPIs(data: {
  activeProjects: number;
  fieldEmployees: number;
  overallProgress: number;
  completedValue: number;
  remainingValue: number;
  newDocuments: number;
  todayReports: number;
}): DashboardKPIs {
  return data;
}
