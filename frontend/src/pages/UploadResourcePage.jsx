import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import StatusBadge from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  Loader2,
} from "lucide-react";

const ACCEPT = ".txt,.md,.pdf,.docx,.pptx,.json";
const SCOPES = ["private", "course", "programme", "department", "faculty", "institution"];

const STEPS = [
  "Creating resource record…",
  "Requesting a secure upload link…",
  "Uploading your file…",
  "Queueing text extraction & indexing…",
];

export default function UploadResourcePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("private");
  const [offering, setOffering] = useState("");
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(-1);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  // Offerings for course-scoped visibility — a course material without an
  // offering would be undiscoverable.
  const offerings = useQuery({
    queryKey: ["offerings-for-upload"],
    queryFn: async () => {
      const { data } = await api.get("/course-offerings/?page_size=200");
      return data.results || data;
    },
    enabled: scope === "course",
    staleTime: 60_000,
  });

  const upload = useMutation({
    mutationFn: async () => {
      setStep(0);
      // 1. Create the metadata record.
      const payload = {
        title: title || file?.name || "Upload",
        description,
        visibility_scope: scope,
      };
      if (scope === "course" && offering) payload.course_offering = offering;
      const { data: resource } = await api.post("/resources/", payload);

      setStep(1);
      // 2. Get a presigned POST bound to this resource's tenant partition.
      const contentType = file.type || "application/octet-stream";
      const { data: presign } = await api.post(
        `/resources/${resource.id}/request_upload_url/`,
        { content_type: contentType }
      );

      setStep(2);
      // 3. Upload bytes straight to object storage (fields first, file last).
      const form = new FormData();
      Object.entries(presign.form_fields || {}).forEach(([k, v]) => form.append(k, v));
      form.append("file", file);
      const put = await fetch(presign.upload_url, { method: "POST", body: form });
      if (!put.ok) throw new Error("Storage rejected the upload. Check the file size/type and retry.");

      setStep(3);
      // 4. Register the version; backend starts async ingestion.
      const { data: completion } = await api.post(
        `/resources/${resource.id}/complete_upload/`,
        { storage_key: presign.storage_key }
      );
      return { resource, job_id: completion.job_id };
    },
    onSuccess: ({ resource }) => {
      setDone(resource);
      toast.success("Upload complete — processing started");
      qc.invalidateQueries({ queryKey: ["resources"] });
      qc.invalidateQueries({ queryKey: ["dash-resources"] });
      qc.invalidateQueries({ queryKey: ["dash-courses"] });
    },
    onError: (e) => {
      setError(e.response?.data?.error?.detail || e.message || "Upload failed");
      setStep(-1);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds the 25 MB limit.");
      return;
    }
    if (scope === "course" && !offering) {
      setError("Select the course offering this material belongs to.");
      return;
    }
    upload.mutate();
  };

  if (done) {
    return (
      <AppShell title="Upload material" description="Share course materials with your institution.">
        <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm view-enter">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold">“{done.title}” uploaded</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your file is stored securely. Text extraction, chunking, and embedding
            are now running — the status below updates automatically.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <StatusBadge status={done.processing_status || "pending"} />
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate("/resources")}>
              Go to resources
            </Button>
            <Button
              onClick={() => {
                setDone(null);
                setFile(null);
                setTitle("");
                setDescription("");
              }}
              className="shadow-sm"
            >
              Upload another
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Upload material"
      description="Files are scanned, extracted, chunked, and indexed so the AI assistant can cite them."
    >
      <form onSubmit={submit} className="max-w-xl space-y-5">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{String(error)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <label
            htmlFor="file"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <CloudUpload className="h-8 w-8 text-primary" aria-hidden />
            {file ? (
              <>
                <span className="mt-3 flex max-w-full items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{file.name}</span>
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · click to replace
                </span>
              </>
            ) : (
              <>
                <span className="mt-3 text-sm font-medium">
                  Drop a file here or click to browse
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  PDF, DOCX, PPTX, TXT, MD or JSON · up to 25 MB
                </span>
              </>
            )}
          </label>
          <input
            id="file"
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={file ? file.name : "e.g. CSC401 Week 3 lecture notes"}
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Description (optional)</Label>
          <Input
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this material about?"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Visibility</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="h-10 w-full capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            “Private” means only you can find and summarize this material.
          </p>
        </div>

        {scope === "course" && (
          <div className="space-y-1.5">
            <Label>Course offering</Label>
            <Select value={offering || undefined} onValueChange={setOffering}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue
                  placeholder={
                    offerings.isLoading
                      ? "Loading offerings…"
                      : (offerings.data || []).length === 0
                        ? "No offerings available"
                        : "Select offering"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(offerings.data || []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.course_code
                      ? `${o.course_code} — ${o.course_title || ""}`
                      : o.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Enrolled students and the assigned lecturer will see this material.
            </p>
          </div>
        )}

        {upload.isPending ? (
          <div className="flex items-center gap-2.5 rounded-lg border bg-accent/40 px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
            {STEPS[Math.min(step, STEPS.length - 1)]}
          </div>
        ) : (
          <Button type="submit" disabled={!file} className="h-10 px-6 font-medium shadow-sm">
            <CloudUpload className="mr-2 h-4 w-4" aria-hidden />
            Upload &amp; process
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          By uploading you confirm you have the right to share this material.{" "}
          <Link to="/resources" className="underline underline-offset-2 hover:text-foreground">
            Browse existing materials
          </Link>
        </p>
      </form>
    </AppShell>
  );
}
