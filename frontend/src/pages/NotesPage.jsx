import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dashApi } from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { noteSchema } from "@/lib/validations";
import { toast } from "sonner";

export default function NotesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data } = await dashApi.notes();
      return data.results || data;
    },
  });
  const form = useForm({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", content: "" },
  });
  const create = useMutation({
    mutationFn: (p) => api.post("/notes/", p),
    onSuccess: () => {
      toast.success("Note saved");
      form.reset();
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: () => toast.error("Failed to save note"),
  });

  return (
    <AppShell title="Notes">
      <Form {...form}>
        <form
          className="mb-6 space-y-3 max-w-xl"
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
        >
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
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={create.isPending}>
            Save note
          </Button>
        </form>
      </Form>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Failed to load notes</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loadingâ€¦</p>
      ) : (
        <ul className="space-y-2">
          {(data || []).map((n) => (
            <Card key={n.id}>
              <CardContent className="py-4">
                <div className="font-medium">{n.title}</div>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{n.content}</p>
              </CardContent>
            </Card>
          ))}
          {(data || []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No notes yet.</p>
          )}
        </ul>
      )}
    </AppShell>
  );
}


