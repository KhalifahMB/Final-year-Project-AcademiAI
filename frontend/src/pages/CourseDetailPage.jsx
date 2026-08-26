import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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

  return (
    <AppShell title="Course details">
      <Link to="/my-courses" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← My courses
      </Link>
      {offering.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Offering not found or unauthorized</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Offering</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {offering.isLoading ? (
              "Loading…"
            ) : offering.data ? (
              <>
                <div className="text-base font-semibold">
                  {offering.data.course_code
                    ? `${offering.data.course_code} — ${offering.data.course_title || ""}`
                    : "Course offering"}
                </div>
                <div className="flex items-center gap-2">
                  Status: <Badge>{offering.data.status}</Badge>
                </div>
                <div>Session: {offering.data.session_name || "—"}</div>
                <div>Semester: {offering.data.semester_name || "—"}</div>
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Course</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {course.isLoading ? (
              "Loading…"
            ) : course.data ? (
              <>
                <div className="font-medium">
                  {course.data.code} — {course.data.title}
                </div>
                <p className="text-muted-foreground">{course.data.description || "No description"}</p>
                <div>Credits: {course.data.credit_unit ?? "—"}</div>
              </>
            ) : (
              <span className="text-muted-foreground">Course metadata unavailable</span>
            )}
          </CardContent>
        </Card>
      </div>
      <h2 className="font-semibold mb-2">Resources for this offering</h2>
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
            {(resources.data || []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.processing_status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.visibility_scope}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {!resources.isLoading && (resources.data || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No resources linked to this offering.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
