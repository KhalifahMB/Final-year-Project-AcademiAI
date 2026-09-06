/**
 * Tenant display helper.
 *
 * The /auth/me/ payload carries `tenant` as a raw PK for backwards
 * compatibility plus `tenant_detail` ({ id, name, slug }) for display.
 * Older payloads/tests may carry a nested object instead. This normalises
 * all three shapes so enrolled users never see "Not enrolled".
 */
export function getTenantInfo(user) {
  if (!user) return null;
  const detail = user.tenant_detail;
  if (detail && typeof detail === 'object') {
    return {
      id: detail.id ?? null,
      name: detail.name ?? null,
      slug: detail.slug ?? null,
    };
  }
  const t = user.tenant;
  if (t && typeof t === 'object') {
    return { id: t.id ?? null, name: t.name ?? null, slug: t.slug ?? null };
  }
  if (typeof t === 'string' && t.length > 0) {
    return { id: t, name: null, slug: null };
  }
  return null;
}

export function getTenantName(user, fallback = 'Your institution') {
  return getTenantInfo(user)?.name || fallback;
}
