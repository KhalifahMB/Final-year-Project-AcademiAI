import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import api from "@/services/api";
import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/shared/StatCard";
import { useAuth } from "@/hooks/useAuth";
import {
  BookOpen, Building2, ClipboardList, FileText, GraduationCap,
  Landmark, TrendingUp, Users,
} from "lucide-react";

const PIE_COLORS = [
  "oklch(0.55 0.25 293)",
  "oklch(0.6 0.2 255)",
  "oklch(0.65 0.16 215)",
  "oklch(0.7 0.14 175)",
];

async function countOf(endpoint, params) {
  // DRF pagination exposes the unfiltered total as `count`.
  try {
    const { data } = await api.get(endpoint, { params });
    if (typeof data?.count === "number") return data.count;
    const list = Array.isArray(data) ? data : data?.results || [];
    return list.length;
  } catch {
    return 0;
  }
}

function useTenantStats() {
  return useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [
        students, lecturers, admins,
        resTotal, resReady, resProcessing, resPending, resFailed,
        faculties, departments, programmes, courses, offerings,
        enrollments, quizzes,
      ] = await Promise.all([
        countOf("/auth/users/", { role: "student" }),
        countOf("/auth/users/", { role: "lecturer" }),
        countOf("/auth/users/", { role: "admin" }),
        countOf("/resources/"),
        countOf("/resources/", { processing_status: "ready" }),
        countOf("/resources/", { processing_status: "processing" }),
        countOf("/resources/", { processing_status: "pending" }),
        countOf("/resources/", { processing_status: "failed" }),
        countOf("/faculties/"),
        countOf("/departments/"),
        countOf("/programmes/"),
        countOf("/courses/"),
        countOf("/course-offerings/"),
        countOf("/course-enrollments/"),
        countOf("/quizzes/"),
      ]);
      return {
        usersByRole: [
          { name: "Students", value: students },
          { name: "Lecturers", value: lecturers },
          { name: "Admins", value: admins },
        ],
        materialsByStatus: [
          { name: "Ready", value: resReady },
          { name: "Processing", value: resProcessing },
          { name: "Pending", value: resPending },
          { name: "Failed", value: resFailed },
        ].filter((d) => d.value > 0),
        structure: [
          { name: "Faculties", value: faculties },
          { name: "Departments", value: departments },
          { name: "Programmes", value: programmes },
          { name: "Courses", value: courses },
          { name: "Offerings", value: offerings },
        ],
        totals: {
          users: students + lecturers + admins,
          resources: resTotal,
          enrollments, quizzes,
          faculties, departments, programmes, courses,
        },
      };
    },
    staleTime: 60_000,
  });
}

const chartTooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  fontSize: "12px",
  color: "var(--card-foreground)",
};

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const { data, isLoading } = useTenantStats();
  const t = data?.totals;

  return (
    <AppShell
      title="Institution dashboard"
      description="Live overview of your institution's people, academic structure and AI material pipeline."
    >
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={t?.users} hint="All roles in your tenant" />
        <StatCard icon={FileText} label="Materials" value={t?.resources} hint="Uploaded resources" />
        <StatCard icon={GraduationCap} label="Enrollments" value={t?.enrollments} hint="Active course enrollments" />
        <StatCard icon={ClipboardList} label="Quizzes" value={t?.quizzes} hint="Created assessments" />
      </div>

      {/* Structure strip */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Landmark} label="Faculties" value={t?.faculties} hint="Top-level units" />
        <StatCard icon={Building2} label="Departments" value={t?.departments} hint="Within faculties" />
        <StatCard icon={BookOpen} label="Programmes" value={t?.programmes} hint="Degree programmes" />
        <StatCard icon={GraduationCap} label="Courses" value={t?.courses} hint="Course catalogue" />
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Crunching numbers…</p>
      ) : !data ? null : (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {/* People */}
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" aria-hidden /> People by role
            </h2>
            <div className="mt-4 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.usersByRole}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {data.usersByRole.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {data.usersByRole.map((d, i) => (
                <li key={d.name} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    aria-hidden
                  />
                  {d.name} · <span className="font-medium text-foreground">{d.value}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Materials pipeline */}
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> Material pipeline
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Where uploaded resources sit in extraction &amp; indexing.
            </p>
            <div className="mt-4 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.materialsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="oklch(0.55 0.25 293)" maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Academic structure */}
          <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-primary" aria-hidden /> Academic structure
            </h2>
            <div className="mt-4 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.structure}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="oklch(0.6 0.18 255)" maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Signed in as {user?.email} · figures refresh every minute.
      </p>
    </AppShell>
  );
}
