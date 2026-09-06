import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
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
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  MailCheck,
  MailWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const emailSchema = z.object({
 requester_email: z.string().email('Enter a valid email'),
});

const detailsSchema = z.object({
 requester_name: z.string().min(2, 'Please enter your name'),
 requester_role: z.string().max(80).optional().or(z.literal('')),
 phone_number: z.string().max(32).optional().or(z.literal('')),
});

const institutionSchema = z.object({
 institution_name: z.string().min(3, 'Institution name is required'),
 institution_domain: z.string().max(255).optional().or(z.literal('')),
 institution_type: z.string().default('university'),
 estimated_students: z.union([z.coerce.number().int().positive().optional(), z.literal('')]).optional(),
 notes: z.string().max(2000).optional().or(z.literal('')),
});

const fullSchema = emailSchema.merge(detailsSchema).merge(institutionSchema);

const STEPS = ['Email', 'Your details', 'Institution'];

function StepIndicator({ step }) {
 return (
  <ol
   className="mb-6 flex items-center gap-2"
   aria-label="Request progress"
  >
   {STEPS.map((label, i) => {
    const n = i + 1;
    const done = n < step;
    const current = n === step;
    return (
     <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
      <span
       aria-current={current ? 'step' : undefined}
       className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
        done && 'border-transparent bg-[var(--landing-teal)] text-white',
        current && 'border-[var(--landing-teal)] text-[var(--landing-teal)]',
        !done && !current && 'border-[var(--landing-line)] text-[var(--landing-muted)]',
       )}
      >
       {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : n}
      </span>
      <span
       className={cn(
        'hidden text-[12px] font-semibold sm:inline',
        current ? 'text-[var(--landing-ink)]' : 'text-[var(--landing-muted)]',
       )}
      >
       {label}
      </span>
      {n < STEPS.length && (
       <span aria-hidden className="h-px flex-1 bg-[var(--landing-line)]" />
      )}
     </li>
    );
   })}
  </ol>
 );
}

export default function RequestInstitutionPage() {
 const [step, setStep] = useState(1);
 const [success, setSuccess] = useState(false);
 const [error, setError] = useState('');
 // Email-gate state: Next stays disabled until the backend confirms free.
 const [emailStatus, setEmailStatus] = useState('idle'); // idle|checking|available|taken|error
 const [emailDetail, setEmailDetail] = useState('');
 const checkSeq = useRef(0);

 const form = useForm({
 resolver: zodResolver(fullSchema),
 mode: 'onTouched',
 defaultValues: {
 requester_name: '', requester_email: '', requester_role: '',
 phone_number: '', institution_name: '', institution_domain: '',
 institution_type: 'university', estimated_students: '', notes: '',
 },
 });

 const watchedEmail = useWatch({ control: form.control, name: 'requester_email' });

 // Debounced backend availability check for step 1. The `checking`/`idle`
 // flags are set from the input's onChange (an event, not an effect) so
 // this effect only synchronises the async verification result.
 useEffect(() => {
  const email = (watchedEmail || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const seq = ++checkSeq.current;
  const t = setTimeout(async () => {
   try {
    const { data } = await platformApi.tenantRequests.checkEmail({ requester_email: email });
    if (checkSeq.current !== seq) return;
    if (data?.available) {
     setEmailStatus('available');
     setEmailDetail(data?.detail || 'Email is available.');
    } else {
     setEmailStatus('taken');
     setEmailDetail(data?.detail || 'An account with this email already exists. Please sign in instead.');
    }
   } catch {
    if (checkSeq.current !== seq) return;
    setEmailStatus('error');
    setEmailDetail('Could not verify this email right now. You can still continue — we will validate on submit.');
   }
  }, 500);
  return () => clearTimeout(t);
 }, [watchedEmail]);

 const emailGateOpen = emailStatus === 'available' || emailStatus === 'error';

 const goNextFromEmail = async () => {
  const ok = await form.trigger('requester_email');
  if (!ok || !emailGateOpen) return;
  setError('');
  setStep(2);
 };

 const goNextFromDetails = async () => {
  const ok = await form.trigger(['requester_name', 'requester_role', 'phone_number']);
  if (!ok) return;
  setError('');
  setStep(3);
 };

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

 const titles = {
  1: 'Start with your work email',
  2: 'Tell us who you are',
  3: 'Get your institution on AcademiAI',
 };
 const subtitles = {
  1: 'We first check that this address is not already attached to an account — then the rest unlocks.',
  2: 'A short introduction so our platform team knows who is requesting.',
  3: 'Tell us about your university or college. Setup is free for early adopters.',
 };

 if (success) {
 return (
 <AuthLayout
 eyebrow="Institution onboarding"
 title="Request received"
 subtitle="We'll review your application and be in touch soon."
 >
 <div className="rounded-xl border bg-[var(--success-soft)] p-8 text-center">
 <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[var(--success)]" />
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
 eyebrow="Institution onboarding"
 title={titles[step]}
 subtitle={subtitles[step]}
 footer={
 <>
 Already have an account?{' '}
 <Link to="/login" className="landing-text-link font-medium">Sign in</Link>
 </>
 }
 >
 {error && (
 <Alert variant="destructive" role="alert" className="mb-4">
 <AlertDescription>{error}</AlertDescription>
 </Alert>
 )}

 <StepIndicator step={step} />

 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
 {step === 1 && (
  <div className="space-y-4">
   <FormField control={form.control} name="requester_email" render={({ field }) => (
   <FormItem>
    <FormLabel>Work email</FormLabel>
    <FormControl>
     <Input
      className="h-10"
      type="email"
      autoComplete="email"
      placeholder="you@university.edu.ng"
      aria-describedby="request-email-status"
      {...field}
      onChange={(e) => {
       field.onChange(e);
       const v = (e.target.value || '').trim().toLowerCase();
       if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        setEmailStatus('checking');
        setEmailDetail('');
       } else {
        setEmailStatus('idle');
        setEmailDetail('');
       }
      }}
     />
    </FormControl>
    <FormMessage />
    <p id="request-email-status" role="status" className="flex min-h-5 items-center gap-1.5 text-[12px]">
     {emailStatus === 'checking' && (
      <span className="inline-flex items-center gap-1.5 text-[var(--landing-muted)]">
       <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking availability…
      </span>
     )}
     {emailStatus === 'available' && (
      <span className="inline-flex items-center gap-1.5 text-[var(--success)]">
       <MailCheck className="h-3.5 w-3.5" aria-hidden /> {emailDetail}
      </span>
     )}
     {emailStatus === 'taken' && (
      <span className="inline-flex items-center gap-1.5 text-[var(--landing-coral)]">
       <MailWarning className="h-3.5 w-3.5" aria-hidden /> {emailDetail}{' '}
       <Link to="/login" className="landing-text-link font-semibold">Sign in</Link>
      </span>
     )}
     {emailStatus === 'error' && (
      <span className="text-[var(--landing-muted)]">{emailDetail}</span>
     )}
    </p>
   </FormItem>
   )} />
   <Button
    type="button"
    className="w-full gap-2"
    disabled={!emailGateOpen || form.formState.isSubmitting}
    onClick={goNextFromEmail}
   >
    Next <ArrowRight className="h-4 w-4" aria-hidden />
   </Button>
   <p className="text-center text-[11px] text-muted-foreground">
    The Next button unlocks only after the email is verified as available.
   </p>
  </div>
 )}

 {step === 2 && (
  <div className="space-y-4">
   <p className="flex items-center justify-between rounded-lg border border-[var(--landing-line)] bg-[var(--landing-panel)] px-3 py-2 text-[12px] text-[var(--landing-muted)]">
    <span className="truncate">Requesting as <strong className="text-[var(--landing-ink)]">{form.getValues('requester_email')}</strong></span>
    <button type="button" onClick={() => setStep(1)} className="landing-text-link ml-2 shrink-0 font-semibold">Change</button>
   </p>
   <h3 className="landing-eyebrow flex items-center gap-2">
   <Building2 className="h-3.5 w-3.5" /> Your details
   </h3>
   <div className="grid grid-cols-2 gap-3">
   <FormField control={form.control} name="requester_name" render={({ field }) => (
   <FormItem><FormLabel>Your name</FormLabel><FormControl><Input className="h-10" placeholder="e.g. Amina Yusuf" autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>
   )} />
   <FormField control={form.control} name="requester_role" render={({ field }) => (
   <FormItem><FormLabel>Your role</FormLabel><FormControl><Input className="h-10" placeholder="e.g. ICT Director" autoComplete="organization-title" {...field} /></FormControl><FormMessage /></FormItem>
   )} />
   </div>
   <FormField control={form.control} name="phone_number" render={({ field }) => (
   <FormItem><FormLabel>Phone (optional)</FormLabel><FormControl><Input className="h-10" type="tel" autoComplete="tel" placeholder="+234…" {...field} /></FormControl><FormMessage /></FormItem>
   )} />
   <div className="flex gap-2">
    <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(1)}>
     <ArrowLeft className="h-4 w-4" aria-hidden /> Back
    </Button>
    <Button type="button" className="flex-1 gap-2" onClick={goNextFromDetails}>
     Next <ArrowRight className="h-4 w-4" aria-hidden />
    </Button>
   </div>
  </div>
 )}

 {step === 3 && (
  <div className="space-y-4">
   <h3 className="landing-eyebrow pt-2">Institution</h3>
   <FormField control={form.control} name="institution_name" render={({ field }) => (
   <FormItem><FormLabel>Institution name</FormLabel><FormControl><Input className="h-10" placeholder="e.g. University of Lagos" autoComplete="organization" {...field} /></FormControl><FormMessage /></FormItem>
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

   <div className="flex gap-2">
    <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(2)}>
     <ArrowLeft className="h-4 w-4" aria-hidden /> Back
    </Button>
    <Button type="submit" className="flex-1 shadow" disabled={form.formState.isSubmitting}>
    {form.formState.isSubmitting ? 'Submitting…' : 'Submit request'}
    </Button>
   </div>
  </div>
 )}
 </form>
 </Form>
 </AuthLayout>
 );
}
