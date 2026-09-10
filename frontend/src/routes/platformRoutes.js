import {
  PlatformConsolePage,
  PlatformTenantsPage,
  PlatformTenantDetailPage,
  PlatformRequestsPage,
  PlatformAnalyticsPage,
  PlatformSystemHealthPage,
  PlatformAuditLogPage,
  PlatformAnnouncementsPage,
} from './pages';

export const platformRoutes = [
  { path: '/platform', Page: PlatformConsolePage },
  { path: '/platform/tenants', Page: PlatformTenantsPage },
  { path: '/platform/tenants/:id', Page: PlatformTenantDetailPage },
  { path: '/platform/requests', Page: PlatformRequestsPage },
  { path: '/platform/analytics', Page: PlatformAnalyticsPage },
  { path: '/platform/health', Page: PlatformSystemHealthPage },
  { path: '/platform/audit', Page: PlatformAuditLogPage },
  { path: '/platform/announcements', Page: PlatformAnnouncementsPage },
];