import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  first_name: z.string().min(1, "First name is required").optional().or(z.literal("")),
  last_name: z.string().optional().or(z.literal("")),
  tenant_slug: z.string().min(1, "Institution slug is required"),
  role: z.enum(["student", "lecturer", "admin"]),
});

export const facultySchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(1, "Code is required").max(32),
});

export const departmentSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(1, "Code is required").max(32),
  faculty: z.string().uuid("Select a faculty"),
});

export const programmeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(1, "Code is required").max(32),
  department: z.string().uuid("Select a department"),
  degree_type: z.string().optional(),
  duration_years: z.coerce.number().int().min(1).max(10).optional(),
});

export const courseSchema = z.object({
  code: z.string().min(1, "Code is required"),
  title: z.string().min(2, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  department: z.string().uuid("Select a department").optional().or(z.literal("")),
  credit_unit: z.coerce.number().int().min(0).max(20).optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export const resourceSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  visibility_scope: z.enum([
    "private", "course", "programme", "department", "faculty", "institution",
  ]),
  course_offering: z.string().uuid().optional().or(z.literal("")).nullable(),
});

export const noteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
});

export const passwordChangeSchema = z
  .object({
    old_password: z.string().min(1, "Current password required"),
    new_password: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(8),
  })
  .refine((d) => d.new_password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
