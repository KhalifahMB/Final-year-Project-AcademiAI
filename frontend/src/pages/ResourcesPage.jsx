import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ResourcesPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data } = await api.get("/resources/");
      return data.results || data;
    },
  });

  const createMut = useMutation({
    mutationFn: (payload) => api.post("/resources/", payload),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (err) => setError(err.response?.data?.error?.detail || "Create failed"),
  });

  const uploadMut = useMutation({
    mutationFn: (id) => api.post(`/resources/${id}/request_upload_url/`, { content_type: "text/plain" }),
    onSuccess: (res) => {
      alert(`Upload URL ready.\nKey: ${res.data.storage_key}\nPUT the file to upload_url, then call complete_upload.`);
    },
    onError: (err) => setError(err.response?.data?.error?.detail || "Upload URL failed"),
  });

  return (
    <AppShell title="Resources">
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (title.trim()) createMut.mutate({ title: title.trim(), description: "" });
        }}
      >
        <Input placeholder="New resource title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Resource title" />
        <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "…" : "Create"}</Button>
      </form>
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{String(error)}</AlertDescription></Alert>}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {(data || []).map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="secondary">{r.processing_status}</Badge>
                    <Badge variant="outline">{r.visibility_scope}</Badge>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => uploadMut.mutate(r.id)} disabled={uploadMut.isPending}>
                  Get upload URL
                </Button>
              </CardContent>
            </Card>
          ))}
          {(data || []).length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No resources yet.</p>}
        </ul>
      )}
    </AppShell>
  );
}
