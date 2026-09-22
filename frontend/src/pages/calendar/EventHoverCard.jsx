import { useLayoutEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Clock, MapPin, Tag } from 'lucide-react';
import { LAYER_LABELS } from './constants';
import { layerColor, layerTint } from './utils';

export default function EventHoverCard({ event, rect }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: rect.left, y: rect.bottom + 8 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const cardW = ref.current.offsetWidth;
    const cardH = ref.current.offsetHeight;
    let x = rect.left;
    let y = rect.bottom + 8;
    if (x + cardW > window.innerWidth - 8) {
      x = Math.max(8, window.innerWidth - cardW - 8);
    }
    if (y + cardH > window.innerHeight - 8) {
      y = Math.max(8, rect.top - cardH - 8);
    }
    setPos({ x, y });
  }, [rect.left, rect.top, rect.bottom]);

  const s = parseISO(event.start);
  const en = event.end ? parseISO(event.end) : null;
  const [tintBg, tintFg] = layerTint(event.layer);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[70] w-[280px] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)]/95 p-3 shadow-xl backdrop-blur-md"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-[9.5px] font-[600] uppercase tracking-wide"
          style={{ backgroundColor: tintBg, color: tintFg }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: layerColor(event.layer) }}
          />
          {LAYER_LABELS[event.layer] || event.layer}
        </span>
        {event.status === 'cancelled' && (
          <span className="text-[9.5px] font-[600] uppercase tracking-wide text-[var(--danger)]">
            Cancelled
          </span>
        )}
      </div>
      <p className="mt-2 text-[13px] font-[640] leading-snug text-[var(--fg)]">
        {event.title}
      </p>
      <div className="mt-1.5 space-y-1 text-[11.5px] text-[var(--muted)]">
        <p className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          {event.all_day ? (
            'All day'
          ) : (
            <span className="num">
              {format(s, 'EEEE, MMM d · h:mm a')}
              {en ? ` – ${format(en, 'h:mm a')}` : ''}
            </span>
          )}
        </p>
        {event.venue && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" /> {event.venue}
          </p>
        )}
        {event.course_code && (
          <p className="flex items-center gap-1.5">
            <Tag className="h-3 w-3 shrink-0" /> {event.course_code}
          </p>
        )}
      </div>
      {event.description && (
        <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-[var(--fg-soft)]">
          {event.description}
        </p>
      )}
    </div>
  );
}
