/**
 * Small utilities for mapping resource mime types / extensions to
 * human-friendly labels, tinted backgrounds, and Lucide icons.
 *
 * Keeps the UI consistent across the resources grid, detail dialog,
 * chat attachment chips, and bookmarks.
 */
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileImage,
  FileCode2,
  Film,
  Music,
  Archive,
  File,
  FileJson,
  FileType2,
} from 'lucide-react';

const EXT_MAP = {
  // Documents
  pdf:  { icon: FileText,      label: 'PDF',        tint: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  doc:  { icon: FileText,      label: 'Word',       tint: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  docx: { icon: FileText,      label: 'Word',       tint: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  txt:  { icon: FileType2,     label: 'Text',       tint: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  md:   { icon: FileText,      label: 'Markdown',   tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  rtf:  { icon: FileText,      label: 'RTF',        tint: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },

  // Spreadsheets
  csv:  { icon: FileSpreadsheet, label: 'CSV',      tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  xls:  { icon: FileSpreadsheet, label: 'Excel',    tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  xlsx: { icon: FileSpreadsheet, label: 'Excel',    tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },

  // Presentations
  ppt:  { icon: Presentation,  label: 'PowerPoint', tint: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  pptx: { icon: Presentation,  label: 'PowerPoint', tint: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },

  // Code / data
  json: { icon: FileJson,      label: 'JSON',       tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  js:   { icon: FileCode2,     label: 'JS',         tint: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  jsx:  { icon: FileCode2,     label: 'JSX',        tint: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  ts:   { icon: FileCode2,     label: 'TS',         tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  tsx:  { icon: FileCode2,     label: 'TSX',        tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  py:   { icon: FileCode2,     label: 'Python',     tint: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  html: { icon: FileCode2,     label: 'HTML',       tint: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  css:  { icon: FileCode2,     label: 'CSS',        tint: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },

  // Media
  png:  { icon: FileImage,     label: 'Image',      tint: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  jpg:  { icon: FileImage,     label: 'Image',      tint: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  jpeg: { icon: FileImage,     label: 'Image',      tint: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  gif:  { icon: FileImage,     label: 'Image',      tint: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  webp: { icon: FileImage,     label: 'Image',      tint: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  svg:  { icon: FileImage,     label: 'SVG',        tint: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  mp4:  { icon: Film,          label: 'Video',      tint: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  mov:  { icon: Film,          label: 'Video',      tint: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  webm: { icon: Film,          label: 'Video',      tint: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  mp3:  { icon: Music,         label: 'Audio',      tint: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400' },
  wav:  { icon: Music,         label: 'Audio',      tint: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400' },

  // Archives
  zip:  { icon: Archive,       label: 'Archive',    tint: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  rar:  { icon: Archive,       label: 'Archive',    tint: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  '7z': { icon: Archive,       label: 'Archive',    tint: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  tar:  { icon: Archive,       label: 'Archive',    tint: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  gz:   { icon: Archive,       label: 'Archive',    tint: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
};

const MIME_PREFIX_MAP = [
  { prefix: 'application/pdf', ext: 'pdf' },
  { prefix: 'application/msword', ext: 'doc' },
  { prefix: 'application/vnd.openxmlformats-officedocument.wordprocessingml', ext: 'docx' },
  { prefix: 'application/vnd.ms-excel', ext: 'xls' },
  { prefix: 'application/vnd.openxmlformats-officedocument.spreadsheetml', ext: 'xlsx' },
  { prefix: 'application/vnd.ms-powerpoint', ext: 'ppt' },
  { prefix: 'application/vnd.openxmlformats-officedocument.presentationml', ext: 'pptx' },
  { prefix: 'application/json', ext: 'json' },
  { prefix: 'application/zip', ext: 'zip' },
  { prefix: 'text/csv', ext: 'csv' },
  { prefix: 'text/plain', ext: 'text' },
  { prefix: 'text/markdown', ext: 'md' },
  { prefix: 'text/html', ext: 'html' },
  { prefix: 'text/css', ext: 'css' },
  { prefix: 'image/', ext: 'png' },
  { prefix: 'video/', ext: 'mp4' },
  { prefix: 'audio/', ext: 'mp3' },
];

/**
 * Resolve { icon, label, tint, extension } from a filename and/or mime type.
 * Always returns a usable object (falls back to a generic File icon).
 */
export function getFileType(filename = '', mimeType = '') {
  const lowerName = String(filename || '').toLowerCase();
  const dot = lowerName.lastIndexOf('.');
  const ext = dot >= 0 ? lowerName.slice(dot + 1) : '';

  if (ext && EXT_MAP[ext]) {
    return { icon: EXT_MAP[ext].icon, label: EXT_MAP[ext].label, tint: EXT_MAP[ext].tint, extension: ext };
  }

  const mt = String(mimeType || '').toLowerCase();
  for (const { prefix, ext: mappedExt } of MIME_PREFIX_MAP) {
    if (mt.startsWith(prefix)) {
      const meta = EXT_MAP[mappedExt] || { icon: File, label: 'File', tint: 'bg-muted text-muted-foreground' };
      return { icon: meta.icon, label: meta.label, tint: meta.tint, extension: mappedExt };
    }
  }

  return { icon: File, label: ext ? ext.toUpperCase() : 'File', tint: 'bg-muted text-muted-foreground', extension: ext };
}

export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '';
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export const SCOPE_META = {
  private:     { label: 'Private',     tint: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',     dot: 'bg-zinc-500' },
  course:      { label: 'Course',      tint: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500' },
  programme:   { label: 'Programme',   tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
  department:  { label: 'Department',  tint: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400', dot: 'bg-fuchsia-500' },
  faculty:     { label: 'Faculty',     tint: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',       dot: 'bg-pink-500' },
  institution: { label: 'Institution', tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
};
