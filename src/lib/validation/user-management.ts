import { z } from "zod";

export const managedUserRoleSchema = z.enum([
  "SYSTEM_MANAGER",
  "OPERATIONS_MANAGER",
  "PROJECT_MANAGER",
  "FIELD_MANAGER",
  "TRUCK_DRIVER",
]);

const baseUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, "שם משתמש יכול להכיל אותיות באנגלית, מספרים, נקודה, מקף וקו תחתון"),
  email: z
    .union([z.string().trim().email(), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || undefined),
  phone: z
    .union([z.string().trim().max(30), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || undefined),
  role: managedUserRoleSchema,
  projectIds: z.array(z.string().min(8).max(64)).max(500).default([]),
  allowNoProjects: z.boolean().optional().default(false),
});

export const createSystemUserSchema = baseUserSchema.extend({
  password: z.string().min(8).max(200),
});

export const updateSystemUserSchema = baseUserSchema;

export const systemUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]),
});

export const resetSystemUserPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});
