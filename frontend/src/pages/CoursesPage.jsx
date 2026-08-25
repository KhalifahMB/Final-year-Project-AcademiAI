import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen } from "lucide-react";

function CourseCard({ course }) {
  return (
    <li>
      <article className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <div className="flex items-center justify-between bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-3">
          <span className="rounded-md bg-primary/15 px-2.5 py-1 font-mono text-xs font-semibold tracking-wide text-primary">
            {course.code || "—"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {course.credit_unit ? `${course.credit_unit} cu` : ""}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-4 pt-3">
          <h2 className="text-sm font-semibold leading-snug">{course.title}</h2>
          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {course.description || "No description provided."}
          </p>
        </div>
      </article>
    </li>
  );
}

export default function CoursesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await api.get("/courses/");
      return data.results || data;
    },
  });

  const courses = data || [];

  return (
    <AppShell
      title="Course catalogue"
      description="Every course offered across your institution."
    >
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>Failed to load courses</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="The catalogue is empty"
          description="Courses created by your institution's administrators will appear here."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </ul>
      )}
    </AppShell>
  );
}
