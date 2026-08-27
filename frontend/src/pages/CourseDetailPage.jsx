import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  FileIcon,
  Video,
  Music,
  Image as ImageIcon,
  Link as LinkIcon,
  FileArchive,
  GraduationCap,
  ChevronLeft,
  CalendarDays,
  Clock,
  BookOpen
} from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import SkeletonRows from "@/components/shared/SkeletonRows";

function getFileIcon(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("pdf")) return <FileText className="h-4 w-4" />;
  if (t.includes("video") || t.includes("mp4")) return <Video className="h-4 w-4" />;
  if (t.includes("audio") || t.includes("mp3")) return <Music className="h-4 w-4" />;
  if (t.includes("image") || t.includes("png") || t.includes("jpg")) return <ImageIcon className="h-4 w-4" />;
  if (t.includes("zip") || t.includes("rar")) return <FileArchive className="h-4 w-4" />;
  if (t.includes("link") || t.includes("url")) return <LinkIcon className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
}

export default function CourseDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const role = user?.role;

  const offering = useQuery({
    queryKey: ["course-offering", id],
    queryFn: async () => (await api.get(`/course-offerings/${id}/`)).data,
    enabled: !!id,
  });

  const course = useQuery({
    queryKey: ["course", offering.data?.course],
    queryFn: async () => (await api.get(`/courses/${offering.data.course}/`)).data,
    enabled: !!offering.data?.course,
  });

  const resources = useQuery({
    queryKey: ["resources", "offering", id],
    queryFn: async () => {
      // Students/lecturers only see materials their academic scope allows.
      const params = { course_offering: id };
      if (role === "student" || role === "lecturer") params.scope = "authorized";
      const { data } = await api.get("/resources/", { params });
      return data.results || data;
    },
    enabled: !!id,
  });

  if (offering.error) {
    return (
      <AppShell title="Course details">
        <Alert variant="destructive" className="mb-4 mt-6">
          <AlertDescription>Offering not found or unauthorized</AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  const isLoading = offering.isLoading || course.isLoading;

  return (
    <AppShell title="Course details" description="Detailed information and resources for this course offering.">
      <Link
        to="/my-courses"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring rounded-md transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to my courses
      </Link>

      {isLoading ? (
        <div className="space-y-8">
          <SkeletonRows rows={3} />
          <div className="grid gap-6 md:grid-cols-2">
             <SkeletonRows rows={4} />
             <SkeletonRows rows={4} />
          </div>
          <SkeletonRows rows={5} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Hero Header */}
          <div className="relative overflow-hidden rounded-2xl bg-card border shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pointer-events-none" aria-hidden />
            <div className="relative p-6 sm:p-8">
               <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-4 max-w-2xl">
                     <div className="flex flex-wrap items-center gap-2.5">
                        <span className="rounded-md bg-primary/15 px-2.5 py-1 font-mono text-xs font-semibold tracking-wide text-primary">
                          {offering.data?.course_code || course.data?.code || "—"}
                        </span>
                        <StatusBadge status={offering.data?.status || "unknown"} />
                     </div>
                     <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        {offering.data?.course_title || course.data?.title || "Course Offering"}
                     </h1>
                     <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {offering.data?.session_name && (
                           <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-4 w-4" />
                              <span>{offering.data.session_name}</span>
                           </div>
                        )}
                        {offering.data?.semester_name && (
                           <div className="flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              <span>{offering.data.semester_name}</span>
                           </div>
                        )}
                        {course.data?.credit_unit != null && (
                            <div className="flex items-center gap-1.5">
                              <BookOpen className="h-4 w-4" />
                              <span>{course.data.credit_unit} Credits</span>
                           </div>
                        )}
                     </div>
                  </div>
                  <div className="hidden sm:flex shrink-0 h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                     <GraduationCap className="h-8 w-8" />
                  </div>
               </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Course Description</CardTitle>
              </CardHeader>
              <CardContent>
                 <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {course.data?.description || "No description provided for this course."}
                 </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Offering Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                 <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium capitalize">{offering.data?.status || "—"}</span>
                 </div>
                 <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Academic Session</span>
                    <span className="font-medium">{offering.data?.session_name || "—"}</span>
                 </div>
                 <div className="flex justify-between pb-1">
                    <span className="text-muted-foreground">Semester</span>
                    <span className="font-medium">{offering.data?.semester_name || "—"}</span>
                 </div>
              </CardContent>
            </Card>
          </div>

          {/* Resources */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Course Resources</h2>
              <Badge variant="secondary" className="font-mono">
                 {(resources.data || []).length} items
              </Badge>
            </div>
            
            {resources.isLoading ? (
               <SkeletonRows rows={3} />
            ) : (resources.data || []).length === 0 ? (
               <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">No resources available</p>
                  <p className="text-xs text-muted-foreground mt-1">Materials added to this offering will appear here.</p>
               </div>
            ) : (
               <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                 {(resources.data || []).map((r) => (
                    <article key={r.id} className="group flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
                       <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                             {getFileIcon(r.file_type || r.title)}
                          </div>
                          <Badge variant="outline" className="capitalize text-[10px] shrink-0">
                             {r.visibility_scope}
                          </Badge>
                       </div>
                       <h3 className="text-sm font-semibold leading-snug line-clamp-2 mb-1">{r.title}</h3>
                       {r.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{r.description}</p>
                       )}
                       <div className="mt-auto pt-3 flex items-center justify-between border-t border-border/50">
                          <span className="text-[11px] text-muted-foreground">
                             {r.processing_status === 'completed' ? 'Processed' : r.processing_status}
                          </span>
                       </div>
                    </article>
                 ))}
               </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
