import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notesApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  StickyNote,
  Plus,
  Trash2,
  Search,
  Bold,
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  ImageIcon,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Tiptap
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';

// Using the same note validation for title, but accepting HTML for content
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

function ToolbarBtn({ active, onClick, icon: Icon, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors',
        active && 'bg-muted text-foreground font-semibold',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function EditorToolbar({ editor }) {
  const fileInputRef = useRef(null);

  if (!editor) return null;

  const addImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        editor.chain().focus().setImage({ src: event.target.result }).run();
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-2 bg-muted/30 sticky top-0 z-10">
      <ToolbarBtn
        title="Bold"
        icon={Bold}
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarBtn
        title="Italic"
        icon={Italic}
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarBtn
        title="Underline"
        icon={UnderlineIcon}
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarBtn
        title="Strikethrough"
        icon={Strikethrough}
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <div className="w-px h-5 bg-border mx-1" />
      <ToolbarBtn
        title="Heading 1"
        icon={Heading1}
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarBtn
        title="Heading 2"
        icon={Heading2}
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarBtn
        title="Heading 3"
        icon={Heading3}
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <div className="w-px h-5 bg-border mx-1" />
      <ToolbarBtn
        title="Bullet List"
        icon={List}
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarBtn
        title="Ordered List"
        icon={ListOrdered}
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <div className="w-px h-5 bg-border mx-1" />
      <ToolbarBtn
        title="Blockquote"
        icon={Quote}
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarBtn
        title="Code Block"
        icon={Code}
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <div className="w-px h-5 bg-border mx-1" />
      <ToolbarBtn
        title="Align Left"
        icon={AlignLeft}
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      />
      <ToolbarBtn
        title="Align Center"
        icon={AlignCenter}
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      />
      <ToolbarBtn
        title="Align Right"
        icon={AlignRight}
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      />
      <div className="w-px h-5 bg-border mx-1" />
      <ToolbarBtn
        title="Highlight"
        icon={Highlighter}
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      />
      <div className="w-px h-5 bg-border mx-1" />
      <button
        type="button"
        title="Insert Image"
        onClick={() => fileInputRef.current?.click()}
        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
      >
        <ImageIcon className="h-4 w-4" />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={addImage}
      />
    </div>
  );
}

export default function NotesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [activeNote, setActiveNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const {
    data: notes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['notes'],
    queryFn: notesApi.list,
  });

  const create = useMutation({
    mutationFn: notesApi.create,
    onSuccess: (newNote) => {
      toast.success('Note created');
      qc.invalidateQueries({ queryKey: ['notes'] });
      setActiveNote(newNote.data || newNote);
      setIsEditing(false);
    },
    onError: () => toast.error('Failed to create note'),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => notesApi.update(id, data),
    onSuccess: (updatedNote) => {
      toast.success('Note updated');
      qc.invalidateQueries({ queryKey: ['notes'] });
      setActiveNote(updatedNote.data || updatedNote);
      setIsEditing(false);
    },
    onError: () => toast.error('Failed to update note'),
  });

  const remove = useMutation({
    mutationFn: notesApi.delete,
    onSuccess: () => {
      toast.success('Note deleted');
      qc.invalidateQueries({ queryKey: ['notes'] });
      setActiveNote(null);
    },
  });

  const bulkRemove = useMutation({
    mutationFn: (ids) => notesApi.bulkDelete(ids),
    onSuccess: () => {
      toast.success(`${selectedNotes.size} notes deleted`);
      qc.invalidateQueries({ queryKey: ['notes'] });
      setSelectedNotes(new Set());
      setActiveNote(null);
    },
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', content: '' },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({ placeholder: 'Write something brilliant...' }),
    ],
    content: form.getValues('content'),
    onUpdate: ({ editor }) => {
      form.setValue('content', editor.getHTML(), { shouldValidate: true });
    },
  });

  useEffect(() => {
    if (editor && isEditing) {
      editor.commands.setContent(form.getValues('content'));
    }
  }, [isEditing, editor, form]);

  // Filtering
  const filteredNotes = (notes || []).filter(
    (n) =>
      n.title?.toLowerCase().includes(search.toLowerCase()) ||
      n.content?.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (id) => {
    const next = new Set(selectedNotes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedNotes(next);
  };

  const handleCreateNew = () => {
    setActiveNote(null);
    setIsEditing(true);
    form.reset({ title: '', content: '' });
    if (editor) editor.commands.setContent('');
  };

  const handleEdit = () => {
    if (!activeNote) return;
    setIsEditing(true);
    form.reset({ title: activeNote.title, content: activeNote.content });
    if (editor) editor.commands.setContent(activeNote.content);
  };

  const onSubmit = (data) => {
    if (activeNote?.id) {
      update.mutate({ id: activeNote.id, data });
    } else {
      create.mutate(data);
    }
  };

  // Utility to extract raw text for preview
  const stripHtml = (html) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <AppShell
      title="Notes"
      description="Capture thoughts, lecture summaries, and personal research."
    >
      <div className="flex h-[calc(100vh-12rem)] flex-col md:flex-row gap-4 overflow-hidden">
        {/* LEFT PANE: LIST */}
        <aside className="flex w-full md:w-80 shrink-0 flex-col overflow-hidden rounded-xl card-surface">
          <div className="border-b p-3 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  className="pl-8 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateNew}
                size="icon"
                className="h-9 w-9 shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Bulk Actions */}
            {selectedNotes.size > 0 && (
              <div className="flex items-center justify-between rounded-md bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
                <span>{selectedNotes.size} selected</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-destructive hover:bg-destructive/20 hover:text-destructive"
                  onClick={() => bulkRemove.mutate(Array.from(selectedNotes))}
                  disabled={bulkRemove.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading notes...
              </div>
            ) : error ? (
              <div className="p-4 text-center text-sm text-destructive">
                Failed to load notes.
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 text-center">
                <StickyNote className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium">No notes found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first note above.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredNotes.map((note) => {
                  const isActive = activeNote?.id === note.id && !isEditing;
                  const isSelected = selectedNotes.has(note.id);
                  return (
                    <li
                      key={note.id}
                      className={cn(
                        'group flex cursor-pointer items-start gap-3 rounded-lg p-3 text-left transition-colors',
                        isActive ? 'bg-primary/10' : 'hover:bg-muted/50',
                      )}
                      onClick={() => {
                        setActiveNote(note);
                        setIsEditing(false);
                      }}
                    >
                      <div
                        className="mt-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(note.id)}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4
                          className={cn(
                            'truncate text-sm font-medium',
                            isActive && 'text-primary',
                          )}
                        >
                          {note.title || 'Untitled'}
                        </h4>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {stripHtml(note.content)}
                        </p>
                        {note.created_at && (
                          <p className="mt-1.5 text-[10px] text-muted-foreground/75 font-medium">
                            {format(new Date(note.created_at), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* RIGHT PANE: VIEWER/EDITOR */}
        <main className="flex-1 overflow-hidden rounded-xl card-surface flex flex-col relative">
          {!activeNote && !isEditing ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-8">
              <div className="rounded-full bg-primary/10 p-4 mb-4 text-primary">
                <StickyNote className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold">No note selected</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Select a note from the list on the left to view its contents, or
                create a new one.
              </p>
              <Button onClick={handleCreateNew} className="mt-6">
                <Plus className="mr-2 h-4 w-4" /> Create Note
              </Button>
            </div>
          ) : isEditing ? (
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex h-full flex-col"
            >
              <div className="flex items-center justify-between border-b p-3">
                <Input
                  placeholder="Note title..."
                  className="text-lg font-semibold border-0 focus-visible:ring-0 shadow-none px-2 h-10 w-full"
                  {...form.register('title')}
                />
                <div className="flex items-center gap-2 px-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (activeNote) setIsEditing(false);
                      else setActiveNote(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={create.isPending || update.isPending}
                  >
                    {activeNote ? 'Update' : 'Save'}
                  </Button>
                </div>
              </div>
              <EditorToolbar editor={editor} />
              <div className="flex-1 overflow-y-auto cursor-text p-5 pb-20 prose prose-sm dark:prose-invert max-w-none prose-img:rounded-md prose-img:border prose-pre:bg-muted prose-pre:text-foreground focus:outline-none">
                <EditorContent editor={editor} className="min-h-full" />
              </div>
            </form>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between border-b p-5">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">
                    {activeNote.title}
                  </h2>
                  {activeNote.created_at && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Created on{' '}
                      {format(new Date(activeNote.created_at), 'PPP')}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 -mr-2"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleEdit}>
                      Edit note
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Are you sure you want to delete this note?',
                          )
                        ) {
                          remove.mutate(activeNote.id);
                        }
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex-1 overflow-y-auto p-5 pb-20 prose prose-sm dark:prose-invert max-w-none prose-img:rounded-md prose-img:border prose-pre:bg-muted prose-pre:text-foreground">
                <div dangerouslySetInnerHTML={{ __html: activeNote.content }} />
              </div>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
