/**
 * Look for [N] references in markdown text and replace them with
 * clickable chips that activate the corresponding source in the
 * right-hand sources rail. Non-matching numbers are left as-is.
 */
export function renderCitedText(text, sources, onSourceClick) {
  if (!text) return text;
  // Only look for citations where there is an actual source with that rank.
  const rankSet = new Set((sources || []).map((s) => Number(s.rank)));
  const parts = [];
  const re = /\[(\d+)\]/g;
  let lastIdx = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (rankSet.has(n)) {
      if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
      parts.push(
        <button
          type="button"
          key={`cite-${key++}-${n}`}
          onClick={() => onSourceClick && onSourceClick(n)}
          className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
        >
          {n}
        </button>,
      );
      lastIdx = m.index + m[0].length;
    }
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}