"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  FileText,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Progress } from "@/components/ui";
import { dashboardService, projectService } from "@/services";
import { activityService } from "@/features/activity/services/activity.service";
import { reportService } from "@/features/reports/services/report.service";
import type { DashboardKPIs, Project, Activity, DailyReport } from "@/types";
import { formatCurrency, formatPercent, formatRelative } from "@/utils/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import Link from "next/link";
import Image from "next/image";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/constants";
import { Badge, CircularProgress } from "@/components/ui";
import { quickNavigation } from "@/config/navigation";

const kpiIcons = {
  activeProjects: Building2,
  fieldEmployees: Users,
  overallProgress: TrendingUp,
  completedValue: DollarSign,
  remainingValue: DollarSign,
  newDocuments: FileText,
  todayReports: ClipboardList,
};

function KPICard({
  label,
  value,
  icon: Icon,
  format = "number",
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  format?: "number" | "currency" | "percent";
  delay?: number;
}) {
  const formatted =
    format === "currency"
      ? formatCurrency(value)
      : format === "percent"
        ? formatPercent(value)
        : value.toLocaleString("he-IL");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{formatted}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary-600" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chartData, setChartData] = useState<{ name: string; completed: number; remaining: number }[]>([]);
  const [progressData, setProgressData] = useState<{ month: string; planned: number; actual: number }[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recentReports, setRecentReports] = useState<DailyReport[]>([]);

  useEffect(() => {
    Promise.all([
      dashboardService.getKPIs(),
      projectService.getRecent(5),
      dashboardService.getChartData(),
      dashboardService.getProgressData(),
      activityService.getRecent(8),
      reportService.getRecent(5),
    ]).then(([k, p, c, pr, a, r]) => {
      setKpis(k);
      setProjects(p);
      setChartData(c);
      setProgressData(pr);
      setActivities(a);
      setRecentReports(r);
    });
  }, []);

  if (!kpis) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">סקירה כללית של פעילות החברה</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-colors"
          >
            {item.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="פרויקטים פעילים" value={kpis.activeProjects} icon={kpiIcons.activeProjects} delay={0} />
        <KPICard label="עובדים בשטח" value={kpis.fieldEmployees} icon={kpiIcons.fieldEmployees} delay={0.05} />
        <KPICard label="אחוז ביצוע כללי" value={kpis.overallProgress} icon={kpiIcons.overallProgress} format="percent" delay={0.1} />
        <KPICard label="שווי שבוצע" value={kpis.completedValue} icon={kpiIcons.completedValue} format="currency" delay={0.15} />
        <KPICard label="שווי שנותר" value={kpis.remainingValue} icon={kpiIcons.remainingValue} format="currency" delay={0.2} />
        <KPICard label="מסמכים חדשים" value={kpis.newDocuments} icon={kpiIcons.newDocuments} delay={0.25} />
        <KPICard label="דיווחים מהיום" value={kpis.todayReports} icon={kpiIcons.todayReports} delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>שווי ביצוע לפי פרויקט</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}K`} fontSize={12} />
                <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="completed" name="שבוצע" fill="#2563eb" radius={[0, 4, 4, 0]} />
                <Bar dataKey="remaining" name="נותר" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>התקדמות חודשית</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="planned" name="מתוכנן" stroke="#94a3b8" strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="actual" name="בפועל" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>פרויקטים אחרונים</CardTitle>
              <Link href="/projects" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                הצג הכל <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <div className="space-y-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="relative h-12 w-12 rounded-lg overflow-hidden flex-shrink-0">
                      <Image src={project.imageUrl} alt={project.name} fill className="object-cover" unoptimized />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                      <p className="text-xs text-gray-500">{project.contractNumber}</p>
                    </div>
                    <CircularProgress value={project.progress} size={44} strokeWidth={3} />
                    <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>פעילות אחרונה</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <div className="h-2 w-2 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatRelative(activity.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
