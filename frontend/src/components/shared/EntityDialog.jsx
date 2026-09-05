import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/**
 * Generic create/edit modal driven by a field spec:
 *   { name, label, type: 'text'|'number'|'date'|'textarea'|'select',
 *     placeholder?, required?, options?: [{value,label}] }
 * Values are strings/numbers as controlled by inputs; caller handles
 * payload shaping. `initial` seeds the form (edit mode).
 */
export default function EntityDialog({
  open,
  title,
  fields,
  initial,
  onSubmit,
  pending,
  error,
  onClose,
  submitLabel,
}) {
  const form = useForm({
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, ""])),
  });

  useEffect(() => {
    if (!open) return;
    const values = {};
    fields.forEach((f) => {
      const v = initial?.[f.name];
      values[f.name] = v == null ? "" : String(v);
    });
    form.reset(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const submit = (values) => {
    const payload = {};
    fields.forEach((f) => {
      const v = values[f.name];
      if (v === "" || v == null) {
        if (f.required) payload[f.name] = v;
      } else {
        payload[f.name] = f.type === "number" ? Number(v) : v;
      }
    });
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{String(error)}</AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            {fields.map((f) => (
              <FormField
                key={f.name}
                control={form.control}
                name={f.name}
                rules={f.required ? { required: `${f.label} is required` } : undefined}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {f.label}
                      {f.required ? <span className="text-destructive"> *</span> : null}
                    </FormLabel>
                    <FormControl>
                      {f.type === "select" ? (
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={f.placeholder || `Select ${f.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {(f.options || []).map((o) => (
                              <SelectItem key={o.value} value={String(o.value)}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : f.type === "textarea" ? (
                        <Textarea rows={3} placeholder={f.placeholder} {...field} />
                      ) : (
                        <Input
                          type={f.type || "text"}
                          step={f.type === "number" ? "any" : undefined}
                          placeholder={f.placeholder}
                          {...field}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="shadow-sm">
                {pending ? "Saving…" : submitLabel || "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
