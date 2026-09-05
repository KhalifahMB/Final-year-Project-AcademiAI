import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import EntityDialog from "@/components/shared/EntityDialog";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";

const PRIORITY_STYLES = {
  info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/25",
  warning: "bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/25",
  critical: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/25",
};

function PriorityBadge({ priority }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${PRIORITY_STYLES[priority] || "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]"}`}>
      {priority}
    </span>
  );
}

const errText = (e, fallback) =>
  e?.response?.data?.error?.detail ||
  e?.response?.data?.detail ||
  (typeof e?.response?.data === "object"
    ? Object.values(e.response.data).flat().join(" ")
    : "") ||
  fallback;

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [modalError, setModalError] = useState("");

  const announcementsQ = useQuery({
    queryKey: ["platform-announcements"],
    queryFn: async () => {
      const { data } = await platformApi.announcements.list();
      return data?.results || data || [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-announcements"] });
  };

  const createAnnouncement = useMutation({
    mutationFn: (payload) => platformApi.announcements.create(payload),
    onSuccess: () => {
      toast.success("Announcement created");
      setAddOpen(false);
      setModalError("");
      invalidate();
    },
    onError: (e) => setModalError(errText(e, "Could not create announcement")),
  });

  const updateAnnouncement = useMutation({
    mutationFn: ({ id, ...payload }) => platformApi.announcements.update(id, payload),
    onSuccess: () => {
      toast.success("Announcement updated");
      setEditItem(null);
      setModalError("");
      invalidate();
    },
    onError: (e) => setModalError(errText(e, "Update failed")),
  });

  const deleteAnnouncement = useMutation({
    mutationFn: (id) => platformApi.announcements.delete(id),
    onSuccess: () => {
      toast.success("Announcement deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(errText(e, "Delete failed")),
  });

  const announcements = announcementsQ.data || [];

  return (
    <AppShell
      title="Announcements"
      description="Send messages and notifications to tenants across the platform."
      actions={
        <Button type="button" className="shadow-sm" onClick={() => { setModalError(""); setAddOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          New Announcement
        </Button>
      }
    >
      <Alert className="mb-4">
        <AlertDescription>
          Announcements are delivered by email. Warning and Critical ("important") announcements are emailed to all targeted users and cannot be unsubscribed; Info announcements are emailed unless a user opts out in Settings.
        </AlertDescription>
      </Alert>

      {announcementsQ.isLoading ? (
        <SkeletonRows rows={4} />
      ) : announcementsQ.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
            <span>Failed to load announcements.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => announcementsQ.refetch()} className="h-7 shrink-0 text-[11px]">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Create your first platform announcement to notify tenants about updates, maintenance, or important information."
          action="Create announcement"
          onAction={() => { setModalError(""); setAddOpen(true); }}
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {a.title}
                      <PriorityBadge priority={a.priority} />
                      {!a.is_active && (
                        <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                      )}
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Target: {a.target === "all" ? "All tenants" : `${a.target_tenants?.length || 0} specific tenants`}
                      {a.created_by_email && ` · Created by ${a.created_by_email}`}
                      {a.created_at && ` · ${new Date(a.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit announcement ${a.title || ''}`}
                      title="Edit"
                      onClick={() => { setModalError(""); setEditItem(a); }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete announcement ${a.title || ''}`}
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(a)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Dialog ─────────────────────────────────────── */}
      <EntityDialog
        open={addOpen}
        title="New announcement"
        fields={[
          { name: "title", label: "Title", required: true, placeholder: "e.g. Scheduled maintenance on Sunday" },
          { name: "body", label: "Message", type: "textarea", required: true, placeholder: "Describe the announcement..." },
          { name: "priority", label: "Priority", type: "select", options: [
            { value: "info", label: "Info" },
            { value: "warning", label: "Warning" },
            { value: "critical", label: "Critical" },
          ]},
          { name: "target", label: "Target", type: "select", options: [
            { value: "all", label: "All Tenants" },
            { value: "specific", label: "Specific Tenants" },
          ]},
        ]}
        initial={{ priority: "info", target: "all" }}
        pending={createAnnouncement.isPending}
        error={modalError}
        onClose={() => { setAddOpen(false); setModalError(""); }}
        onSubmit={(payload) => createAnnouncement.mutate(payload)}
      />

      {/* ── Edit Dialog ───────────────────────────────────────── */}
      <EntityDialog
        open={!!editItem}
        title={`Edit — ${editItem?.title || ""}`}
        fields={[
          { name: "title", label: "Title", required: true },
          { name: "body", label: "Message", type: "textarea", required: true },
          { name: "priority", label: "Priority", type: "select", options: [
            { value: "info", label: "Info" },
            { value: "warning", label: "Warning" },
            { value: "critical", label: "Critical" },
          ]},
          { name: "target", label: "Target", type: "select", options: [
            { value: "all", label: "All Tenants" },
            { value: "specific", label: "Specific Tenants" },
          ]},
          { name: "is_active", label: "Active", type: "select", options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]},
        ]}
        initial={editItem ? {
          title: editItem.title,
          body: editItem.body,
          priority: editItem.priority,
          target: editItem.target,
          is_active: String(editItem.is_active),
        } : {}}
        pending={updateAnnouncement.isPending}
        error={modalError}
        onClose={() => { setEditItem(null); setModalError(""); }}
        onSubmit={(payload) => {
          payload.is_active = payload.is_active === "true";
          updateAnnouncement.mutate({ id: editItem.id, ...payload });
        }}
      />

      {/* ── Delete Confirmation ───────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.title}"?`}
        description="This announcement will be permanently removed. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        icon={Trash2}
        onConfirm={() => deleteAnnouncement.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        pending={deleteAnnouncement.isPending}
      />
    </AppShell>
  );
}
