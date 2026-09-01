/**
 * Central access rules for the SPA.
 *
 * Backend RLS + DRF permissions remain the real security boundary; this module
 * only decides which tenant workspaces a role may open so that wrong-role users
 * are redirected BEFORE their page mounts and fires (error-prone) API calls.
 */

export const ROLES = {
  STUDENT: 'student',
  LECTURER: 'lecturer',
  TENANT_ADMIN: 'tenant_admin',
};

// Any authenticated tenant member (students, lecturers, tenant admins).
export const EVERYONE = [ROLES.STUDENT, ROLES.LECTURER, ROLES.TENANT_ADMIN];

// Lecturers and tenant admins. Tenant admins can also be lecturers (they may
// assign courses to themselves), so they inherit every lecturer-grade page.
export const STAFF = [ROLES.LECTURER, ROLES.TENANT_ADMIN];

// Tenant admins only.
export const TENANT_ADMIN_ONLY = [ROLES.TENANT_ADMIN];

// Students only.
export const STUDENT_ONLY = [ROLES.STUDENT];

// Landing page for a mismatched role / the ForbiddenPage "workspace" button.
const ROLE_HOME = {
  [ROLES.STUDENT]: '/dashboard',
  [ROLES.LECTURER]: '/dashboard',
  [ROLES.TENANT_ADMIN]: '/admin/dashboard',
};

export function roleHome(user) {
  if (user?.is_superuser) return '/platform';
  return ROLE_HOME[user?.role] ?? '/dashboard';
}