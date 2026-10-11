// Data hooks shared by every /landing-lab variant. Presentation is the
// variant's job; fetching live numbers is not — keep it here so all three
// read the same endpoints with the same caching.
import { useQuery } from '@tanstack/react-query';
import api, { publicApi } from '@/services/api';

/** Public institution count for the trust strip / hero proof. */
export function useLandingStats() {
  const query = useQuery({
    queryKey: ['landing-public-stats'],
    queryFn: publicApi.getStats,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return query.data?.institutions_total ?? 0;
}

/** Live institution directory, optionally filtered by `search`. */
export function useInstitutionDirectory(search) {
  const query = String(search || '').trim();
  return useQuery({
    queryKey: ['landing-directory', query],
    queryFn: async () => {
      const { data } = await api.get('/tenants/directory/', {
        params: query ? { search: query } : {},
      });
      return Array.isArray(data.results) ? data.results : [];
    },
    staleTime: 60_000,
    retry: 1,
  });
}
