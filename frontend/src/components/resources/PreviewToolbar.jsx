import { useRef, useState } from 'react';
import { SearchBar, Toolbar } from 'omni-doc-viewer/react';
import { Maximize, RotateCw, StickyNote, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * PreviewToolbar — the omni-doc-viewer built-in `Toolbar` (+ `SearchBar`), the
 * same chrome `DocViewer` renders internally, mounted as a floating glass pill
 * over our own scroll container so reading-position percentages stay valid.
 *
 * The library's zoom cluster shows a read-only percentage button, so we hide it
 * (`items.zoom: false` also takes fitWidth/rotate down with it) and render an
 * editable zoom cluster instead: out / editable % / in / fit-width / rotate.
 *
 * The whole pill is draggable (pointer events + transform) and clamped inside
 * its containing preview area, so it never floats off-screen. Dragging is only
 * started from non-interactive surfaces — buttons, the zoom input and the page
 * field keep normal click/focus behavior.
 *
 * Only the PPTX speaker-notes toggle is app-specific (`extra` slot) — the
 * engine never renders notes; `ResourcePreview` supplies the panel content.
 */
const ZOOM_PCT = {
  MIN: 25,
  MAX: 400,
};

function EditableZoomPct({ zoom, controller }) {
  const percent = Math.round(zoom * 100);
  const [draft, setDraft] = useState(null);
  const inputRef = useRef(null);

  const commit = () => {
    if (draft === null) return;
    let v = Number.parseInt(draft, 10);
    if (Number.isNaN(v)) {
      setDraft(null);
      return;
    }
    v = Math.max(ZOOM_PCT.MIN, Math.min(ZOOM_PCT.MAX, v));
    controller.setZoom(v / 100);
    setDraft(null);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="odv-pg-pct-input"
        aria-label="Zoom percentage"
        value={draft ?? String(percent)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
      <span className="odv-pg-pct-unit" aria-hidden>
        %
      </span>
    </>
  );
}

function ZoomCluster({ state, controller }) {
  const caps = state.capabilities;
  const canZoom = !!caps?.zoom;
  if (!canZoom) return null;
  return (
    <>
      <div className="odv-pg-sep" />
      <div className="odv-pg-grp odv-pg-zoomgrp">
        <button
          type="button"
          className="odv-pg-btn"
          onClick={() => controller.zoomOut()}
          disabled={state.zoom <= 0.25}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut size={18} strokeWidth={2} />
        </button>
        <EditableZoomPct zoom={state.zoom} controller={controller} />
        <button
          type="button"
          className="odv-pg-btn"
          onClick={() => controller.zoomIn()}
          disabled={state.zoom >= 4}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn size={18} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="odv-pg-btn"
          onClick={() => controller.fitWidth()}
          aria-label="Fit to width"
          title="Fit to width"
        >
          <Maximize size={18} strokeWidth={2} />
        </button>
        {caps?.rotate ? (
          <button
            type="button"
            className="odv-pg-btn"
            onClick={() => controller.rotate(90)}
            aria-label="Rotate"
            title="Rotate"
          >
            <RotateCw size={18} strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </>
  );
}

const DRAG_THRESHOLD = 4;
const DRAG_MARGIN = 6;

export default function PreviewToolbar({
  controller,
  state,
  isPptx,
  notesOpen,
  notesLoading,
  onToggleNotes,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null); // outermost wrapper (bounds of the preview area)
  const pillRef = useRef(null); // the draggable pill itself
  const dragInfoRef = useRef(null); // active pointer session

  // `ResourcePreview` keys this toolbar by the controller, so a new document
  // remounts it and `offset` starts centered — no manual reset needed here.

  if (!controller || !state || state.status !== 'loaded') return null;

  const caps = state.capabilities;
  const canSearch = !!caps?.search;
  const closeSearch = () => {
    setSearchOpen(false);
    controller.clearSearch();
  };

  const startDrag = (e) => {
    // Only button-0, keyboard accessible via tab stops anyway; never steal a
    // drag from interactive chrome (search input, zoom input, buttons, inputs).
    if (e.button !== 0) return;
    if (e.target.closest('button, input, a[href], select, textarea')) return;
    const el = pillRef.current;
    if (!el) return;
    dragInfoRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...offset },
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
    e.preventDefault();
  };

  const moveDrag = (e) => {
    const info = dragInfoRef.current;
    const el = pillRef.current;
    const wrap = dragRef.current;
    if (!info || !el || !wrap) return;
    if (e.pointerId !== info.pointerId) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) info.moved = true;
    if (!info.moved) return;
    // Position the pill from its current rect, moved by the pointer delta,
    // then clamp it fully inside the preview container with a small margin.
    const wrapRect = wrap.getBoundingClientRect();
    const pillRect = el.getBoundingClientRect();
    const pad = DRAG_MARGIN;
    // Pill base placement: centered horizontally (`left-1/2` + -50%) at
    // `top-2` (8px), plus the stored drag offset from session start.
    const baseLeft = wrapRect.width / 2 - pillRect.width / 2;
    const baseTop = 8;
    const nextLeft = Math.max(
      pad,
      Math.min(baseLeft + info.origin.x + dx, wrapRect.width - pillRect.width - pad),
    );
    const nextTop = Math.max(
      pad,
      Math.min(baseTop + info.origin.y + dy, wrapRect.height - pillRect.height - pad),
    );
    setOffset({
      x: nextLeft - baseLeft,
      y: nextTop - baseTop,
    });
  };

  const endDrag = (_e) => {
    const info = dragInfoRef.current;
    const el = pillRef.current;
    if (!info || !el) return;
    dragInfoRef.current = null;
    if (el.hasPointerCapture(info.pointerId)) el.releasePointerCapture(info.pointerId);
    el.classList.remove('is-dragging');
  };

  const notesButton = isPptx ? (
    <button
      type="button"
      className={`odv-pg-btn${notesOpen ? ' is-active' : ''}`}
      onClick={onToggleNotes}
      disabled={notesLoading}
      aria-label="Toggle speaker notes"
      aria-pressed={notesOpen}
      title="Speaker notes"
    >
      {notesLoading ? (
        <span className="size-3 animate-spin rounded-full border-2 border-[var(--accent-strong)] border-t-transparent" />
      ) : (
        <StickyNote size={18} strokeWidth={2} />
      )}
    </button>
  ) : null;

  return (
    <div ref={dragRef} className="pointer-events-none absolute inset-0 z-10">
      <div
        ref={pillRef}
        className="odv-pg-dragpill pointer-events-auto absolute left-1/2 top-2 flex select-none flex-col items-center gap-2"
        style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="odv-toolbar-glass glass flex items-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-1 py-0.5 shadow-[var(--shadow-pop)]">
          <ZoomCluster state={state} controller={controller} />
          <Toolbar
            current={state.page}
            total={state.pageCount}
            zoom={state.zoom}
            viewMode={state.viewMode}
            disabled={false}
            onPrev={() => controller.prevPage()}
            onNext={() => controller.nextPage()}
            onJump={(n) => controller.goToPage(n)}
            onToggleMode={() => controller.toggleViewMode()}
            onDownload={() => controller.download()}
            onPrint={() => controller.print()}
            onSearch={canSearch ? () => (searchOpen ? closeSearch() : setSearchOpen(true)) : undefined}
            searchOpen={searchOpen}
            items={{
              pages: !!caps?.paged,
              viewMode: !!caps?.paged,
              zoom: false, // replaced by our editable zoom cluster
              fitWidth: false,
              rotate: false,
              search: canSearch,
              thumbnails: false,
              print: !!caps?.print,
              download: true,
            }}
            extra={notesButton}
          />
        </div>
        {searchOpen && canSearch ? (
          <div className="odv-toolbar-glass glass rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-1 shadow-[var(--shadow-pop)]">
            <SearchBar
              state={state.search}
              onQuery={(q) => void controller.search(q)}
              onNext={() => void controller.findNext()}
              onPrev={() => void controller.findPrev()}
              onClose={closeSearch}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}