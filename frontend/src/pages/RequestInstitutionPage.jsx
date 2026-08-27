import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AuthLayout from '@/components/layout/AuthLayout';
import { platformApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Building2 } from 'lucide-react';

const schema = z.object({
  requester_name: z.string().min(2, 'Please enter your name'),
  requester_email: z.string().email('Enter a valid email'),
  requester_role: z.string().max(80).optional().or(z.literal('')),
  phone_number: z.string().max(32).optional().or(z.literal('')),
  institution_name: z.string().min(3, 'Institution name is required'),
  institution_domain: z.string().max(255).optional().or(z.literal('')),
  institution_type: z.string().default('university'),
  estimated_students: z.union([z.coerce.number().int().positive().optional(), z.literal('')]).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export default function RequestInstitutionPage() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      requester_name: '', requester_email: '', requester_role: '',
      phone_number: '', institution_name: '', institution_domain: '',
      institution_type: 'university', estimated_students: '', notes: '',
    },
  });

  const onSubmit = async (values) => {
    setError('');
    const payload = { ...values };
    if (!payload.estimated_students) delete payload.estimated_students;
    try {
      await platformApi.tenantRequests.create(payload);
      setSuccess(true);
    } catch (err) {
      const d = err.response?.data?.error?.detail;
      setError(typeof d === 'string' ? d : err.message || 'Could not submit request');
    }
  };

  if (success) {
    return (
      <AuthLayout
        title="Request received"
        subtitle="We'll review your application and be in touch soon."
      >
        <div className="rounded-xl border bg-emerald-500/10 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
          <p className="text-sm text-muted-foreground">
            Thank you. Our platform team reviews institution requests daily. You'll receive an email at <strong>{form.getValues('requester_email')}</strong> once your institution is provisioned.
          </p>
          <Link to="/" className="mt-6 inline-block">
            <Button>Back to home</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Get your institution on AcademiAI"
      subtitle="Tell us about your university or college. Setup is free for early adopters."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">Sign in</Link>
        </>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" /> Your details
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="requester_name" render={({ field }) => (
              <FormItem><FormLabel>Your name</FormLabel><FormControl><Input className="h-10" placeholder="e.g. Amina Yusuf" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="requester_role" render={({ field }) => (
              <FormItem><FormLabel>Your role</FormLabel><FormControl><Input className="h-10" placeholder="e.g. ICT Director" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="requester_email" render={({ field }) => (
              <FormItem><FormLabel>Work email</FormLabel><FormControl><Input className="h-10" type="email" placeholder="you@university.edu.ng" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="phone_number" render={({ field }) => (
              <FormItem><FormLabel>Phone (optional)</FormLabel><FormControl><Input className="h-10" placeholder="+234…" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>

          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Institution</h3>
          <FormField control={form.control} name="institution_name" render={({ field }) => (
            <FormItem><FormLabel>Institution name</FormLabel><FormControl><Input className="h-10" placeholder="e.g. University of Lagos" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="institution_domain" render={({ field }) => (
              <FormItem><FormLabel>Institution email domain</FormLabel><FormControl><Input className="h-10" placeholder="unilag.edu.ng" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="institution_type" render={({ field }) => (
              <FormItem><FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="university">University</SelectItem>
                    <SelectItem value="polytechnic">Polytechnic</SelectItem>
                    <SelectItem value="college">College of Education</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select><FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="estimated_students" render={({ field }) => (
            <FormItem><FormLabel>Estimated number of students (optional)</FormLabel><FormControl><Input className="h-10" type="number" min="1" placeholder="e.g. 15000" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem><FormLabel>Anything else we should know?</FormLabel><FormControl><Textarea rows={3} placeholder="Tell us about your use case, existing systems, timeline…" {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <Button type="submit" className="w-full shadow" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Submitting…' : 'Submit request'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
