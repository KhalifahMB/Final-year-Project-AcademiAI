import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Plus, Upload as UploadIcon, Search,
} from "lucide-react";
import { resourceSchema } from "@/lib/validations";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const SCOPES = ["private", "course", "programme", "department", "faculty", "institution"];

export default function ResourcesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");

  const isStaff = user?.role === "lecturer" || user?.role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data } = await api.get("/resources/");
      return data.results || data;
    },
  });

  const form = useForm({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      title: "",
      description: "",
      visibility_scope: "course",
      course_offering: "",
    },
  });

  const createMut = useMutation({
    mutationFn: (payload) => api.post("/resources/", payload),
    onSuccess: () => {
      toast.success("Resource created");
      setOpen(false);
      form.reset({ title: "", description: "", visibility_scope: "course", course_offering: "" });
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (err) => {
      setError(err.response?.data?.error?.detail || "Create failed");
      toast.error("Create failed");
    },
  });

  const onSubmit = (values) => {
    setError("");
    const payload = { ...values };
    if (!payload.course_offering) delete payload.course_offering;
    createMut.mutate(payload);
  };

  const resources = data || [];

  const filtered = useMemo(() => {
    let list = resources;
    if (scopeFilter !== "all") {
      list = list.filter((r) => r.visibility_scope === scopeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [resources, search, scopeFilter]);

  return (
    <AppShell
      title="Resources"
      description="Academic materials with scoped visibility — private, course, programme, department, faculty or institution-wide."
      actions={
        <>
          {isStaff ? (
            <Link
              to="/resources/upload"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none"
            >
              <UploadIcon aria-hidden /> Upload file
            </Link>
          ) : null}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none"
            >
              <Plus aria-hidden /> New resource
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create resource metadata</DialogTitle>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{String(error)}</AlertDescription>
                </Alert>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="visibility_scope"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visibility scope</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full capitalize">
                              <SelectValue placeholder="Scope" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SCOPES.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createMut.isPending}>
                      {createMut.isPending ? "Saving…" : "Create resource"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or description…"
            aria-label="Search resources"
            className="h-10 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by visibility">
          {["all", ...SCOPES].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScopeFilter(s)}
              aria-pressed={scopeFilter === s}
              className={cn(
                "h-9 rounded-lg border px-3 text-xs font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                scopeFilter === s
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search || scopeFilter !== "all" ? "No matching resources" : "No resources yet"}
          description={
            search || scopeFilter !== "all"
              ? "Try a different search term or clear the visibility filter."
              : isStaff
                ? "Upload your first document — it will be extracted, chunked and made searchable automatically."
                : "Materials shared with your courses will appear here."
          }
          action={isStaff && !search && scopeFilter === "all" ? "Upload file" : undefined}
          actionTo={isStaff && !search && scopeFilter === "all" ? "/resources/upload" : undefined}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <article className="group flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold leading-snug" title={r.title}>
                      {r.title}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {r.description || "No description"}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3.5">
                  <StatusBadge status={r.processing_status} />
                  <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
                    {r.visibility_scope}
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
