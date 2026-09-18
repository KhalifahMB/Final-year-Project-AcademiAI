import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createViewer } from 'omni-doc-viewer';
import api from '@/services/api';
import PreviewToolbar from '@/components/resources/PreviewToolbar';
import { extractPptxNotes, isPptxPreview } from '@/lib/pptxNotes';

/**
 * ResourcePreview — engine-backed client preview for pdf / office / sheet.
 *
 * The dialog renders text and images itself (instant, lightweight). Binary
 * formats need a real engine, so this component:
 *
 *  1. Fetches bytes through the authenticated client (same axios instance the
 *     SPA already uses — session cookie, same-origin Vite proxy) so PDF.js and
 *     the office/sheet renderers never fight CSP, sandbox, cross-origin or
 *     signed-URL concerns.
 *  2. Renders the stream client-side through `createViewer` into a container
 *     WE own inside the dialog's existing scroll wrapper. The viewer is created
 *     with `pagination: true` + `initialViewMode: 'continuous'` and our scroller
 *     as `scrollElement`, so the engine output is still a plain continuous
 *     (pageless) stack. The dialog's scroll-percentage reading position —
 *     which it already tracks and saves in `useReadingPosition` — is identical
 *     for pdf, office and sheet. No per-page arithmetic, no separate viewport.
 *  3. Exposes the ViewerController to a floating chrome (`PreviewToolbar`):
 *     page nav, zoom / fit-width / rotate, view mode, in-document search,
 *     print and download.
 *  4. Signals readiness after first render. PDF/office renderers are async;
 *     the element has no height (scrollHeight 0) on mount. `onReady` fires
 *     from the viewer's load event so the dialog can defer `restoreReadPosition`
 *     until real height exists to scroll.
 *  5. For PPTX documents, lazily parses the pptx zip (`ppt/notesSlides/*.xml`,
 *     mapped per slide via its .rels) so the toolbar can toggle a speaker
 *     notes panel synced to the current slide — the engine does not render
 *     notes itself.
 *
 * Stability matters: the parent re-renders on every scroll tick (reading
 * position state), so callbacks are held in refs and the mount effect only
 * keys off the document identity (`content_path`). Otherwise a single scroll
 * would destroy and re-render the whole document, snapping back to the top.
 *
 * The engine bundles its own pdf.js worker for Vite, so no worker config is
 * required.
 */
const ResourcePreview = forwardRef(function ResourcePreview(
  {
    preview, // back-end preview payload: { kind, content_path, mime_type, title }
    scrollRef, // callback ref the dialog passes; attach to OUR scroll container
    onReady, // () => void — fired once the engine has laid out content
    onScrollPct, // (pct) => void — fired on scroll (reading position)
    onError, // (err) => void — render failure
  },
  ref,
) {
  const scrollerRef = useRef(null); // scrollable element (metrics + restore)
  const stageRef = useRef(null); // render target the engine appends into
  const viewRef = useRef(null); // ViewerController
  const kindRef = useRef(null);
  kindRef.current = preview?.kind ?? null;

  const isPptx = isPptxPreview(preview);

  // Viewer state mirror (page/zoom/viewMode) + PPTX notes extracted lazily.
  const [viewerState, setViewerState] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesBySlide, setNotesBySlide] = useState(null);
  const notesExtractedRef = useRef(false);

  // Latest-value refs — the parent passes inline arrows that change identity
  // on every render; the effect and scroll handler must not depend on them.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onScrollPctRef = useRef(onScrollPct);
  onScrollPctRef.current = onScrollPct;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // The engine is only for the binary kinds; text and images stay on the
  // dialog's instant renderers. Kept as a pure function so it's testable.
  const needsEngine = (kind) =>
    kind === 'pdf' || kind === 'office' || kind === 'sheet';

  // Cache fetched bytes per content path so reopening a resource (or a parent
  // re-render that briefly unmounts this component) does not re-download.
  // Bounded at 24 entries; blobs are dropped from memory when evicted.
  const blobCacheRef = useRef(new Map());

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const kind = kindRef.current;
    const contentPath = preview?.content_path;
    if (!needsEngine(kind) || !contentPath) return undefined;
    let cancelled = false;
    let view = null;
    let unsub = null;
    const blobCache = blobCacheRef.current;
    notesExtractedRef.current = false;
    setNotesOpen(false);
    setNotesBySlide(null);

    async function mount() {
      if (cancelled) return;
      let blob = blobCache.get(contentPath);
      if (!blob) {
        // 1) Pull bytes with the authenticated client (same origin, cookies).
        blob = await api
          .get(contentPath, { responseType: 'blob' })
          .then((r) => r.data);
        if (blobCache.size >= 24) blobCache.delete(blobCache.keys().next().value);
        blobCache.set(contentPath, blob);
      }
      if (cancelled) return;

      // 2) Render client-side into our stage. pagination stays ON so the
      //    controller manages zoom/visibility/page tracking, but the
      //    initial view mode is continuous — a plain stacked document inside
      //    our own scroll wrapper, so the dialog's scroll-percentage reading
      //    position is preserved exactly.
      view = createViewer({
        host: stage,
        scrollElement: scrollerRef.current,
        pagination: true,
        initialViewMode: 'continuous',
        initialZoom: 'auto',
        gestures: true,
        theme: 'auto',
        onLoad: () => {
          if (!cancelled) onReadyRef.current?.();
        },
        onError: (err) => {
          if (!cancelled) onErrorRef.current?.(err);
        },
      });
      viewRef.current = view;
      unsub = view.subscribe((s) => {
        if (!cancelled) setViewerState(s);
      });
      await view.load(blob); // blob is fetched through the authenticated client
    }

    mount().catch((err) => {
      if (!cancelled && err?.name !== 'AbortError') onErrorRef.current?.(err);
    });

    return () => {
      cancelled = true;
      unsub?.();
      view?.destroy?.();
      viewRef.current = null;
      if (stage) stage.replaceChildren();
    };
    // Intentionally keyed only on the document identity — callback props are
    // read through refs so parent re-renders never restart the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.content_path]);

  // Lazy PPTX speaker-notes extraction (only when the user toggles them).
  const toggleNotes = async () => {
    if (!isPptx) return;
    if (notesOpen) {
      setNotesOpen(false);
      return;
    }
    setNotesOpen(true);
    if (notesExtractedRef.current) return;
    notesExtractedRef.current = true;
    setNotesLoading(true);
    try {
      const blob = blobCacheRef.current.get(preview?.content_path);
      if (blob) setNotesBySlide(await extractPptxNotes(blob));
    } catch {
      setNotesBySlide(new Map());
    } finally {
      setNotesLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    /** Scroll to a saved reading position (percentage). */
    restore(percent) {
      const scroller = scrollerRef.current;
      const view = viewRef.current;
      if (!scroller) return;
      // In paged view a scroll-percentage has no meaning — land on the page
      // instead. Continuous keeps the dialog's scroll-based model.
      if (view && view.getState?.().viewMode === 'paged') {
        const total = view.getPageCount?.() || 1;
        view.goToPage?.(Math.max(1, Math.min(total, Math.round((percent / 100) * total))));
        return;
      }
      // Defer until the engine has laid out (scrollHeight > 0), then attempt
      // repeatedly until the document is tall enough — async PDF/office cells
      // settle as pages stream in.
      const apply = () => {
        const total = scroller.scrollHeight - scroller.clientHeight;
        if (total <= 0) return false;
        scroller.scrollTop = (percent / 100) * total;
        return true;
      };
      if (apply()) return;
      const timer = window.setInterval(() => {
        if (apply() || !scrollerRef.current) window.clearInterval(timer);
      }, 200);
      // Safety stop — don't poll forever if the renderer errors.
      window.setTimeout(() => window.clearInterval(timer), 8000);
    },
    /** Scroll back to the top (for non-resuming first open). */
    reset() {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollTop = 0;
    },
    destroy() {
      viewRef.current?.destroy?.();
      viewRef.current = null;
    },
  }));

  if (!needsEngine(preview?.kind)) return null;

  const currentNotes =
    notesOpen && notesBySlide ? notesBySlide.get(viewerState?.page ?? 1) : null;

  return (
    <div className="relative h-full w-full">
      <div
        ref={(el) => {
          scrollerRef.current = el;
          // The dialog hands us either a callback ref or its own object ref
          // (`previewScrollRef`) so the existing reading-position hooks keep
          // targeting the same scroll container we attach the engine to.
          if (typeof scrollRef === 'function') scrollRef(el);
          else if (scrollRef && typeof scrollRef === 'object')
            scrollRef.current = el;
        }}
        className="h-full w-full overflow-auto"
        onScroll={() => {
          const el = scrollerRef.current;
          if (!el) return;
          const total = el.scrollHeight - el.clientHeight;
          if (total <= 0) return;
          onScrollPctRef.current?.((el.scrollTop / total) * 100);
        }}
      >
        <div ref={stageRef} className="min-h-full w-full" />
      </div>

      <PreviewToolbar
        controller={viewRef.current}
        state={viewerState}
        isPptx={isPptx}
        notesOpen={notesOpen}
        notesLoading={notesLoading}
        onToggleNotes={toggleNotes}
      />

      {currentNotes ? (
        <div className="absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)]/95 shadow-[var(--shadow-pop)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-1.5">
            <span className="text-[11px] font-[600] text-[var(--muted)]">
              Speaker notes · Slide {viewerState.page}
            </span>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg-soft)]"
              aria-label="Close notes"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="max-h-40 overflow-auto px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap text-[var(--fg-soft)]">
            {currentNotes}
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default ResourcePreview;