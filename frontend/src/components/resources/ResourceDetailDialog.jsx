import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Alert, AlertDescription,
} from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Bookmark, BookmarkCheck, Download, Loader2, RefreshCw, TriangleAlert,
} from "lucide-react";

/**
 * Material detail dialog: preview, download, bookmark, and retry processing.
 * Preview modes: text (inline), pdf (signed URL in iframe), download-only.
 */
export default function ResourceDetailDialog({ resource, open, onClose }) {
  const qc = useQueryClient();
  const [bookmarkId, setBookmarkId] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const { data: preview, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ["resource-preview", resource?.id],
    queryFn: async () => {
      const { data } = await api.get(`/resources/${resource.id}/preview/`);
      return data;
    },
    enabled: open && !!resource,
  });

  // Which of the user's bookmarks (if any) points at this resource?
  const { data: bookmarks } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const { data } = await api.get("/bookmarks/?page_size=100");
      return data.results || data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (!bookmarks || !resource) return;
    const match = bookmarks.find((b) => b.resource === resource.id);
    setBookmarkId(match ? match.id : null);
  }, [bookmarks, resource]);

  if (!resource) return null;

  const toggleBookmark = async () => {
    try {
      if (bookmarkId) {
        await api.delete(`/bookmarks/${bookmarkId}/`);
        setBookmarkId(null);
        toast.success("Bookmark removed");
      } else {
        const { data } = await api.post("/bookmarks/", { resource: resource.id });
        setBookmarkId(data.id);
        toast.success("Material bookmarked");
      }
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    } catch {
      toast.error("Could not update bookmark");
    }
  };

  const download = async () => {
    try {
      const { data } = await api.get(`/resources/${resource.id}/download_url/`);
      window.open(data.download_url, "_blank", "noopener");
    } catch {
      toast.error("Could not start the download");
    }
  };

  const retry = async () => {
    setRetrying(true);
    try {
      await api.post(`/resources/${resource.id}/retry_processing/`);
      toast.success("Reprocessing started");
      qc.invalidateQueries({ queryKey: ["resources"] });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.detail || "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="pr-8 text-base leading-snug">{resource.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
            <StatusBadge status={resource.processing_status} />
            <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
              {resource.visibility_scope}
            </span>
          </DialogDescription>
        </DialogHeader>

        {resource.processing_status === "failed" ? (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Processing failed.</span>{" "}
              {resource.processing_error || "The file could not be processed."}
            </AlertDescription>
          </Alert>
        ) : null}
        {resource.processing_status !== "ready" &&
        resource.processing_status !== "failed" ? (
          <div className="flex items-center gap-2 rounded-lg border bg-accent/40 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
            This material is {resource.processing_status}. Preview unlocks when
            processing completes.
          </div>
        ) : null}

        {/* Preview area */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/30">
          {resource.processing_status !== "ready" ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              No preview available.
            </div>
          ) : previewLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading preview…
            </div>
          ) : previewError ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
              Could not load the preview.
            </div>
          ) : preview?.kind === "text" ? (
            <pre className="h-full overflow-auto whitespace-pre-wrap p-4 text-[13px] leading-relaxed chat-scroll">
              {preview.content}
              {preview.truncated ? "\n\n… (preview truncated at 512 KB — download for the full file)" : ""}
            </pre>
          ) : preview?.kind === "pdf" ? (
            <iframe
              src={preview.preview_url}
              title={`Preview of ${resource.title}`}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <p>{preview?.detail || "Preview not available for this file type."}</p>
              <Button type="button" variant="outline" size="sm" onClick={download}>
                <Download className="mr-2 h-4 w-4" aria-hidden /> Download file
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" size="sm" className="shadow-sm" onClick={download}>
            <Download className="mr-2 h-4 w-4" aria-hidden /> Download
          </Button>
          <Button
            type="button"
            size="sm"
            variant={bookmarkId ? "secondary" : "outline"}
            onClick={toggleBookmark}
          >
            {bookmarkId ? (
              <>
                <BookmarkCheck className="mr-2 h-4 w-4 text-primary" aria-hidden /> Bookmarked
              </>
            ) : (
              <>
                <Bookmark className="mr-2 h-4 w-4" aria-hidden /> Bookmark
              </>
            )}
          </Button>
          {resource.processing_status === "failed" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={retry}
              disabled={retrying}
              className="ml-auto border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} aria-hidden />
              {retrying ? "Restarting…" : "Retry processing"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
