import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NotesPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data } = await api.get("/notes/");
      return data.results || data;
    },
  });
  const create = useMutation({
    mutationFn: (p) => api.post("/notes/", p),
    onSuccess: () => {
      setTitle("");
      setContent("");
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (e) => setError(e.response?.data?.error?.detail || "Failed"),
  });
  return (
    <AppShell title="Notes">
      <form className="mb-6 space-y-2 max-w-xl" onSubmit={(e) => { e.preventDefault(); create.mutate({ title, content }); }}>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Textarea placeholder="Content" value={content} onChange={(e) => setContent(e.target.value)} required />
        <Button type="submit" disabled={create.isPending}>Save note</Button>
      </form>
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{String(error)}</AlertDescription></Alert>}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="space-y-2">
          {(data || []).map((n) => (
            <Card key={n.id}><CardContent className="py-4">
              <div className="font-medium">{n.title}</div>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{n.content}</p>
            </CardContent></Card>
          ))}
          {(data || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No notes yet.</p>}
        </ul>
      )}
    </AppShell>
  );
}
