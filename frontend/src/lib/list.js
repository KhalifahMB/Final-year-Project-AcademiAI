// Normalise a list endpoint payload: bare array, DRF `{ results }` envelope,
// or anything else (empty). Call sites chain .map() on this, so it never
// returns a non-array.
export const toList = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
