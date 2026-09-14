"""Centralized tuning constants for AcademiAI.

Every magic number that tunes retrieval, AI prompting, upload handling or
frontend pagination should live here (or in a module-local, clearly-named
constant where it only applies to one class). Keeps the RAG/agent pipeline
tunable without hunting literal values across files.
"""

RAG_TOP_K = 8
RAG_MAX_CONTEXT_CHUNKS = 24
RAG_CHUNKS_PER_ATTACHED_RESOURCE = 10
RAG_CACHE_TTL_SECONDS = 300
CHAT_TITLE_MAX_CHARS = 80

CONTEXT_MAX_CHARS = 4000

AGENT_MAX_TOOL_ITERATIONS = 5
AGENT_HISTORY_SLOTS = 20
AGENT_TITLE_MAX_CHARS = 60

RESOURCE_TEXT_PEEK_BYTES = 512 * 1024