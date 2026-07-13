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
};
type InvoiceWithRelations = PrismaPartialInvoice & {
  project: { name: string };
  items: {
    boqItemId: string;
    code: string;
    description: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    total: Prisma.Decimal;
  }[];
};
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
    progress: row.progress,
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
  return {
    id: row.id,
    projectId: row.projectId,
    code: row.code,
    description: row.description,
    unit: row.unit,
    contractQuantity: decimalToNumber(row.contractQuantity),
    completedQuantity: decimalToNumber(row.completedQuantity),
    remainingQuantity: decimalToNumber(row.remainingQuantity),
    unitPrice: decimalToNumber(row.unitPrice),
    completedValue: decimalToNumber(row.completedValue),
    remainingValue: decimalToNumber(row.remainingValue),
    progress: row.progress,
    status: row.status,
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
    size: row.size,
    url: row.url,
    version: row.version,
    uploadedBy: row.uploadedBy.name,
    uploadedAt: row.createdAt.toISOString(),
    versions:
      row.versions?.map((v) => ({
        version: v.version,
        uploadedBy: row.uploadedBy.name,
        uploadedAt: v.createdAt.toISOString(),
        size: v.size,
        url: v.url,
      })) ?? [],
  };
}

export function mapPartialInvoice(row: InvoiceWithRelations): PartialInvoice {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    invoiceNumber: row.invoiceNumber,
    amount: decimalToNumber(row.amount),
    status: row.status,
    date: row.date.toISOString(),
    dueDate: row.dueDate.toISOString(),
    includedItems: row.items.map((item) => ({
      boqItemId: item.boqItemId,
      code: item.code,
      description: item.description,
      quantity: decimalToNumber(item.quantity),
      unitPrice: decimalToNumber(item.unitPrice),
      total: decimalToNumber(item.total),
    })),
    notes: row.notes ?? undefined,
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
