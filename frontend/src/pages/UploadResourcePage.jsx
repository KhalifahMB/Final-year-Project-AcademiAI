import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UploadResourcePage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const upload = useMutation({
    mutationFn: async () => {
      const { data: resource } = await api.post("/resources/", { title: title || file?.name || "Upload", description: "" });
      const contentType = file?.type || "text/plain";
      const { data: presign } = await api.post(`/resources/${resource.id}/request_upload_url/`, { content_type: contentType });
      if (file && presign.upload_url) {
        await fetch(presign.upload_url, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
        await api.post(`/resources/${resource.id}/complete_upload/`, { storage_key: presign.storage_key });
      }
      return resource;
    },
    onSuccess: () => {
      setStatus("Upload complete; ingestion queued.");
      setTitle("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (e) => setError(e.response?.data?.error?.detail || e.message || "Upload failed"),
  });

  return (
    <AppShell title="Upload resource">
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-lg">New resource</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{String(error)}</AlertDescription></Alert>}
          {status && <Alert variant="success"><AlertDescription>{status}</AlertDescription></Alert>}
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="file">File (text/PDF)</Label>
            <Input id="file" type="file" accept=".txt,.md,.pdf,.json" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <Button type="button" disabled={upload.isPending || !file} onClick={() => { setError(""); setStatus(""); upload.mutate(); }}>
            {upload.isPending ? "Uploading…" : "Upload & process"}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
