import { useRef } from "react";
import { AVATAR_PRESETS } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import { Camera, Trash2 } from "lucide-react";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * Reusable avatar chooser: preset illustration grid plus an optional
 * picture upload tile. Controlled:
 *   presetId — currently selected preset ("" when a file is chosen)
 *   file     — File object chosen by the user (null when none)
 *   preview  — object URL / data URL of `file`
 */
export default function AvatarPicker({
  presetId,
  onPresetId,
  file,
  preview,
  onFile,
  onError,
}) {
  const inputRef = useRef(null);

  const pick = (f) => {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      onError?.("Use a PNG, JPEG, GIF or WebP image.");
      return;
    }
    if (f.size > MAX_AVATAR_BYTES) {
      onError?.("Image must be 2 MB or smaller.");
      return;
    }
    onFile(f);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
        {/* Upload tile */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Upload a picture"
          className={cn(
            "group relative aspect-square overflow-hidden rounded-xl border-2 border-dashed transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            file
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/60 hover:bg-muted",
          )}
        >
          {preview ? (
            <>
              <img src={preview} alt="" className="h-full w-full object-cover" />
              <span
                role="button"
                tabIndex={0}
                aria-label="Remove uploaded picture"
                onClick={(e) => {
                  e.stopPropagation();
                  onFile(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    onFile(null);
                  }
                }}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </span>
            </>
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <Camera className="h-5 w-5" aria-hidden />
              <span className="text-[10px] font-medium">Upload</span>
            </span>
          )}
        </button>

        {/* Presets */}
        {AVATAR_PRESETS.map((p) => {
          const active = !file && presetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onFile(null);
                onPresetId(p.id);
              }}
              aria-pressed={active}
              title={p.label}
              className={cn(
                "aspect-square overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-2 focus-visible:outline-ring",
                active
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-transparent hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
              )}
            >
              <img src={p.src} alt="" className="h-full w-full object-cover" draggable="false" />
            </button>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <p className="text-xs text-muted-foreground">
        Pick an avatar or upload your own photo (PNG/JPEG, max 2 MB).
      </p>
    </div>
  );
}
