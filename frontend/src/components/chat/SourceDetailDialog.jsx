import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getFileType } from '@/lib/filetypes';
import { ExternalLink } from 'lucide-react';

export default function SourceDetailDialog({ source, open, onClose, onOpenResource }) {
  if (!source) return null;
  
  const meta = getFileType(source.resource_title || '', source.mime_type || '');
  const FileIcon = meta.icon;
  
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold', meta.tint)}>
              {source.rank}
            </span>
            Source {source.rank}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Resource info */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', meta.tint)}>
              <FileIcon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{source.resource_title || 'Unknown resource'}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="uppercase tracking-wide">{meta.label}</span>
                {source.version_number && <span>· v{source.version_number}</span>}
                {source.similarity_score != null && (
                  <span>· {Math.round(Number(source.similarity_score) * 100)}% match</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Chunk text */}
          {source.chunk_text && (
            <div className="rounded-lg border bg-background p-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Referenced excerpt
              </p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
                {source.chunk_text}
              </p>
            </div>
          )}
          
          {/* Metadata */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>Retrieval: {source.retrieval_method || 'hybrid'}</span>
            {source.similarity_score != null && (
              <span>Confidence: {Math.round(Number(source.similarity_score) * 100)}%</span>
            )}
          </div>
          
          {/* Open resource button */}
          {source.resource_id && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                onClose();
                if (onOpenResource) onOpenResource(source.resource_id);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Open full resource
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
