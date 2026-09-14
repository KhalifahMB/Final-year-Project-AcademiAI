/**
 * Shared Plans <-> Calendar cache convergence.
 *
 * Plans and the Calendar are synchronized on the backend by signal handlers,
 * so a mutation on one surface changes rows the other surface reads. These
 * helpers ensure the two TanStack Query namespaces stay converged: any plan
 * mutation refreshes the calendar events query and vice versa.
 */

export const PLANS_QUERY_KEY = ['plans'];
export const CALENDAR_QUERY_KEY = ['calendar'];

/**
 * Invalidate both the plans list and the calendar events cache.
 * Returns a promise that resolves when both invalidations are dispatched.
 */
export function invalidatePlannerCaches(queryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY }),
  ]);
}