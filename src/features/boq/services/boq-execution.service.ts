import { apiClient } from "@/lib/api/client";

export type ExecutionStatus =
  | "not_started"
  | "in_progress"
  | "partially_completed"
  | "completed"
  | "finished"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled";

export type BoqExecutionDto = {
  id: string;
  projectId: string;
  boqItemId: string;
  employeeId: string;
  employeeName: string;
  foremanId: string | null;
  foremanName: string | null;
  quantity: number;
  executedAt: string;
  status: ExecutionStatus;
  notes: string | null;
  source: string;
  media: { id: string; type: "image" | "video"; name: string; url: string }[];
  attachments: { id: string; name: string; url: string; kind: string }[];
  comments: { id: string; body: string; userName: string; createdAt: string }[];
  history: {
    id: string;
    action: string;
    fromStatus: ExecutionStatus | null;
    toStatus: ExecutionStatus | null;
    quantity: number | null;
    userName: string;
    createdAt: string;
  }[];
  boqItem?: {
    id: string;
    code: string;
    description: string;
    unit: string;
    contractQuantity: number;
    executedQuantity: number;
    remainingQuantity: number;
    invoicedQuantity: number;
    progress: number;
  };
  createdAt: string;
};

export type CreateExecutionPayload = {
  projectId: string;
  boqItemId: string;
  employeeId: string;
  foremanId?: string | null;
  quantity: number;
  executedAt?: string;
  status?: ExecutionStatus;
  notes?: string;
  source?: string;
};

export const boqExecutionService = {
  async getByBoqItem(boqItemId: string): Promise<BoqExecutionDto[]> {
    return apiClient.get(`/api/boq-executions?boqItemId=${boqItemId}`);
  },

  async create(payload: CreateExecutionPayload): Promise<BoqExecutionDto> {
    return apiClient.post("/api/boq-executions", payload);
  },

  async uploadFile(executionId: string, file: File): Promise<unknown> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.upload(`/api/boq-executions/${executionId}/files`, formData);
  },
};

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  not_started: "לא התחיל",
  in_progress: "בביצוע",
  partially_completed: "בוצע חלקית",
  completed: "בוצע",
  finished: "הסתיים",
  pending_approval: "ממתין לאישור",
  approved: "אושר",
  rejected: "נדחה",
  cancelled: "בוטל",
};
