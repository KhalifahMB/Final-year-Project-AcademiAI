import { describe, it, expect } from 'vitest';
import { toList } from '@/lib/list';

// Pages used to carry six private copies of this normaliser with slightly
// different fallbacks, so the same endpoint shape produced an array in one
// page and the raw object in another.
describe('toList', () => {
  it('passes through a bare array', () => {
    expect(toList([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it('unwraps a DRF paginated envelope', () => {
    expect(toList({ count: 1, results: [{ id: 1 }] })).toEqual([{ id: 1 }]);
  });

  it('keeps an empty result page empty', () => {
    expect(toList({ count: 0, results: [] })).toEqual([]);
  });

  it('returns an array for missing or non-list payloads', () => {
    expect(toList(undefined)).toEqual([]);
    expect(toList(null)).toEqual([]);
    expect(toList({})).toEqual([]);
    // The copies this replaces handed back the object here, which then blew
    // up on .map() at the call site.
    expect(toList({ detail: 'Forbidden' })).toEqual([]);
    expect(toList('nope')).toEqual([]);
  });
});
