import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function MyCoursesPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const { data } = await api.get("/course-enrollments/");
      return data.results || data;
    },
  });

  const enrollments = data || [];

  return (
    <AppShell
      title="My courses"
      description="Your enrollments for the current academic sessions."
    >
      {error ? (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>
            <span className="font-medium">Failed to load enrollments.</span>{" "}
            {String(error?.response?.data?.detail || error.message || error)}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </Alert>
      ) : null}

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No enrollments yet"
          description={
            user?.role === "student"
              ? "Enrollments are created automatically from your programme. If you just signed up, an admin can also enroll you manually."
              : "When your institution enrolls you in course offerings, they'll show up here."
          }
          actionTo={user?.role === "student" ? "/my-programme" : undefined}
          action={user?.role === "student" ? "View my programme" : undefined}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {enrollments.map((e) => (
            <li key={e.id}>
              <Link
                to={`/courses/${e.course_offering}`}
                className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <GraduationCap className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {e.offering_course_code
                      ? `${e.offering_course_code} — ${e.offering_course_title || ""}`
                      : "Course offering"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[e.semester_name, e.session_name].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge status={e.status} />
                  </div>
                </div>
                <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                  View →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
