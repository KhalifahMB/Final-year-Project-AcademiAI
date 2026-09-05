import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import EntityDialog from '@/components/shared/EntityDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/shared/EmptyState';
import SkeletonRows from '@/components/shared/SkeletonRows';
import { BookOpen, ChevronRight, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const toList = (d) => d?.results || d || [];

const errText = (err, fallback) =>
  err?.response?.data?.error?.detail ||
  err?.response?.data?.detail ||
  fallback;

export default function AdminCoursesPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [modalError, setModalError] = useState('');

  const coursesQ = useQuery({
    queryKey: ['courses'],
    queryFn: async () => toList((await api.get('/courses/?page_size=200')).data),
  });

  const deptQ = useQuery({
    queryKey: ['departments'],
    queryFn: async () => toList((await api.get('/departments/?page_size=200')).data),
    staleTime: 60_000,
  });

  const deptName = (id) => (deptQ.data || []).find((d) => d.id === id)?.name || '—';

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['courses'] });
    qc.invalidateQueries({ queryKey: ['course-offerings', 'catalogue'] });
  };

  const createCourse = useMutation({
    mutationFn: (payload) => api.post('/courses/', payload),
    onSuccess: () => {
      toast.success('Course created');
      setAddOpen(false);
      setModalError('');
      invalidate();
    },
    onError: (e) => setModalError(errText(e, 'Could not create course')),
  });

  return (
    <AppShell
      title="Courses"
      description="All courses in your institution. Add a course or click one to manage its offerings, enrollments and lecturers."
      actions={
        <Button type="button" size="sm" className="shadow-sm" onClick={() => { setModalError(''); setAddOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add course
        </Button>
      }
    >
      <Card>
        <CardContent className="p-0">
          {coursesQ.isLoading ? (
            <div className="p-4"><SkeletonRows rows={4} /></div>
          ) : coursesQ.error ? (
            <div className="p-4">
              <Alert variant="destructive" role="alert">
                <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
                  <span>Failed to load courses</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => coursesQ.refetch()} className="h-7 shrink-0 text-[11px]">
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : (coursesQ.data || []).length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={BookOpen}
                title="No courses yet"
                description="Add your first course — then create an offering and assign lecturers for it."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {(coursesQ.data || []).map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/admin/courses/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      <BookOpen className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-primary">
                          {c.code || '—'}
                        </span>
                        <span className="truncate">{c.title}</span>
                        {c.credit_unit ? (
                          <span className="text-[10px] font-normal text-muted-foreground">{c.credit_unit} CU</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.department ? deptName(c.department) : '—'}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">{c.status || 'active'}</Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <EntityDialog
        open={addOpen}
        title="Add course"
        fields={[
          {
            name: 'department', label: 'Department', type: 'select', required: true,
            options: (deptQ.data || []).map((d) => ({
              value: d.id, label: `${d.code ? `${d.code} — ` : ''}${d.name}`,
            })),
          },
          { name: 'code', label: 'Course code', required: true, placeholder: 'CS101' },
          { name: 'title', label: 'Title', required: true, placeholder: 'Introduction to Computing' },
          { name: 'credit_unit', label: 'Credit units', type: 'number', defaultValue: 3 },
          { name: 'description', label: 'Description', type: 'textarea' },
        ]}
        pending={createCourse.isPending}
        error={modalError}
        onClose={() => setAddOpen(false)}
        onSubmit={(payload) => createCourse.mutate(payload)}
      />
    </AppShell>
  );
}