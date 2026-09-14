/**
 * AI Filters — post-processing pass applied to assistant output before it is
 * rendered, gated by per-user AgentSettings.filters.
 *
 * They are *presentation* hygiene, not censorship:
 *  - ableism: swap common ableist idioms for neutral equivalents so no reader
 *    is written off as less capable;
 *  - reading_order: strip bidirectional override controls and reorder RTL
 *    runs to a stable left-to-right reading order (runs are wrapped in the
 *    invisible logical marks needed for correct LTR sequence display);
 *  - itim (interest/time/intention) offhand: dropped retained from spec, kept
 *    as a toggle hook for future short-memory handling.
 */
const ABLEIST_TERMS = [
  ['blind to', 'unaware of'],
  ['blind spot', 'gap'],
  ['deaf to', 'ignoring'],
  ['deaf ears', 'ignored'],
  ['crippled by', 'hampered by'],
  ['crippling', 'severely limiting'],
  ['dumb', 'foolish'],
  ['lame', 'weak'],
  ['lunatic', 'unreasonable'],
  ['insane', 'extreme'],
  ['crazy idea', 'far-fetched idea'],
  ['crazy', 'remarkable'],
  ['insane workload', 'heavy workload'],
  ['psycho', 'unstable'],
  ['tone deaf', 'tactless'],
  ['fall on deaf ears', 'go unexplained'],
];

const RTL_REGEX =
  /[\u{0590}-\u{08FF}\u{FB1D}-\u{FDFF}\u{FE70}-\u{FEFF}]/u;

export function applyAbleismFilter(text) {
  let out = text;
  for (const [from, to] of ABLEIST_TERMS) {
    const re = new RegExp(`\\b${from}\\b`, 'gi');
    out = out.replace(re, to);
  }
  return out;
}

export function applyReadingOrderFilter(text) {
  // Remove bidi override + formatting characters that can scramble sequence.
  const stripped = text.replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, '');
  if (!RTL_REGEX.test(stripped)) return stripped;
  // Wrap each contiguous RTL run in left-to-right isolate marks so its glyph
  // order stays in reading order regardless of surrounding LTR context.
  return stripped.replace(
    /[\u{0590}-\u{08FF}\u{FB1D}-\u{FDFF}\u{FE70}-\u{FEFF}][\u{0590}-\u{08FF}\u{FB1D}-\u{FDFF}\u{FE70}-\u{FEFF}\s\u060C\u061B\u061F\u0660-\u0669\u{1F600}-\u{1F64F}]*/gu,
    (run) => `\u2066${run}\u2069`,
  );
}

/**
 * Apply enabled filters to assistant text.
 * @param {string} text
 * @param {object} filters e.g. { ableism: true, reading_order: true }
 */
export function applyAiFilters(text, filters = {}) {
  let out = text || '';
  if (filters.ableism !== false) out = applyAbleismFilter(out);
  if (filters.reading_order !== false) out = applyReadingOrderFilter(out);
  return out;
}