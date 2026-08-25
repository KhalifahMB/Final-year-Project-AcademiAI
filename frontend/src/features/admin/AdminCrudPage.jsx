import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

function useSelectOptions(fields) {
  const faculties = useQuery({
    queryKey: ['opts', '/faculties/'],
    queryFn: async () => {
      const { data } = await api.get('/faculties/');
      return data.results || data;
    },
    enabled: fields.some((f) => f.optionsPath === '/faculties/'),
  });
  const departments = useQuery({
    queryKey: ['opts', '/departments/'],
    queryFn: async () => {
      const { data } = await api.get('/departments/');
      return data.results || data;
    },
    enabled: fields.some((f) => f.optionsPath === '/departments/'),
  });
  const courses = useQuery({
    queryKey: ['opts', '/courses/'],
    queryFn: async () => {
      const { data } = await api.get('/courses/');
      return data.results || data;
    },
    enabled: fields.some((f) => f.optionsPath === '/courses/'),
  });
  const sessions = useQuery({
    queryKey: ['opts', '/academic-sessions/'],
    queryFn: async () => {
      const { data } = await api.get('/academic-sessions/');
      return data.results || data;
    },
    enabled: fields.some((f) => f.optionsPath === '/academic-sessions/'),
  });
  const semesters = useQuery({
    queryKey: ['opts', '/semesters/'],
    queryFn: async () => {
      const { data } = await api.get('/semesters/');
      return data.results || data;
    },
    enabled: fields.some((f) => f.optionsPath === '/semesters/'),
  });
  const offerings = useQuery({
    queryKey: ['opts', '/course-offerings/'],
    queryFn: async () => {
      const { data } = await api.get('/course-offerings/');
      return data.results || data;
    },
    enabled: fields.some((f) => f.optionsPath === '/course-offerings/'),
  });
  const users = useQuery({
    queryKey: ['opts', '/auth/users/'],
    queryFn: async () => {
      const { data } = await api.get('/auth/users/');
      return data.results || data;
    },
    enabled: fields.some((f) => f.optionsPath === '/auth/users/'),
  });
  return {
    '/faculties/': faculties.data || [],
    '/departments/': departments.data || [],
    '/courses/': courses.data || [],
    '/academic-sessions/': sessions.data || [],
    '/semesters/': semesters.data || [],
    '/course-offerings/': offerings.data || [],
    '/auth/users/': users.data || [],
  };
}

function FieldInput({ f, field, optionsMap }) {
  if (f.type === 'textarea') return <Textarea {...field} />;
  if (f.type === 'select') {
    const opts = f.options || optionsMap[f.optionsPath] || [];
    return (
      <Select value={field.value || undefined} onValueChange={field.onChange}>
        <SelectTrigger>
          <SelectValue placeholder={f.label} />
        </SelectTrigger>
        <SelectContent>
          {opts.map((opt) => {
            const val = String(opt.id || opt.value);
            const lab =
              opt.name ||
              opt.code ||
              opt.email ||
              (opt.code && opt.title ? `${opt.code} — ${opt.title}` : null) ||
              opt.label ||
              val;
            return (
              <SelectItem key={val} value={val}>
                {lab}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }
  return <Input type={f.type || 'text'} {...field} />;
}

export default function AdminCrudPage({
  title,
  endpoint,
  queryKey,
  schema,
  fields,
  columns,
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const optionsMap = useSelectOptions(fields);

  const list = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data } = await api.get(endpoint);
      return data.results || data;
    },
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, f.defaultValue ?? '']),
    ),
  });

  const openCreate = () => {
    setEditing(null);
    setError('');
    form.reset(
      Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ''])),
    );
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setError('');
    const values = {};
    fields.forEach((f) => {
      const v = item[f.name];
      values[f.name] = v == null ? '' : String(v);
    });
    form.reset(values);
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: (payload) =>
      editing
        ? api.patch(`${endpoint}${editing.id}/`, payload)
        : api.post(endpoint, payload),
    onSuccess: () => {
      toast.success(editing ? 'Updated' : 'Created');
      setOpen(false);
      setEditing(null);
      form.reset();
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err) => {
      const d =
        err.response?.data?.error?.detail ||
        err.response?.data?.detail ||
        'Save failed';
      setError(typeof d === 'string' ? d : JSON.stringify(d));
      toast.error('Save failed');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`${endpoint}${id}/`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: () => toast.error('Delete failed'),
  });

  const onSubmit = (values) => {
    setError('');
    const payload = { ...values };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') delete payload[k];
    });
    saveMut.mutate(payload);
  };

  return (
    <AppShell
      title={title}
      description={`Create, update and remove ${title.toLowerCase()} records for your institution.`}
      actions={
        <Button type="button" onClick={openCreate} className="h-9 shadow-sm">
          New record
        </Button>
      }
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit record' : 'New record'}</DialogTitle>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              {fields.map((f) => (
                <FormField
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{f.label}</FormLabel>
                      <FormControl>
                        <FieldInput
                          f={f}
                          field={field}
                          optionsMap={optionsMap}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <DialogFooter>
                <Button type="submit" disabled={saveMut.isPending} className="shadow-sm">
                  {saveMut.isPending ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {list.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Failed to load</AlertDescription>
        </Alert>
      )}
      {list.isLoading ? (
        <div className="space-y-2.5" role="status" aria-label="Loading">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {columns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
                <TableHead className="w-[150px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data || []).map((item) => (
                <TableRow key={item.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="py-3.5">
                      {String(item[c.key] ?? '')}
                    </TableCell>
                  ))}
                  <TableCell className="space-x-1 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Delete this record?'))
                          deleteMut.mutate(item.id);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(list.data || []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No records yet — create the first one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
