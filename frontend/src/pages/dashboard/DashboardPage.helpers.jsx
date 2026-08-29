import { formatRelativeTime } from '@/lib/utils';

// eslint-disable-next-line react-refresh/only-export-components
export function TimeAgo({ iso }) {
  return <span title={iso}>{formatRelativeTime(iso)}</span>;
}
