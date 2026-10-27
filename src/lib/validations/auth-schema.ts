import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(3, "Please enter your hospital email or employee ID"),
  password: z
    .string()
    .min(4, "Password must be at least 4 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const passwordResetSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid hospital email address (e.g. name@dayahospital.com)"),
});

export type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(4, "Please enter your current password"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters long"),
    confirmPassword: z.string().min(6, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().email("Please enter a valid hospital email address"),
  role: z.enum(["HOSPITAL_ADMIN", "HOSPITAL_STAFF", "CALL_REVIEWER"]),
  department: z.string().min(2, "Department is required").max(60),
  phone: z.string().optional().default(""),
  canAccessRecordings: z.boolean().default(false),
  initialPassword: z.string().min(6, "Initial password must be at least 6 characters").optional(),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;

export const hospitalSettingsSchema = z.object({
  retentionDays: z.enum(["15", "30", "60", "90"]),
  enableMalayalamConsent: z.boolean(),
  strictMasking: z.boolean(),
  defaultStaffRecordingAccess: z.boolean(),
  missedCallThreshold: z.coerce.number().min(1).max(100),
  urgentFollowUpAlerts: z.boolean(),
  emergencyCasualtyAlerts: z.boolean(),
  dailyDigestEmail: z.boolean(),
});

export type HospitalSettingsFormData = z.infer<typeof hospitalSettingsSchema>;
