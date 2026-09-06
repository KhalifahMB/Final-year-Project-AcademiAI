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
        {/* Upload tile — the replace/remove controls are siblings, never
        nested buttons, so keyboard and screen-reader interaction is valid. */}
        <div
          className={cn(
            "group relative aspect-square overflow-hidden rounded-xl border-2 border-dashed transition-colors",
            file
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/60 hover:bg-muted",
          )}
        >
          {preview ? (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label="Replace picture"
                className="absolute inset-0 rounded-[10px] focus-visible:outline-2 focus-visible:outline-ring"
              >
                <img src={preview} alt="" className="h-full w-full object-cover" />
              </button>
              <button
                type="button"
                aria-label="Remove uploaded picture"
                onClick={(e) => {
                  e.stopPropagation();
                  onFile(null);
                }}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white transition-opacity focus-visible:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="Upload a picture"
              className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-1 rounded-[10px] text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Camera className="h-5 w-5" aria-hidden />
              <span className="text-[10px] font-medium">Upload</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            aria-label="Choose a picture file"
            onChange={(e) => {
              pick(e.target.files?.[0] || null);
              e.target.value = "";
            }}
          />
        </div>

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
              aria-label={`Use ${p.label} avatar`}
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
      <p className="text-xs text-muted-foreground">
        Pick an avatar or upload your own photo (PNG/JPEG, max 2 MB).
      </p>
    </div>
  );
}
