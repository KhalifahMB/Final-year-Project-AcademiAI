export const VIEWS = ['month', 'week', 'day', 'agenda'];

export const LAYERS = [
  { key: 'personal', label: 'Study Plans', color: 'var(--accent)' },
  { key: 'academic', label: 'Lectures', color: 'var(--info)' },
  { key: 'exams', label: 'Exams', color: 'var(--danger)' },
  { key: 'office_hours', label: 'Office Hours', color: 'var(--warn)' },
  { key: 'institution', label: 'Institution', color: 'var(--success)' },
];

export const EVENT_TYPE_LABELS = {
  lecture: 'Lecture',
  exam: 'Exam',
  study: 'Study Session',
  office_hours: 'Office Hours',
  institution: 'Institution Event',
  reminder: 'Reminder',
};

export const LAYER_LABELS = Object.fromEntries(LAYERS.map((l) => [l.key, l.label]));

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const MS_PER_DAY = 86_400_000;
export const RIBBON_ROW = 18;
export const GRID_HEADER_H = 28;
export const MAX_CHIPS = 4;

export const UPCOMING_LIMIT = 50;
export const UPCOMING_PAGE_SIZE = 5;
