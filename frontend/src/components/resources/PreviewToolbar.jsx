import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  LayoutGrid,
  Printer,
  RotateCw,
  Rows3,
  Scan,
  Search,
  StickyNote,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

/**
 * PreviewToolbar — thin chrome around the engine-backed preview that exposes
 * the omni-doc-viewer ViewerController: page nav, zoom / fit-width, rotate,
 * view mode, search, print, download. Plus the PPTX speaker-notes toggle
 * (the engine does not render notes; the panel content is supplied by the
 * caller from `extractPptxNotes`).
 *
 * Rendered as a floating glass pill over the top of the preview so it never
 * shifts the scroll container (reading-position percentages stay valid).
 */
export default function PreviewToolbar({
  controller,
  state,
  isPptx,
  notesOpen,
  notesLoading,
  onToggleNotes,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  if (!controller || !state || state.status !== 'loaded') return null;

  const { page, pageCount, zoom, viewMode, capabilities, search } = state;
  const paged = !!capabilities?.paged && pageCount > 1;
  const zoomable = !!capabilities?.zoom;
  const rotatable = !!capabilities?.rotate;
  const printable = !!capabilities?.print;

  const iconBtn = 'hover:bg-[var(--hover)] hover:text-[var(--fg)]';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
      <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-1 py-0.5 shadow-[var(--shadow-pop)]">
        {paged ? (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              className={iconBtn}
              aria-label="Previous page"
              onClick={() => controller.prevPage()}
              disabled={page <= 1}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-10 text-center font-mono text-[10.5px] tabular-nums text-[var(--fg-soft)] select-none">
              {page} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className={iconBtn}
              aria-label="Next page"
              onClick={() => controller.nextPage()}
              disabled={page >= pageCount}
            >
              <ChevronRight />
            </Button>
            <span className="mx-0.5 h-4 w-px bg-[var(--border-strong)]" aria-hidden />
          </>
        ) : null}

        {zoomable ? (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              className={iconBtn}
              aria-label="Zoom out"
              onClick={() => controller.zoomOut()}
            >
              <ZoomOut />
            </Button>
            <button
              type="button"
              onClick={() => controller.resetZoom()}
              title="Reset zoom"
              className="min-w-9 px-0.5 text-center font-mono text-[10.5px] tabular-nums text-[var(--fg-soft)] select-none hover:text-[var(--fg)]"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              className={iconBtn}
              aria-label="Zoom in"
              onClick={() => controller.zoomIn()}
            >
              <ZoomIn />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className={iconBtn}
              aria-label="Fit width"
              onClick={() => controller.fitWidth()}
            >
              <Scan />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className={iconBtn}
              aria-label="Rotate 90°"
              onClick={() => controller.rotate(90)}
              disabled={!rotatable}
            >
              <RotateCw />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className={iconBtn}
              aria-label={viewMode === 'paged' ? 'Continuous view' : 'Paged view'}
              onClick={() => controller.toggleViewMode()}
              disabled={!paged}
            >
              {viewMode === 'paged' ? <Rows3 /> : <LayoutGrid />}
            </Button>
            <span className="mx-0.5 h-4 w-px bg-[var(--border-strong)]" aria-hidden />
          </>
        ) : null}

        {capabilities?.search ? (
          <>
            {searchOpen ? (
              <div className="flex items-center gap-0.5">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search.query}
                  onChange={(e) => void controller.search(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void (e.shiftKey ? controller.findPrev() : controller.findNext());
                    if (e.key === 'Escape') setSearchOpen(false);
                  }}
                  placeholder="Find…"
                  className="h-6 w-24 rounded-[6px] bg-[var(--surface-2)] px-1.5 text-[11px] text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none"
                />
                {search.total > 0 ? (
                  <span className="min-w-8 text-center font-mono text-[10px] tabular-nums text-[var(--fg-soft)] select-none">
                    {search.current}/{search.total}
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={iconBtn}
                  aria-label="Previous match"
                  onClick={() => void controller.findPrev()}
                  disabled={search.total === 0}
                >
                  <ChevronUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={iconBtn}
                  aria-label="Next match"
                  onClick={() => void controller.findNext()}
                  disabled={search.total === 0}
                >
                  <ChevronDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={iconBtn}
                  aria-label="Close search"
                  onClick={() => {
                    controller.clearSearch();
                    setSearchOpen(false);
                  }}
                >
                  <X />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon-xs"
                className={iconBtn}
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
              >
                <Search />
              </Button>
            )}
            <span className="mx-0.5 h-4 w-px bg-[var(--border-strong)]" aria-hidden />
          </>
        ) : null}

        {isPptx ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(iconBtn, notesOpen && 'bg-[var(--accent-soft)] text-[var(--accent-strong)]')}
            aria-label="Toggle speaker notes"
            aria-pressed={notesOpen}
            onClick={onToggleNotes}
            disabled={notesLoading}
          >
            {notesLoading ? (
              <span className="size-3 animate-spin rounded-full border-2 border-[var(--accent-strong)] border-t-transparent" />
            ) : (
              <StickyNote />
            )}
          </Button>
        ) : null}

        {printable ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className={iconBtn}
            aria-label="Print"
            onClick={() => controller.print()}
          >
            <Printer />
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon-xs"
          className={iconBtn}
          aria-label="Download original file"
          onClick={() => controller.download()}
        >
          <Download />
        </Button>
      </div>
    </div>
  );
}