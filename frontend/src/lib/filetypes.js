/**
 * Small utilities for mapping resource mime types / extensions to
 * human-friendly labels, tinted backgrounds, and Lucide icons.
 *
 * Keeps the UI consistent across the resources grid, detail dialog,
 * chat attachment chips, and bookmarks.
 *
 * File types and visibility scopes are metadata, not status — chips share
 * one neutral token treatment (see DESIGN.md → Color System).
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
  pdf:  { icon: FileText,      label: 'PDF',        tint: 'bg-muted text-muted-foreground' },
  doc:  { icon: FileText,      label: 'Word',       tint: 'bg-muted text-muted-foreground' },
  docx: { icon: FileText,      label: 'Word',       tint: 'bg-muted text-muted-foreground' },
  txt:  { icon: FileType2,     label: 'Text',       tint: 'bg-muted text-muted-foreground' },
  md:   { icon: FileText,      label: 'Markdown',   tint: 'bg-muted text-muted-foreground' },
  rtf:  { icon: FileText,      label: 'RTF',        tint: 'bg-muted text-muted-foreground' },

  // Spreadsheets
  csv:  { icon: FileSpreadsheet, label: 'CSV',      tint: 'bg-muted text-muted-foreground' },
  xls:  { icon: FileSpreadsheet, label: 'Excel',    tint: 'bg-muted text-muted-foreground' },
  xlsx: { icon: FileSpreadsheet, label: 'Excel',    tint: 'bg-muted text-muted-foreground' },

  // Presentations
  ppt:  { icon: Presentation,  label: 'PowerPoint', tint: 'bg-muted text-muted-foreground' },
  pptx: { icon: Presentation,  label: 'PowerPoint', tint: 'bg-muted text-muted-foreground' },

  // Code / data
  json: { icon: FileJson,      label: 'JSON',       tint: 'bg-muted text-muted-foreground' },
  js:   { icon: FileCode2,     label: 'JS',         tint: 'bg-muted text-muted-foreground' },
  jsx:  { icon: FileCode2,     label: 'JSX',        tint: 'bg-muted text-muted-foreground' },
  ts:   { icon: FileCode2,     label: 'TS',         tint: 'bg-muted text-muted-foreground' },
  tsx:  { icon: FileCode2,     label: 'TSX',        tint: 'bg-muted text-muted-foreground' },
  py:   { icon: FileCode2,     label: 'Python',     tint: 'bg-muted text-muted-foreground' },
  html: { icon: FileCode2,     label: 'HTML',       tint: 'bg-muted text-muted-foreground' },
  css:  { icon: FileCode2,     label: 'CSS',        tint: 'bg-muted text-muted-foreground' },

  // Media
  png:  { icon: FileImage,     label: 'Image',      tint: 'bg-muted text-muted-foreground' },
  jpg:  { icon: FileImage,     label: 'Image',      tint: 'bg-muted text-muted-foreground' },
  jpeg: { icon: FileImage,     label: 'Image',      tint: 'bg-muted text-muted-foreground' },
  gif:  { icon: FileImage,     label: 'Image',      tint: 'bg-muted text-muted-foreground' },
  webp: { icon: FileImage,     label: 'Image',      tint: 'bg-muted text-muted-foreground' },
  svg:  { icon: FileImage,     label: 'SVG',        tint: 'bg-muted text-muted-foreground' },
  mp4:  { icon: Film,          label: 'Video',      tint: 'bg-muted text-muted-foreground' },
  mov:  { icon: Film,          label: 'Video',      tint: 'bg-muted text-muted-foreground' },
  webm: { icon: Film,          label: 'Video',      tint: 'bg-muted text-muted-foreground' },
  mp3:  { icon: Music,         label: 'Audio',      tint: 'bg-muted text-muted-foreground' },
  wav:  { icon: Music,         label: 'Audio',      tint: 'bg-muted text-muted-foreground' },

  // Archives
  zip:  { icon: Archive,       label: 'Archive',    tint: 'bg-muted text-muted-foreground' },
  rar:  { icon: Archive,       label: 'Archive',    tint: 'bg-muted text-muted-foreground' },
  '7z': { icon: Archive,       label: 'Archive',    tint: 'bg-muted text-muted-foreground' },
  tar:  { icon: Archive,       label: 'Archive',    tint: 'bg-muted text-muted-foreground' },
  gz:   { icon: Archive,       label: 'Archive',    tint: 'bg-muted text-muted-foreground' },
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
  private:     { label: 'Private',     tint: 'bg-muted text-muted-foreground', dot: 'bg-[var(--border-strong)]' },
  course:      { label: 'Course',      tint: 'bg-muted text-muted-foreground', dot: 'bg-[var(--border-strong)]' },
  programme:   { label: 'Programme',   tint: 'bg-muted text-muted-foreground', dot: 'bg-[var(--border-strong)]' },
  department:  { label: 'Department',  tint: 'bg-muted text-muted-foreground', dot: 'bg-[var(--border-strong)]' },
  faculty:     { label: 'Faculty',     tint: 'bg-muted text-muted-foreground', dot: 'bg-[var(--border-strong)]' },
  institution: { label: 'Institution', tint: 'bg-muted text-muted-foreground', dot: 'bg-[var(--border-strong)]' },
};
