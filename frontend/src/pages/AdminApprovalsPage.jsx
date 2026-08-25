import AppShell from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, UserCog } from "lucide-react";

const COMING_SOON = (
  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
    <Clock className="h-3 w-3" aria-hidden /> Coming soon
  </span>
);

const MOCK_QUEUE = [
  {
    id: "1",
    user: "a.ibe@example.edu",
    requested: "Lecturer",
    department: "Computer Science",
    status: "Pending review",
  },
  {
    id: "2",
    user: "j.sani@example.edu",
    requested: "Admin",
    department: "Mathematics",
    status: "Awaiting documents",
  },
];

/**
 * Role-elevation approval workflow — full interface scaffold. The backing
 * request/approve API is a documented future implementation; every action
 * is disabled until then.
 */
export default function AdminApprovalsPage() {
  return (
    <AppShell
      title="Approvals"
      description="Review role-elevation requests (student → lecturer, lecturer → admin) before granting elevated access."
      actions={COMING_SOON}
    >
      <Alert className="mb-5">
        <UserCog className="h-4 w-4" />
        <AlertDescription>
          Today, lecturers sign up directly and admins are promoted from the
          Users page. This queue will let members request elevation and let
          tenant admins approve or reject with an audit trail.
        </AlertDescription>
      </Alert>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Requester</TableHead>
              <TableHead>Requested role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[180px] text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_QUEUE.map((r) => (
              <TableRow key={r.id} className="opacity-60">
                <TableCell className="py-3.5 font-medium">{r.user}</TableCell>
                <TableCell>{r.requested}</TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button type="button" size="sm" disabled title="Coming soon">
                    Approve
                  </Button>
                  <Button
                    type="button" variant="outline" size="sm" disabled
                    title="Coming soon"
                  >
                    Reject
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Planned flow: member submits a request with justification → tenant
        admin approves/rejects here → decision is audited and the requester is
        notified by email. See docs/FUTURE_IMPLEMENTATIONS.md.
      </p>
    </AppShell>
  );
}
