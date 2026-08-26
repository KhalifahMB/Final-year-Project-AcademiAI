import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap } from "lucide-react";

export default function AssignedCoursesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["lecturer-assignments"],
    queryFn: async () => {
      const { data } = await api.get("/lecturer-assignments/");
      return data.results || data;
    },
  });
  return (
    <AppShell
      title="Assigned courses"
      description="Course offerings you are teaching this session."
    >
      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>Failed to load assignments</AlertDescription></Alert>}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(data || []).map((a) => (
            <li key={a.id}>
              <Link
                to={`/courses/${a.course_offering}`}
                className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <GraduationCap className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.offering_course_code
                      ? `${a.offering_course_code} — ${a.offering_course_title || ""}`
                      : "Course offering"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[a.semester_name, a.session_name].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <div className="mt-1.5">
                    <Badge variant="outline" className="capitalize">{a.assignment_role}</Badge>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                  View →
                </span>
              </Link>
            </li>
          ))}
          {(data || []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 sm:col-span-2">
              No assignments yet — your administrator assigns course offerings.
            </p>
          )}
        </ul>
      )}
    </AppShell>
  );
}
