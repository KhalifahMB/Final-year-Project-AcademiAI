import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/shared/StatusBadge";
import SkeletonRows from "@/components/shared/SkeletonRows";
import EmptyState from "@/components/shared/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { UsersRound } from "lucide-react";

const ROLE_STYLES = {
  admin: "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25",
  lecturer: "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25",
  student: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
};

function RoleBadge({ role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        ROLE_STYLES[role] || "bg-muted text-muted-foreground border-border"
      }`}
    >
      {role}
    </span>
  );
}

export default function AdminUsersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await api.get("/auth/users/");
      return data.results || data;
    },
  });

  const users = data || [];

  return (
    <AppShell
      title="Users"
      description="Accounts in your institution — roles and activation status."
    >
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>Admin access required or request failed</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No users yet"
          description="Users appear here once they sign up with your institution slug."
        />
      ) : (
        <div className="overflow-hidden rounded-xl card-surface">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="py-3.5 pl-5 font-medium">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell className="pr-5">
                    <StatusBadge status={u.is_active ? "active" : "archived"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
