import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { notesApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  StickyNote,
  Plus,
  Save,
  Trash2,
  Search,
  Bold,
  ChevronLeft,
 Italic,
 Underline as UnderlineIcon,
 Strikethrough,
 Heading1,
 Heading2,
 Heading3,
 List,
 ListOrdered,
 Quote,
 Code,
 Highlighter,
 MoreVertical,
 Check,
 Loader2,
 Pencil,
 FileText,
 Image as ImageIcon,
 Link as LinkIcon,
} from 'lucide-react';
import {
 DropdownMenu,
 DropdownMenuContent,
DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ---------------- Toolbar ---------------- */

function ToolbarBtn({ active, onClick, icon: Icon, title, label }) {
 return (
 <button
 type="button"
 title={title}
 aria-label={label || title}
 aria-pressed={active}
 onClick={onClick}
 className={cn(
 'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
 active && 'bg-primary/10 text-primary',
 )}
 >
 <Icon className="h-3.5 w-3.5" aria-hidden />
 </button>
 );
}

function Divider() {
 return <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />;
}

function EditorToolbar({ editor, onAddImage }) {
 const fileRef = useRef(null);
 if (!editor) return null;
 return (
 <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5" role="toolbar" aria-label="Note formatting">
 <ToolbarBtn
 title="Bold (⌘B)"
 label="Bold"
 icon={Bold}
 active={editor.isActive('bold')}
 onClick={() => editor.chain().focus().toggleBold().run()}
 />
 <ToolbarBtn
 title="Italic (⌘I)"
 label="Italic"
 icon={Italic}
 active={editor.isActive('italic')}
 onClick={() => editor.chain().focus().toggleItalic().run()}
 />
 <ToolbarBtn
 title="Underline (⌘U)"
 label="Underline"
 icon={UnderlineIcon}
 active={editor.isActive('underline')}
 onClick={() => editor.chain().focus().toggleUnderline().run()}
 />
 <ToolbarBtn
 title="Strikethrough"
 label="Strikethrough"
 icon={Strikethrough}
 active={editor.isActive('strike')}
 onClick={() => editor.chain().focus().toggleStrike().run()}
 />
 <ToolbarBtn
 title="Highlight"
 label="Highlight"
 icon={Highlighter}
 active={editor.isActive('highlight')}
 onClick={() => editor.chain().focus().toggleHighlight().run()}
 />
 <Divider />
 <ToolbarBtn
 title="Heading 1"
 label="Heading 1"
 icon={Heading1}
 active={editor.isActive('heading', { level: 1 })}
 onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
 />
 <ToolbarBtn
 title="Heading 2"
 label="Heading 2"
 icon={Heading2}
 active={editor.isActive('heading', { level: 2 })}
 onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
 />
 <ToolbarBtn
 title="Heading 3"
 label="Heading 3"
 icon={Heading3}
 active={editor.isActive('heading', { level: 3 })}
 onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
 />
 <Divider />
 <ToolbarBtn
 title="Bullet list"
 label="Bullet list"
 icon={List}
 active={editor.isActive('bulletList')}
 onClick={() => editor.chain().focus().toggleBulletList().run()}
 />
 <ToolbarBtn
 title="Ordered list"
 label="Numbered list"
 icon={ListOrdered}
 active={editor.isActive('orderedList')}
 onClick={() => editor.chain().focus().toggleOrderedList().run()}
 />
 <ToolbarBtn
 title="Blockquote"
 label="Blockquote"
 icon={Quote}
 active={editor.isActive('blockquote')}
 onClick={() => editor.chain().focus().toggleBlockquote().run()}
 />
 <ToolbarBtn
 title="Code block"
 label="Code block"
 icon={Code}
 active={editor.isActive('codeBlock')}
 onClick={() => editor.chain().focus().toggleCodeBlock().run()}
 />
 <Divider />
 <ToolbarBtn
 title="Link"
 label="Insert link"
 icon={LinkIcon}
 active={editor.isActive('link')}
 onClick={() => {
 const url = window.prompt('URL');
 if (url) editor.chain().focus().setLink({ href: url }).run();
 }}
 />
 <button
 type="button"
 title="Insert image"
 aria-label="Insert image"
 onClick={() => fileRef.current?.click()}
 className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
 >
 <ImageIcon className="h-3.5 w-3.5" aria-hidden />
 </button>
 <input
 ref={fileRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (onAddImage) onAddImage(file, editor);
 e.target.value = '';
 }}
 />
 </div>
 );
}

/* ---------------- Slash menu ---------------- */

const SLASH_COMMANDS = [
 {
 title: 'Heading 1',
 icon: Heading1,
 action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
 },
 {
 title: 'Heading 2',
 icon: Heading2,
 action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
 },
 {
 title: 'Heading 3',
 icon: Heading3,
 action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
 },
 {
 title: 'Bullet list',
 icon: List,
 action: (e) => e.chain().focus().toggleBulletList().run(),
 },
 {
 title: 'Numbered list',
 icon: ListOrdered,
 action: (e) => e.chain().focus().toggleOrderedList().run(),
 },
 {
 title: 'Quote',
 icon: Quote,
 action: (e) => e.chain().focus().toggleBlockquote().run(),
 },
 {
 title: 'Code block',
 icon: Code,
 action: (e) => e.chain().focus().toggleCodeBlock().run(),
 },
];

function SlashMenu({ pos, items, activeIdx, onPick }) {
 if (!pos) return null;
 return (
 <div
 role="listbox"
 aria-label="Block commands"
 className="fixed z-50 w-56 overflow-hidden rounded-lg border bg-popover py-1"
 style={{ top: pos.top, left: pos.left }}
 >
 <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" aria-hidden>
 Blocks
 </p>
 {items.map((it, i) => {
 const Icon = it.icon;
 return (
 <button
 key={it.title}
 type="button"
 role="option"
 aria-selected={i === activeIdx}
 onMouseDown={(e) => {
 e.preventDefault();
 onPick(i);
 }}
 className={cn(
 'flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors',
 i === activeIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
 )}
 >
 <Icon className="h-3.5 w-3.5" aria-hidden />
 {it.title}
 </button>
 );
 })}
 </div>
 );
}

/* ---------------- Page ---------------- */

export default function NotesPage() {
 const qc = useQueryClient();
 const [search, setSearch] = useState('');
 const [selectedNotes, setSelectedNotes] = useState(new Set());
 const [activeId, setActiveId] = useState(null);
 const [title, setTitle] = useState('');
 const [isNew, setIsNew] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
 const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
 const [slash, setSlash] = useState({
 open: false,
 query: '',
 pos: null,
 active: 0,
 });
 const editorRef = useRef(null);
 // Refs mirroring the active-note identity so the TipTap editor callbacks
 // (which close over the first render) always read the CURRENT note being
 // edited instead of a stale snapshot. This prevents a save from writing one
 // note's title/content onto another note.
 const activeIdRef = useRef(null);
 const titleRef = useRef('');
 const isNewRef = useRef(false);
 // Tracks unsaved edits so we can flush on blur, note switch, or page exit.
 const dirtyRef = useRef(false);
 // True only once the TipTap editor view has actually mounted (onCreate). The
 // editor object becomes non-null before the view is attached to the DOM, and
 // calling commands (setContent) before mount throws
 //"Cannot access view['dom']... may not be mounted yet".
 const [editorReady, setEditorReady] = useState(false);

 useEffect(() => {
 activeIdRef.current = activeId;
 isNewRef.current = isNew;
 }, [activeId, isNew]);

 useEffect(() => {
 titleRef.current = title;
 }, [title]);

 const { data: notes = [], isLoading } = useQuery({
 queryKey: ['notes'],
 queryFn: notesApi.list,
 });

 const activeNote = useMemo(
 () => notes.find((n) => n.id === activeId) || null,
 [notes, activeId],
 );

 const createMut = useMutation({
 mutationFn: notesApi.create,
onSuccess: (res) => {
 const n = res.data || res;
 qc.invalidateQueries({ queryKey: ['notes'] });
 setActiveId(n.id);
 setIsNew(false);
 setTitle(n.title || '');
 dirtyRef.current = false;
 setSaveState('saved');
 },
 onError: () => {
 dirtyRef.current = true;
 setSaveState('dirty');
 toast.error('Failed to create note');
 },
});

 const updateMut = useMutation({
 mutationFn: ({ id, data }) => notesApi.update(id, data),
onSuccess: (res) => {
 qc.invalidateQueries({ queryKey: ['notes'] });
 dirtyRef.current = false;
 setSaveState('saved');
 const n = res.data || res;
 if (n) setTitle(n.title || '');
 },
 onError: () => {
 dirtyRef.current = true;
 setSaveState('dirty');
 toast.error('Failed to save');
 },
});

 const deleteMut = useMutation({
 mutationFn: notesApi.delete,
 onSuccess: () => {
 toast.success('Note deleted');
 qc.invalidateQueries({ queryKey: ['notes'] });
 setActiveId(null);
 setIsNew(false);
 setTitle('');
 },
 });

  const bulkDeleteMut = useMutation({
  mutationFn: (ids) => notesApi.bulkDelete(ids),
  onSuccess: () => {
  toast.success(`${selectedNotes.size} notes deleted`);
  qc.invalidateQueries({ queryKey: ['notes'] });
  setSelectedNotes(new Set());
  setBulkConfirmOpen(false);
  },
  onError: () => {
  toast.error('Could not delete notes');
  },
  });

 const editor = useEditor({
 extensions: [
 StarterKit,
 Underline,
 TextAlign.configure({ types: ['heading', 'paragraph'] }),
 Highlight.configure({ multicolor: false }),
 Image.configure({ inline: false, allowBase64: true }),
 Link.configure({
 openOnClick: false,
 HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
 }),
 Placeholder.configure({
 placeholder: 'Start writing… Type"/" for commands.',
 }),
 ],
 content: '',
 onCreate: ({ editor: ed }) => {
 setEditorReady(true);
 editorRef.current = ed;
 },
onUpdate: ({ editor: ed }) => {
  // No autosave while typing — mark the note dirty. Persistence happens on
  // blur, explicit save (Save / Ctrl+S), note switch, or page exit so edits
  // are never lost while keystrokes stay uninterrupted.
  setSaveState('dirty');
  dirtyRef.current = true;

  // Slash menu detection
  const { from } = ed.state.selection;
  const textBefore = ed.state.doc.textBetween(
  Math.max(0, from - 30),
  from,
  '\n',
  );
  const slashMatch = textBefore.match(/(?:^|\s)\/([a-zA-Z]*)$/);
  if (slashMatch) {
  const coords = ed.view.coordsAtPos(from);
  setSlash({
  open: true,
  query: slashMatch[1].toLowerCase(),
  pos: { top: coords.bottom + 6, left: coords.left },
  active: 0,
  });
  } else if (slash.open) {
  setSlash({ open: false, query: '', pos: null, active: 0 });
  }
  },
  onBlur: () => {
  if (dirtyRef.current) saveNowRef.current();
  },
 onKeyDown: (_e) => {
 // handle slash nav via wrapper below since we need editor + state
 },
 });

 // Slash menu keyboard handling
 useEffect(() => {
 // The editor view is only available once EditorContent has mounted it
 // (e.g. when a note is selected). Guard against accessing a null view
 // while the notes list is shown or before first mount.
 if (!editor || !editor.view || !editor.view.dom) return;
 const dom = editor.view.dom;
 const handler = (e) => {
 if (!slash.open) return;
 const filtered = SLASH_COMMANDS.filter((c) =>
 c.title.toLowerCase().includes(slash.query),
 );
 if (e.key === 'ArrowDown') {
 e.preventDefault();
 setSlash((s) => ({
 ...s,
 active: Math.min(filtered.length - 1, s.active + 1),
 }));
 } else if (e.key === 'ArrowUp') {
 e.preventDefault();
 setSlash((s) => ({ ...s, active: Math.max(0, s.active - 1) }));
 } else if (e.key === 'Enter') {
 e.preventDefault();
 const cmd = filtered[slash.active];
 if (cmd) {
 // Remove the"/query" text
 const { from } = editor.state.selection;
 const match = editor.state.doc
 .textBetween(Math.max(0, from - 30), from)
 .match(/\/[a-zA-Z]*$/);
 if (match) {
 const start = from - match[0].length;
 editor.chain().focus().deleteRange({ from: start, to: from }).run();
 }
 cmd.action(editor);
 setSlash({ open: false, query: '', pos: null, active: 0 });
 }
 } else if (e.key === 'Escape') {
 setSlash({ open: false, query: '', pos: null, active: 0 });
 }
 };
 dom.addEventListener('keydown', handler);
 return () => dom.removeEventListener('keydown', handler);
 }, [editor, slash]);

// Save a captured snapshot {id, isNew, title, html}. The note identity and
  // its rendered HTML are fixed when the edit happens, so a save can never be
  // written to a different note the user switched to while a timer was pending.
const commitSave = useCallback(
    ({ id, isNew: isNewTarget, title: titleSnapshot, html }) => {
      const finalTitle = (titleSnapshot || '').trim() || 'Untitled';
      const hasTitle = !!(titleSnapshot || '').trim();
      const hasContent = !!html && html !== '<p></p>' && html !== '<p><br></p>';
      // Refuse to create a fully empty note; title-only saves (Ctrl+S with an
      // empty body) must still persist for existing notes.
      if ((isNewTarget || !id) && !hasTitle && !hasContent) {
        setSaveState('dirty');
        return;
      }
      setSaveState('saving');
      if (isNewTarget || !id) {
        createMut.mutate({ title: finalTitle, content: html });
      } else {
        updateMut.mutate({ id, data: { title: finalTitle, content: html } });
      }
    },
    [createMut, updateMut],
  );

  // Always-current references so stale editor callbacks can reach the latest
  // save logic without closing over an old render.
  const commitRef = useRef(commitSave);
  const saveNowRef = useRef(() => {});
  useEffect(() => {
    commitRef.current = commitSave;
    saveNowRef.current = () => {
      commitRef.current({
        id: activeIdRef.current,
        isNew: isNewRef.current,
        title: titleRef.current,
        html: editorRef.current?.getHTML?.() || '',
      });
    };
  });

  // Ctrl/Cmd+S must work wherever focus is. The <form> keydown never fires
  // when focus sits inside the TipTap editor (ProseMirror intercepts keydown),
  // so bind it globally on the window and save through the always-current ref.
  useKeyboardShortcut('mod+s', (e) => {
    e.preventDefault();
    saveNowRef.current();
  });

  // Load active note content into editor.
 //
 // Refs are updated synchronously BEFORE touching the editor so that the
 // editor's onUpdate (which can fire from setContent/clearContent) never
 // reads a stale note identity or a previous note's title. A pending save
 // for the outgoing note is cleared, and the content swap is performed with
 // emitUpdate:false so loading never triggers an autosave.
 // Keep the title input in sync with the currently opened note. Adjusted
 // during render (not in an effect) when the active note identity changes so
 // the editor effect below stays purely an external-system sync.
 const [prevNoteKey, setPrevNoteKey] = useState(null);
 const noteKey = isNew ? '' : (activeNote?.id ?? null);
 if (noteKey !== prevNoteKey) {
 setPrevNoteKey(noteKey);
 setTitle(isNew ? '' : (activeNote?.title || ''));
 }

 useEffect(() => {
 if (!editor || !editorReady) return;
 // Flush any unsaved edits to the note being left before switching.
 if (dirtyRef.current && (isNewRef.current || activeIdRef.current)) {
 commitRef.current({
 id: activeIdRef.current,
 isNew: isNewRef.current,
 title: titleRef.current,
 html: editor.getHTML(),
 });
 dirtyRef.current = false;
 }
 activeIdRef.current = isNew ? null : activeNote?.id ?? null;
 isNewRef.current = isNew;
 const nextTitle = isNew ? '' : activeNote?.title || '';
 titleRef.current = nextTitle;
 if (isNew || !activeNote) {
 editor.commands.setContent('', { emitUpdate: false });
 return;
 }
 editor.commands.setContent(activeNote.content || '', { emitUpdate: false });
 }, [editor, editorReady, activeNote, isNew]);

 // Flush pending edits when leaving the page so nothing typed is lost.
 useEffect(
 () => () => {
 if (dirtyRef.current && (isNewRef.current || activeIdRef.current)) {
 commitRef.current({
 id: activeIdRef.current,
 isNew: isNewRef.current,
 title: titleRef.current,
 html: editorRef.current?.getHTML?.() || '',
 });
 }
 },
 [],
 );

// Image insert (base64 for now; backend persists HTML as-is). Images only,
// capped at 5 MB — anything else would silently bloat the note document.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const addImage = (file, ed) => {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
  toast.error('Only image files can be inserted.');
  return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
  toast.error(`Image exceeds the 5 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
  return;
  }
  const reader = new FileReader();
  reader.onload = (ev) =>
  ed.chain().focus().setImage({ src: ev.target.result }).run();
  reader.readAsDataURL(file);
  };

 const createNew = () => {
 setActiveId(null);
 setIsNew(true);
 setTitle('');
 dirtyRef.current = false;
 setSaveState('idle');
 setTimeout(() => editor?.commands.focus('end'), 30);
 };

 const openNote = (note) => {
 setIsNew(false);
 setActiveId(note.id);
 dirtyRef.current = false;
 setSaveState('idle');
 };

 const saveNow = () => {
 saveNowRef.current();
 };

 const deleteSelected = (note) => {
 setNoteToDelete(note);
 };

 const confirmDelete = () => {
 if (!noteToDelete) return;
 deleteMut.mutate(noteToDelete.id);
 setNoteToDelete(null);
 };

 const toggleSelect = (id) => {
 setSelectedNotes((prev) => {
 const n = new Set(prev);
 if (n.has(id)) n.delete(id);
 else n.add(id);
 return n;
 });
 };

 const filtered = useMemo(() => {
 if (!search.trim()) return notes;
 const q = search.toLowerCase();
 return notes.filter(
 (n) =>
 (n.title || '').toLowerCase().includes(q) ||
 stripHtml(n.content || '')
 .toLowerCase()
 .includes(q),
 );
 }, [notes, search]);

 const preview = (html) => {
 const text = stripHtml(html);
 return text.slice(0, 140) || 'No additional text';
 };

 const displayNote = isNew
 ? { id: 'new', title: title || 'Untitled', content: '' }
 : activeNote;
 const showingEditor = isNew || !!activeNote;

 return (
 <AppShell
 title="Notes"
 description="Capture thoughts, lecture summaries, and personal research. Save with Ctrl+S, save-on-blur, or the Save button."
 actions={
 <Button
 size="sm"
 onClick={createNew}
 className="h-8 gap-1.5 px-3 text-xs"
 >
 <Plus className="h-3.5 w-3.5" aria-hidden /> New note
 </Button>
 }
 >
  <div className="flex h-[calc(100vh-9rem)] gap-0 overflow-hidden rounded-xl border bg-card">
  {/* List — on small screens it yields to the editor with a Back button
  to return, otherwise the editor would be unreachable on mobile. */}
  <aside className={cn('shrink-0 flex-col border-r md:flex md:w-72 lg:w-80', showingEditor ? 'hidden w-full' : 'flex w-full')}>
  <div className="border-b p-3">
 <div className="relative">
 <Search
 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
 aria-hidden
 />
  <Input
  placeholder="Search notes…"
  aria-label="Search notes by title or content"
  className="h-8 pl-8 pr-2 text-xs"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  />
 </div>
 {selectedNotes.size > 0 && (
 <div className="mt-2 flex items-center justify-between rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
 <span>{selectedNotes.size} selected</span>
  <Button
  variant="ghost"
  size="sm"
  className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
  onClick={() => setBulkConfirmOpen(true)}
  disabled={bulkDeleteMut.isPending}
  >
  <Trash2 className="mr-1 h-3 w-3" />
  Delete
  </Button>
 </div>
 )}
 </div>
 <div className="flex-1 overflow-y-auto p-1.5">
 {isLoading ? (
 <div className="space-y-1.5 p-2">
 {Array.from({ length: 5 }).map((_, i) => (
 <div
 key={i}
 className="skeleton h-[60px] rounded-lg"
 style={{ animationDelay: `${i * 60}ms` }}
 />
 ))}
 </div>
 ) : filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
 <StickyNote
 className="mb-2 h-7 w-7 text-muted-foreground/50"
 aria-hidden
 />
 <p className="text-xs font-medium">
 {search ? 'No matching notes' : 'No notes yet'}
 </p>
  <p className="mt-0.5 text-[11px] text-muted-foreground">
  {search
  ? 'Try a different search.'
  : 'Press "New note" to start writing.'}
  </p>
 </div>
 ) : (
 <ul className="space-y-0.5">
  {filtered.map((note) => {
  const isActive = isNew ? false : activeId === note.id;
  const isSelected = selectedNotes.has(note.id);
  return (
  // Checkbox and opener are siblings — a checkbox nested inside the
  // open-note button would be invalid interactive nesting.
  <li key={note.id} className={cn(
  'group flex w-full items-start gap-1 rounded-lg p-1.5 text-left transition-colors',
  isActive ? 'bg-primary/10' : 'hover:bg-muted/60',
  )}>
  <span className="mt-1.5 shrink-0">
  <Checkbox
  checked={isSelected}
  onCheckedChange={() => toggleSelect(note.id)}
  aria-label={`Select note ${note.title || 'Untitled'}`}
  />
  </span>
  <button
  type="button"
  onClick={() => openNote(note)}
  aria-current={isActive ? 'true' : undefined}
  className="min-w-0 flex-1 rounded-sm p-1 text-left focus-visible:outline-2 focus-visible:outline-ring"
  >
  <div className="min-w-0 flex-1">
  <div className="flex items-start justify-between gap-1">
  <p
  className={cn(
  'truncate text-[13px] font-medium',
  isActive && 'text-primary',
  )}
  >
  {note.title || 'Untitled'}
  </p>
  </div>
  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
  {preview(note.content)}
  </p>
  {note.updated_at && (
  <p className="mt-1 text-[10px] text-muted-foreground/70">
  {formatDistanceToNow(new Date(note.updated_at), {
  addSuffix: true,
  })}
  </p>
  )}
  </div>
  </button>
  </li>
  );
  })}
 </ul>
 )}
 </div>
 </aside>

 {/* Editor */}
 <main className="flex min-w-0 flex-1 flex-col">
 {!showingEditor ? (
 <div className="flex h-full flex-col items-center justify-center p-8 text-center">
 <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
 <StickyNote className="h-7 w-7" aria-hidden />
 </span>
 <h3 className="text-base font-semibold">
 Select a note to start
 </h3>
 <p className="mt-1 max-w-sm text-xs text-muted-foreground">
 Choose a note from the list on the left, or create a new one.
 Notes save on blur, on Ctrl+S, or when you switch notes.
 </p>
 <Button
 size="sm"
 onClick={createNew}
 className="mt-5 h-8 gap-1.5 px-4 text-xs"
 >
 <Plus className="h-3.5 w-3.5" /> Create note
 </Button>
 </div>
 ) : (
<form
  onSubmit={(e) => {
    e.preventDefault();
    saveNow();
  }}
  className="flex h-full flex-col"
>
  {/* Header */}
  <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
  <div className="flex min-w-0 flex-1 items-center gap-2">
  <Button
  type="button"
  variant="ghost"
  size="icon"
  className="h-7 w-7 shrink-0 md:hidden"
  aria-label="Back to notes list"
  onClick={() => {
  if (dirtyRef.current) saveNow();
  setIsNew(false);
  setActiveId(null);
  }}
  >
  <ChevronLeft className="h-4 w-4" aria-hidden />
  </Button>
  <FileText
  className="h-4 w-4 shrink-0 text-primary"
  aria-hidden
  />
  <input
  value={title}
  onChange={(e) => {
  setTitle(e.target.value);
  setSaveState('dirty');
  dirtyRef.current = true;
  }}
  onBlur={() => {
  if (dirtyRef.current) saveNow();
  }}
  placeholder="Untitled note"
  aria-label="Note title"
  className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-semibold tracking-tight shadow-none focus-visible:ring-0"
  />
  </div>
<div className="flex shrink-0 items-center gap-2">
        <SaveBadge state={saveState} />
        <Button
          type="submit"
          size="sm"
          className="h-7 gap-1.5 px-3 text-xs"
          disabled={saveState === 'saving'}
        >
          {saveState === 'saving' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden />
          )}
          {saveState === 'saving' ? 'Saving…' : isNew ? 'Create' : 'Save'}
        </Button>
        {!isNew && displayNote && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Note options">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={() => deleteSelected(displayNote)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>

 <EditorToolbar editor={editor} onAddImage={addImage} />

 <div className="min-h-0 flex-1 overflow-y-auto">
 <div className="mx-auto w-full max-w-3xl px-5 py-6 pb-24 focus:outline-none prose-academic">
 <EditorContent editor={editor} className="min-h-full" />
 </div>
 </div>
 </form>
 )}
 </main>
 </div>

 <SlashMenu
 pos={slash.pos}
 items={SLASH_COMMANDS.filter((c) =>
 c.title.toLowerCase().includes(slash.query),
 )}
 activeIdx={slash.active}
 onPick={(i) => {
 const filtered = SLASH_COMMANDS.filter((c) =>
 c.title.toLowerCase().includes(slash.query),
 );
 const cmd = filtered[i];
 if (!cmd) return;
 const { from } = editor.state.selection;
 const match = editor.state.doc
 .textBetween(Math.max(0, from - 30), from)
 .match(/\/[a-zA-Z]*$/);
 if (match) {
 const start = from - match[0].length;
 editor.chain().focus().deleteRange({ from: start, to: from }).run();
 }
  cmd.action(editor);
  setSlash({ open: false, query: '', pos: null, active: 0 });
  }}
   />

  <ConfirmDialog
    open={!!noteToDelete}
    title="Delete note"
    description={noteToDelete ? `Delete “${noteToDelete.title || 'Untitled'}”? This cannot be undone.` : ''}
    onConfirm={confirmDelete}
    onCancel={() => setNoteToDelete(null)}
    confirmLabel="Delete"
    destructive
  />
  <ConfirmDialog
    open={bulkConfirmOpen}
    title={`Delete ${selectedNotes.size} note${selectedNotes.size === 1 ? '' : 's'}?`}
    description="The selected notes will be permanently deleted. This cannot be undone."
    onConfirm={() => bulkDeleteMut.mutate(Array.from(selectedNotes))}
    onCancel={() => setBulkConfirmOpen(false)}
    confirmLabel="Delete all"
    destructive
    pending={bulkDeleteMut.isPending}
  />
  </AppShell>
  );
}

function SaveBadge({ state }) {
 if (state === 'saving') {
 return (
 <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
 <Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving
 </span>
 );
 }
 if (state === 'dirty') {
 return (
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warn)]">
 <Pencil className="h-2.5 w-2.5" /> Unsaved
 </span>
 );
 }
 if (state === 'saved') {
 return (
 <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
 <Check className="h-2.5 w-2.5" /> Saved
 </span>
 );
 }
 return null;
}

function stripHtml(html) {
 if (typeof document === 'undefined' || !html) return '';
 const tmp = document.createElement('DIV');
 tmp.innerHTML = html;
 return (tmp.textContent || tmp.innerText || '').trim();
}
