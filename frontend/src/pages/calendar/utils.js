import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { LAYERS, MS_PER_DAY } from './constants';

export function eventFallsOn(e, day) {
  const startDay = startOfDay(parseISO(e.start));
  if (startDay > day) return false;
  if (!e.end) return isSameDay(parseISO(e.start), day);
  return startOfDay(parseISO(e.end)) >= day;
}

export function isMultiDayEvent(e) {
  if (!e.end) return false;
  return startOfDay(parseISO(e.end)) > startOfDay(parseISO(e.start));
}

export function layerTint(layer) {
  const tints = {
    personal: ['var(--accent-soft)', 'var(--accent-strong)'],
    academic: ['var(--info-soft)', 'var(--info)'],
    exams: ['var(--danger-soft)', 'var(--danger)'],
    office_hours: ['var(--warn-soft)', 'var(--warn)'],
    institution: ['var(--success-soft)', 'var(--success)'],
  };
  return tints[layer] || tints.personal;
}

export function layerColor(layer) {
  return LAYERS.find((l) => l.key === layer)?.color || 'var(--accent)';
}

export function weekSpan(e, weekDays) {
  const ws = weekDays[0];
  const we = endOfDay(weekDays[6]);
  const startDay = startOfDay(parseISO(e.start));
  const endDay = e.end ? startOfDay(parseISO(e.end)) : startDay;
  if (startDay > we || endDay < ws) return null;
  const colStart = startDay < ws ? 0 : Math.round((startDay - ws) / MS_PER_DAY);
  const colEnd =
    endDay > we ? 6 : Math.min(6, Math.round((endDay - ws) / MS_PER_DAY));
  return { colStart, colEnd };
}

export function assignWeekLanes(spans) {
  const lanes = [];
  for (const sp of spans) {
    const li = lanes.findIndex(
      (lane) =>
        lane.every((o) => o.colEnd < sp.colStart || o.colStart > sp.colEnd),
    );
    if (li === -1) lanes.push([sp]);
    else lanes[li].push(sp);
  }
  return lanes;
}

export function parseDateValue(view, base) {
  if (view === 'month') {
    return { start: startOfMonth(base), end: endOfMonth(base) };
  }
  if (view === 'week') {
    return {
      start: startOfWeek(base, { weekStartsOn: 1 }),
      end: endOfWeek(base, { weekStartsOn: 1 }),
    };
  }
  if (view === 'day') {
    return { start: startOfDay(base), end: endOfDay(base) };
  }
  // agenda
  return { start: startOfDay(base), end: addDays(startOfDay(base), 30) };
}

export function hourLabel(h) {
  return h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
}
