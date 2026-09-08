export type ProjectStatus = "active" | "completed" | "on_hold" | "planning";
export type BoqItemStatus =
  | "active"
  | "pending"
  | "cancelled"
  | "completed"
  | "not_started"
  | "in_progress"
  | "on_hold";

export type BoqItemKind = "regular" | "exceptional";
export type EmployeeStatus = "active" | "inactive" | "on_leave";
export type EmployeeRole = "worker" | "foreman" | "engineer" | "manager" | "admin";
export type DocumentType = "pdf" | "excel" | "word" | "dwg" | "image" | "video" | "other";
export type InvoiceStatus =
  | "draft"
  | "pending_foreman_approval"
  | "approved_by_foreman"
  | "rejected_by_foreman"
  | "sent_to_client"
  | "signed"
  | "paid"
  // Legacy — kept for backward-compatible rows
  | "submitted"
  | "approved"
  | "rejected";

export type InvoiceApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface ProjectInvoiceApproval {
  id: string;
  invoiceId: string;
  projectId: string;
  managerId: string;
  approverUserId?: string | null;
  managerName?: string;
  senderName?: string;
  status: InvoiceApprovalStatus;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  comment: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  invoiceSequence?: number;
  invoiceNumber?: string;
  amount?: number;
}
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
  | "project_updated"
  | "delivery_note_created";

export interface FieldCrewMember {
  id: string;
  managerId: string;
  name: string;
  phone: string;
  profession: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Manual timesheet row for a crew worker (entered by foreman). */
export interface FieldCrewTimeEntry {
  id: string;
  crewMemberId: string;
  managerId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FieldCrewHoursSummary {
  today: number;
  week: number;
  month: number;
  total: number;
}

export interface FieldAttendanceHistoryEntry {
  id: string;
  foremanId: string;
  projectId: string | null;
  date: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  checkIn: string;
  checkOut: string;
  hours: number;
}

export interface FieldAttendancePersonalSummary {
  workDays: number;
  monthHours: number;
  avgPerDay: number;
  lastCheckIn: { at: string; date: string; time: string } | null;
  lastCheckOut: { at: string; date: string; time: string } | null;
}

export interface ForemanSummary {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string;
  status: EmployeeStatus;
  role: EmployeeRole;
  isDeleted: boolean;
  username?: string | null;
  notes?: string | null;
  joinedAt?: string;
  activeProjects: { id: string; name: string }[];
  activeProjectCount: number;
  teamCount: number;
  openJournals: number;
  closedJournals: number;
  reportsCount: number;
  photosCount: number;
  crewCount?: number;
  hoursThisMonth?: number;
  hoursThisYear?: number;
}

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
  invoicedValue: number;
  progress: number;
  financialProgress: number;
  subtotal?: number | null;
  vatPercent?: number | null;
  vatAmount?: number | null;
  totalWithVat?: number | null;
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
  /** ביצוע בפועל — aliases completedQuantity for clarity */
  executedQuantity: number;
  /** @deprecated use executedQuantity — kept for backward compatibility */
  completedQuantity: number;
  invoicedQuantity: number;
  availableForInvoice: number;
  remainingQuantity: number;
  unitPrice: number;
  completedValue: number;
  remainingValue: number;
  progress: number;
  status: BoqItemStatus;
  itemKind: BoqItemKind;
  category?: string | null;
  notes?: string | null;
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
  userId?: string | null;
  wantsSystemUser?: boolean;
  hasSystemUser?: boolean;
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
  extension?: string;
  size: number;
  url: string;
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  folderPath?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  versions: DocumentVersion[];
  attachments?: DocumentAttachment[];
  attachmentCount?: number;
}

export interface DocumentAttachment {
  id: string;
  documentId: string;
  name: string;
  type: DocumentType;
  extension: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
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
  projectContractNumber?: string;
  projectLocation?: string;
  projectForemanName?: string;
  invoiceNumber: string;
  sequenceNumber: number;
  billingMonth: string;
  billTo?: string;
  contractor?: string;
  amount: number;
  subtotal?: number | null;
  vatPercent?: number | null;
  vatAmount?: number | null;
  totalWithVat?: number | null;
  previousTotal: number;
  cumulativeTotal: number;
  projectNameSnapshot?: string;
  projectContractNumberSnapshot?: string;
  projectLocationSnapshot?: string;
  projectForemanNameSnapshot?: string;
  companySnapshot?: {
    name: string;
    legalName?: string;
    activity?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    vatId?: string;
    logoUrl?: string;
    logoText?: string;
    brandBlue?: string;
    brandBlueDark?: string;
    brandBlueLight?: string;
  };
  approverNameSnapshot?: string;
  snapshotLockedAt?: string;
  status: InvoiceStatus;
  date: string;
  dueDate: string;
  includedItems: InvoiceItem[];
  notes?: string;
  url?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id?: string;
  boqItemId: string;
  code: string;
  description: string;
  unit: string;
  contractQuantity: number;
  previousQuantity: number;
  quantity: number;
  cumulativeQuantity: number;
  quantityPercent: number;
  unitPrice: number;
  previousAmount: number;
  total: number;
  cumulativeAmount: number;
  financialPercent: number;
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
  type: "project" | "employee" | "boq_item" | "document" | "invoice" | "delivery_note";
  title: string;
  subtitle: string;
  link: string;
}

export type DeliveryNoteStatus =
  | "draft"
  | "sent"
  | "delivered"
  | "cancelled"
  | "issued"
  | "in_transit"
  | "locked";

export interface DeliveryNoteItem {
  id: string;
  sku?: string | null;
  description: string;
  unit: string;
  quantity: number;
  packageNumber?: string | null;
  serialNumber?: string | null;
  notes?: string;
  sortOrder: number;
}

export interface DeliveryNoteAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: string;
  url: string;
  createdAt: string;
}

export interface Client {
  id: string;
  clientNumber?: string | null;
  name: string;
  companyName?: string | null;
  contactName?: string | null;
  phone?: string | null;
  phoneSecondary?: string | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryNoteChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface DeliveryNoteVersion {
  id: string;
  deliveryNoteId: string;
  version: number;
  changes: DeliveryNoteChange[];
  editedById: string;
  editedByName: string;
  createdAt: string;
}

export interface DeliveryNote {
  id: string;
  noteNumber: string;
  sequenceNumber: number;
  status: DeliveryNoteStatus;
  currentVersion?: number;
  date: string;
  departureTime?: string | null;
  client: string;
  clientId?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  orderNumber?: string | null;
  contactName?: string | null;
  phone?: string | null;
  phoneSecondary?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  vehicle?: string | null;
  vehicleNumber?: string | null;
  externalCarrier?: boolean;
  deliveryTime?: string | null;
  destination?: string | null;
  destinationAddress?: string | null;
  driverNotes?: string | null;
  senderSigned?: boolean;
  receiverSigned?: boolean;
  receiverName?: string | null;
  receivedAt?: string | null;
  receiverSignatureUrl?: string | null;
  employeeSignatureUrl?: string | null;
  employeeSignedName?: string | null;
  equipmentCheckedIntact?: boolean;
  receivedComplete?: boolean;
  receivedWithNotes?: boolean;
  receiptNotes?: string | null;
  qrCodePayload?: string | null;
  barcodePayload?: string | null;
  url?: string | null;
  emailSentAt?: string | null;
  whatsappSentAt?: string | null;
  items: DeliveryNoteItem[];
  attachments: DeliveryNoteAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
}
