import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import SkeletonRows from '@/components/shared/SkeletonRows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Check, XCircle, Mail, User, Phone, Users } from 'lucide-react';

function timeAgo(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const STATUS_STYLES = {
  pending: 'bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/30',
  approved: 'bg-[var(--success)]/15 text-[var(--success)]  border-[var(--success)]/30',
  rejected: 'bg-[var(--danger)]/15 text-red-700 dark:text-red-400 border-red-500/30',
};

export default function PlatformRequestsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [reviewId, setReviewId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewPlan, setReviewPlan] = useState('standard');

  const reqsQ = useQuery({
    queryKey: ['platform-tenant-requests', filter],
    queryFn: async () => {
      const params = filter === 'all' ? {} : { status: filter };
      const { data } = await platformApi.tenantRequests.list(params);
      return data.results || [];
    },
    staleTime: 10_000,
  });

  const review = useMutation({
    mutationFn: ({ id, action }) => platformApi.tenantRequests.review(id, {
      action, review_notes: reviewNotes, plan: reviewPlan,
    }),
    onSuccess: (_d, vars) => {
      toast.success(vars.action === 'approve' ? 'Institution approved and provisioned' : 'Request rejected');
      setReviewId(null);
      setReviewNotes('');
      qc.invalidateQueries({ queryKey: ['platform-tenant-requests'] });
      qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error?.detail || 'Action failed'),
  });

  const list = reqsQ.data || [];
  const reviewing = list.find((r) => r.id === reviewId);

  return (
    <AppShell
      title="Institution requests"
      description="Review and approve self-serve sign-up requests from new institutions."
    >
      <div className="mb-4 flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All requests</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{list.length} request(s)</p>
      </div>

      {reqsQ.isLoading ? (
        <SkeletonRows rows={5} />
      ) : reqsQ.error ? (
        <Alert variant="destructive"><AlertDescription>Failed to load requests.</AlertDescription></Alert>
      ) : list.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          {filter === 'pending' ? 'No pending requests. Great job!' : 'No requests to show.'}
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-primary" />
                    {r.institution_name}
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {timeAgo(r.created_at)} · {r.institution_type} {r.institution_domain && `· ${r.institution_domain}`}
                  </p>
                </div>
                {r.status === 'pending' && !reviewing && (
                  <Button size="sm" onClick={() => setReviewId(r.id)}>Review</Button>
                )}
                {r.provisioned_tenant_name && (
                  <span className="text-xs text-[var(--success)] font-medium">Provisioned: {r.provisioned_tenant_name}</span>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /><span className="text-foreground">{r.requester_name}</span></div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /><span className="truncate text-foreground">{r.requester_email}</span></div>
                  {r.requester_role && <div className="flex items-center gap-2 text-muted-foreground"><span className="text-foreground">{r.requester_role}</span></div>}
                  {r.phone_number && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /><span className="text-foreground">{r.phone_number}</span></div>}
                  {r.estimated_students && <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="text-foreground">{r.estimated_students.toLocaleString()} students</span></div>}
                </div>
                {r.notes && (
                  <div className="rounded-md bg-muted/40 p-3 text-sm">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                    {r.notes}
                  </div>
                )}
                {reviewing?.id === r.id && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium">Plan</label>
                        <Select value={reviewPlan} onValueChange={setReviewPlan}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Review notes (optional)</label>
                      <Textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Reason for decision, plan limits, next steps…" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setReviewId(null)}>Cancel</Button>
                      <Button size="sm" variant="destructive" onClick={() => review.mutate({ id: r.id, action: 'reject' })} disabled={review.isPending}>
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => review.mutate({ id: r.id, action: 'approve' })} disabled={review.isPending}>
                        <Check className="mr-1 h-4 w-4" /> Approve & provision
                      </Button>
                    </div>
                  </div>
                )}
                {r.review_notes && r.status !== 'pending' && (
                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground mb-1">Review notes</p>
                    {r.review_notes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
