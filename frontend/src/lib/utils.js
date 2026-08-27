import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO date/timestamp as a short relative time ("3 seconds ago",
 * "2 minutes ago", "last month", etc.). Uses Intl.RelativeTimeFormat when
 * available, with a hand-rolled fallback.
 */
export function formatRelativeTime(input) {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const absMs = Math.abs(diffMs);
  const sign = diffMs < 0 ? -1 : 1;

  const units = [
    { unit: "year", ms: 365.25 * 24 * 60 * 60 * 1000 },
    { unit: "month", ms: (365.25 / 12) * 24 * 60 * 60 * 1000 },
    { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
    { unit: "day", ms: 24 * 60 * 60 * 1000 },
    { unit: "hour", ms: 60 * 60 * 1000 },
    { unit: "minute", ms: 60 * 1000 },
    { unit: "second", ms: 1000 },
  ];

  for (const { unit, ms } of units) {
    if (absMs >= ms || unit === "second") {
      const value = Math.round((absMs / ms) * sign);
      try {
        const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
        return rtf.format(value, unit);
      } catch {
        const abs = Math.abs(value);
        const suffix = value < 0 ? "ago" : "from now";
        return `${abs} ${unit}${abs === 1 ? "" : "s"} ${suffix}`;
      }
    }
  }
  return d.toLocaleString();
}

/**
 * Return a short MIME-appropriate Lucide icon name for a given filename
 * or MIME type. Caller maps the returned key to a Lucide icon component.
 */
export function pickFileIcon(nameOrMime = "") {
  const s = String(nameOrMime || "").toLowerCase();
  if (s.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(s)) return "image";
  if (s.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv)$/.test(s)) return "video";
  if (s.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac)$/.test(s)) return "audio";
  if (/\.(pdf)$/.test(s) || s.includes("pdf")) return "pdf";
  if (/\.(zip|tar|gz|rar|7z)$/.test(s) || s.includes("archive") || s.includes("zip")) return "archive";
  if (/\.(xls|xlsx|csv|ods)$/.test(s) || s.includes("spreadsheet") || s.includes("excel")) return "sheet";
  if (/\.(doc|docx|odt|rtf)$/.test(s) || s.includes("word")) return "doc";
  if (/\.(ppt|pptx|odp)$/.test(s) || s.includes("presentation") || s.includes("powerpoint")) return "slides";
  if (/\.(py|js|jsx|ts|tsx|java|c|cpp|cs|go|rs|rb|php|html|css|json|xml|yml|yaml|sh|bash)$/.test(s) || s.startsWith("text/")) return "code";
  return "file";
}
