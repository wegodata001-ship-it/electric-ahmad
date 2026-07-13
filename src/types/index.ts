export type ProjectStatus = "active" | "completed" | "on_hold" | "planning";
export type BoqItemStatus = "not_started" | "in_progress" | "completed" | "on_hold";
export type EmployeeStatus = "active" | "inactive" | "on_leave";
export type EmployeeRole = "worker" | "foreman" | "engineer" | "manager" | "admin";
export type DocumentType = "pdf" | "excel" | "word" | "dwg" | "image" | "video" | "other";
export type InvoiceStatus = "draft" | "submitted" | "approved" | "paid" | "rejected";
export type NotificationType =
  | "report"
  | "item_completed"
  | "document"
  | "invoice"
  | "system"
  | "employee";
export type ActivityType =
  | "report_created"
  | "quantity_updated"
  | "document_uploaded"
  | "invoice_created"
  | "status_changed"
  | "employee_assigned"
  | "project_updated";

export interface Project {
  id: string;
  name: string;
  contractNumber: string;
  contractor: string;
  location: string;
  foremanId: string;
  foremanName: string;
  status: ProjectStatus;
  contractValue: number;
  completedValue: number;
  progress: number;
  employeeCount: number;
  imageUrl: string;
  startDate: string;
  endDate: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoqItem {
  id: string;
  projectId: string;
  code: string;
  description: string;
  unit: string;
  contractQuantity: number;
  completedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  completedValue: number;
  remainingValue: number;
  progress: number;
  status: BoqItemStatus;
  parentId?: string;
  level: number;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  avatarUrl: string;
  projectIds: string[];
  completedQuantity: number;
  openQuantity: number;
  joinedAt: string;
}

export interface WorkReport {
  id: string;
  projectId: string;
  projectName: string;
  boqItemId: string;
  boqItemCode: string;
  boqItemDescription: string;
  employeeId: string;
  employeeName: string;
  quantity: number;
  unit: string;
  notes?: string;
  photoUrls: string[];
  videoUrls: string[];
  reportedAt: string;
  createdAt: string;
}

export interface Document {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  type: DocumentType;
  size: number;
  url: string;
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  versions: DocumentVersion[];
}

export interface DocumentVersion {
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  size: number;
  url: string;
}

export interface PartialInvoice {
  id: string;
  projectId: string;
  projectName: string;
  invoiceNumber: string;
  amount: number;
  status: InvoiceStatus;
  date: string;
  dueDate: string;
  includedItems: InvoiceItem[];
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  boqItemId: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface GalleryItem {
  id: string;
  projectId: string;
  projectName: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl: string;
  title: string;
  uploadedBy: string;
  uploadedAt: string;
  boqItemId?: string;
  reportId?: string;
}

export interface Activity {
  id: string;
  projectId: string;
  projectName: string;
  type: ActivityType;
  title: string;
  description: string;
  userId: string;
  userName: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  projectId?: string;
  link?: string;
  createdAt: string;
}

export interface DashboardKPIs {
  activeProjects: number;
  fieldEmployees: number;
  overallProgress: number;
  completedValue: number;
  remainingValue: number;
  newDocuments: number;
  todayReports: number;
}

export interface SearchResult {
  id: string;
  type: "project" | "employee" | "boq_item" | "document";
  title: string;
  subtitle: string;
  link: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
}
