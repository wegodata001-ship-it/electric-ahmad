import { z } from "zod";

export const workReportSchema = z.object({
  boqItemId: z.string().min(1, "יש לבחור סעיף"),
  quantity: z.number().min(0.01, "כמות חייבת להיות גדולה מ-0"),
  notes: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
});

export type WorkReportFormData = z.infer<typeof workReportSchema>;

export const projectSchema = z.object({
  name: z.string().min(2, "שם פרויקט חייב להכיל לפחות 2 תווים"),
  contractNumber: z.string().min(1, "מספר חוזה חובה"),
  contractor: z.string().min(1, "שם קבלן חובה"),
  location: z.string().min(1, "מיקום חובה"),
  contractValue: z.number().min(1, "שווי חוזה חייב להיות גדול מ-0"),
});

export type ProjectFormData = z.infer<typeof projectSchema>;
