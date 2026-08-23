import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { resourceSchema } from "@/lib/validations";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const SCOPES = ["private", "course", "programme", "department", "faculty", "institution"];

export default function ResourcesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <AppShell title="Resources">
      <div className="mb-4 flex flex-wrap gap-2 justify-between">
        <p className="text-sm text-muted-foreground">
          Visibility: private · course · programme · department · faculty · institution
        </p>
        <div className="flex gap-2">
          {(user?.role === "lecturer" || user?.role === "admin") && (
            <Button asChild variant="outline">
              <Link to="/resources/upload">Upload file</Link>
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button">New resource</Button>
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
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
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
                          <Textarea {...field} />
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
                            <SelectTrigger>
                              <SelectValue placeholder="Scope" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SCOPES.map((s) => (
                              <SelectItem key={s} value={s}>
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
                      {createMut.isPending ? "Saving…" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visibility</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.processing_status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.visibility_scope}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(data || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No resources yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
