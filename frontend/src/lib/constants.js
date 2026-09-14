/**
 * Centralized frontend tunables (mirror of backend/apps/common/constants.py).
 * Keep pagination sizes, SSE limits, and other literals out of inline URLs.
 */

export const PAGINATION = {
  CHAT_SESSIONS_PAGE_SIZE: 100,
  CHAT_MESSAGES_PAGE_SIZE: 200,
  MESSAGE_LOAD_BATCH: 50,
};

/** Max SSE accumulator size (bytes) before the stream is aborted. */
export const SSE_MAX_BUFFER_BYTES = 1024 * 1024;

/** Cap on IDs per bulk-delete request, so one payload stays below server limits. */
export const BULK_DELETE_MAX_IDS = 500;