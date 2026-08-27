import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  first_name: z.string().optional().or(z.literal("")),
  last_name: z.string().optional().or(z.literal("")),
  tenant_slug: z.string().min(1, "Select your institution"),
  role: z.enum(["student", "lecturer"]).optional(),
  programme: z.string().optional().or(z.literal("")),
  gender: z
    .enum(["male", "female", "other", "unspecified"])
    .optional()
    .or(z.literal("")),
});

export const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(150),
  last_name: z.string().max(150).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email"),
  phone_number: z
    .string()
    .max(32)
    .regex(/^[0-9+\-\s()]*$/, "Digits, spaces and + - ( ) only")
    .optional()
    .or(z.literal("")),
  gender: z.enum(["", "male", "female", "other", "unspecified"]).optional(),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4, "Enter the verification code"),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetConfirmSchema = z
  .object({
    email: z.string().email(),
    token: z.string().min(4, "Enter the reset code"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(8),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
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

export const facultySchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(1, "Code is required").max(32),
});

export const departmentSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(1, "Code is required").max(32),
  faculty: z.string().min(1, "Select a faculty"),
});

export const programmeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(1, "Code is required").max(32),
  department: z.string().min(1, "Select a department"),
  degree_type: z.string().optional().or(z.literal("")),
  duration_years: z.coerce.number().int().min(1).max(10).optional(),
});

export const courseSchema = z.object({
  code: z.string().min(1, "Code is required"),
  title: z.string().min(2, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  department: z.string().optional().or(z.literal("")),
  credit_unit: z.coerce.number().int().min(0).max(20).optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export const sessionSchema = z.object({
  name: z.string().min(2, "Name is required"),
  start_date: z.string().min(1, "Start date required"),
  end_date: z.string().min(1, "End date required"),
  is_current: z.boolean().optional(),
});

export const semesterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  academic_session: z.string().min(1, "Select a session"),
  start_date: z.string().optional().or(z.literal("")),
  end_date: z.string().optional().or(z.literal("")),
});

export const offeringSchema = z.object({
  course: z.string().min(1, "Select a course"),
  academic_session: z.string().min(1, "Select a session"),
  semester: z.string().min(1, "Select a semester"),
  status: z.enum(["planned", "active", "completed", "cancelled"]).optional(),
});

export const enrollmentSchema = z.object({
  course_offering: z.string().min(1, "Select an offering"),
  student: z.string().min(1, "Select a student"),
  status: z.enum(["enrolled", "dropped", "completed"]).optional(),
});

export const resourceSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  visibility_scope: z.enum([
    "private",
    "course",
    "programme",
    "department",
    "faculty",
    "institution",
  ]),
  course_offering: z.string().optional().or(z.literal("")).nullable(),
});

export const noteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
});

export const quizSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["draft", "published", "archived"]).optional(),
  course_offering: z.string().optional().or(z.literal("")),
});

export const quizQuestionSchema = z.object({
  question_text: z.string().min(3, "Question text is required"),
  question_type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  options: z.string().optional().or(z.literal("")),
  correct_answer: z.string().min(1, "Correct answer is required"),
  explanation: z.string().optional().or(z.literal("")),
});
