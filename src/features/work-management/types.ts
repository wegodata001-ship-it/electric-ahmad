export type WorkOrderStatus =
  | "draft"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type WorkOrderWorker = {
  id?: string;
  crewMemberId?: string | null;
  name: string;
  role?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  hours?: number;
  notes?: string | null;
};

export type WorkOrderVehicle = {
  id?: string;
  name: string;
  plate?: string | null;
  driverName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  hours?: number;
  notes?: string | null;
};

export type WorkOrderMedia = {
  id: string;
  kind: string;
  name: string;
  url: string;
  path?: string | null;
  size: number;
  createdAt: string;
};

export type WorkOrder = {
  id: string;
  orderNumber: string;
  sequenceNumber: number;
  projectId: string;
  foremanId: string;
  date: string;
  title: string | null;
  workArea: string | null;
  clientName: string | null;
  address: string | null;
  notes: string | null;
  status: WorkOrderStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
    location: string;
    contractor: string;
    contractNumber: string;
  } | null;
  foreman: { id: string; name: string } | null;
  workers: WorkOrderWorker[];
  vehicles: WorkOrderVehicle[];
  media: WorkOrderMedia[];
  workerCount: number;
  vehicleCount: number;
};

export type WorkOrderCounts = {
  todayCount: number;
  draft: number;
  inProgress: number;
  completed: number;
};

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: "טיוטה",
  assigned: "שובץ",
  in_progress: "בביצוע",
  completed: "הושלם",
  cancelled: "בוטל",
};

export const STATUS_STEPS: WorkOrderStatus[] = [
  "draft",
  "assigned",
  "in_progress",
  "completed",
];
