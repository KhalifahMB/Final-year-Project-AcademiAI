import { formatRelativeTime } from '@/lib/utils';

// eslint-disable-next-line react-refresh/only-export-components
export function TimeAgo({ iso }) {
  return <span title={iso}>{formatRelativeTime(iso)}</span>;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}
