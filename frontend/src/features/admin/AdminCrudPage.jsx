import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

function useSelectOptions(fields) {
  const path = fields.find((f) => f.type === "select" && f.optionsPath)?.optionsPath;
  // Support multiple option paths by fetching faculties/departments commonly used
  const faculties = useQuery({
    queryKey: ["opts", "/faculties/"],
    queryFn: async () => ((await api.get("/faculties/")).data.results || (await api.get("/faculties/")).data),
    enabled: fields.some((f) => f.optionsPath === "/faculties/"),
  });
  const departments = useQuery({
    queryKey: ["opts", "/departments/"],
    queryFn: async () => {
      const { data } = await api.get("/departments/");
      return data.results || data;
    },
    enabled: fields.some((f) => f.optionsPath === "/departments/"),
  });
  const map = {
    "/faculties/": faculties.data || [],
    "/departments/": departments.data || [],
  };
  return map;
}

export default function AdminCrudPage({
  title,
  endpoint,
  queryKey,
  schema,
  fields,
  columns,
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const optionsMap = useSelectOptions(fields);

  const list = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data } = await api.get(endpoint);
      return data.results || data;
    },
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])),
  });

  const createMut = useMutation({
    mutationFn: (payload) => api.post(endpoint, payload),
    onSuccess: () => {
      toast.success(`${title} created`);
      setOpen(false);
      form.reset();
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err) => {
      const d = err.response?.data?.error?.detail || err.response?.data?.detail || "Create failed";
      setError(typeof d === "string" ? d : JSON.stringify(d));
      toast.error("Create failed");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`${endpoint}${id}/`),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: () => toast.error("Delete failed"),
  });

  const onSubmit = (values) => {
    setError("");
    const payload = { ...values };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") delete payload[k];
    });
    createMut.mutate(payload);
  };

  return (
    <AppShell title={title}>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button">Create</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create</DialogTitle>
            </DialogHeader>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {fields.map((f) => (
                  <FormField
                    key={f.name}
                    control={form.control}
                    name={f.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{f.label}</FormLabel>
                        <FormControl>
                          {f.type === "textarea" ? (
                            <Textarea {...field} />
                          ) : f.type === "select" ? (
                            <Select value={field.value || undefined} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder={f.label} />
                              </SelectTrigger>
                              <SelectContent>
                                {(f.options || optionsMap[f.optionsPath] || []).map((opt) => {
                                  const val = String(opt.id || opt.value);
                                  const lab = opt.name || opt.code || opt.label || val;
                                  return (
                                    <SelectItem key={val} value={val}>
                                      {lab}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input type={f.type || "text"} {...field} />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {list.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Failed to load</AlertDescription>
        </Alert>
      )}
      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data || []).map((item) => (
                <TableRow key={item.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>{String(item[c.key] ?? "")}</TableCell>
                  ))}
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm("Delete this record?")) deleteMut.mutate(item.id);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(list.data || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground">
                    No records yet. Create one.
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
