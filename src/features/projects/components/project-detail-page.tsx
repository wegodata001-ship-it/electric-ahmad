"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Users, FileText, ArrowRight } from "lucide-react";
import { projectService } from "@/services";
import { boqService } from "@/features/boq/services/boq.service";
import { employeeService } from "@/features/employees/services/employee.service";
import { reportService } from "@/features/reports/services/report.service";
import { documentService } from "@/features/documents/services/document.service";
import { galleryService } from "@/features/gallery/services/gallery.service";
import { activityService } from "@/features/activity/services/activity.service";
import type { Project, BoqItem, Employee, WorkReport, Document, GalleryItem, Activity } from "@/types";
import {
  Card,
  Badge,
  CircularProgress,
  Progress,
  Tabs,
  Timeline,
  Avatar,
} from "@/components/ui";
import { formatCurrency, formatNumber, formatRelative, formatDate } from "@/utils/format";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/constants";
import { BoqTable } from "@/features/boq/components/boq-table";

interface ProjectDetailPageProps {
  projectId: string;
}

export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    projectService.getById(projectId).then((p) => {
      if (!p) return;
      setProject(p);
    });
    boqService.getByProject(projectId).then(setBoqItems);
    employeeService.getByProject(projectId).then(setEmployees);
    reportService.getByProject(projectId).then(setReports);
    documentService.getByProject(projectId).then(setDocuments);
    galleryService.getByProject(projectId).then(setGallery);
    activityService.getByProject(projectId).then(setActivities);
  }, [projectId]);

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "סקירה" },
    { id: "boq", label: "כתב כמויות", count: boqItems.length },
    { id: "reports", label: "דיווחים", count: reports.length },
    { id: "employees", label: "עובדים", count: employees.length },
    { id: "documents", label: "מסמכים", count: documents.length },
    { id: "gallery", label: "גלריה", count: gallery.length },
    { id: "activity", label: "פעילות", count: activities.length },
    { id: "settings", label: "הגדרות" },
  ];

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowRight className="h-4 w-4" />
        חזרה לפרויקטים
      </Link>

      <div className="relative rounded-2xl overflow-hidden h-48">
        <Image src={project.imageUrl} alt={project.name} fill className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 right-0 left-0 p-6">
          <div className="flex items-end justify-between">
            <div>
              <Badge className={`${PROJECT_STATUS_COLORS[project.status]} mb-2`}>
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <p className="text-sm text-white/80 mt-1">{project.contractNumber}</p>
            </div>
            <CircularProgress value={project.progress} size={72} strokeWidth={5} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "קבלן", value: project.contractor },
          { label: "מיקום", value: project.location, icon: MapPin },
          { label: "מנהל עבודה", value: project.foremanName },
          { label: "עובדים", value: `${project.employeeCount} עובדים`, icon: Users },
        ].map((item) => (
          <Card key={item.label} padding="sm">
            <p className="text-xs text-gray-400 mb-1">{item.label}</p>
            <p className="text-sm font-medium text-gray-900">{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-400 mb-1">שווי חוזה</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(project.contractValue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">שווי שבוצע</p>
          <p className="text-xl font-bold text-primary-600">{formatCurrency(project.completedValue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">שווי נותר</p>
          <p className="text-xl font-bold text-gray-600">{formatCurrency(project.contractValue - project.completedValue)}</p>
        </Card>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card padding="lg">
            <h3 className="text-base font-semibold text-gray-900 mb-4">התקדמות כללית</h3>
            <Progress value={project.progress} size="lg" showLabel />
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div>
                <p className="text-xs text-gray-400">סעיפים</p>
                <p className="text-lg font-semibold">{boqItems.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">הושלמו</p>
                <p className="text-lg font-semibold text-green-600">
                  {boqItems.filter((b) => b.status === "completed").length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">בביצוע</p>
                <p className="text-lg font-semibold text-primary-600">
                  {boqItems.filter((b) => b.status === "in_progress").length}
                </p>
              </div>
            </div>
          </Card>
          <Card padding="lg">
            <h3 className="text-base font-semibold text-gray-900 mb-4">פעילות אחרונה</h3>
            <Timeline
              items={activities.slice(0, 5).map((a) => ({
                id: a.id,
                title: a.title,
                description: a.description,
                timestamp: a.createdAt,
                user: a.userName,
              }))}
            />
          </Card>
        </div>
      )}

      {activeTab === "boq" && <BoqTable items={boqItems} />}
      {activeTab === "reports" && (
        <Card padding="none">
          <div className="divide-y divide-gray-100">
            {reports.map((report) => (
              <div key={report.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <Avatar name={report.employeeName} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {report.employeeName} דיווח {report.quantity} {report.unit}
                  </p>
                  <p className="text-xs text-gray-500">{report.boqItemDescription} ({report.boqItemCode})</p>
                </div>
                <span className="text-xs text-gray-400">{formatRelative(report.reportedAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {activeTab === "employees" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <Card key={emp.id}>
              <div className="flex items-center gap-3">
                <Avatar src={emp.avatarUrl} name={emp.fullName} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{emp.fullName}</p>
                  <p className="text-xs text-gray-500">{emp.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-400">בוצע</p>
                  <p className="text-sm font-medium">{formatNumber(emp.completedQuantity)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">פתוח</p>
                  <p className="text-sm font-medium">{formatNumber(emp.openQuantity)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {activeTab === "documents" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => (
            <Card key={doc.id} hover>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500">{doc.uploadedBy} · {formatDate(doc.uploadedAt)}</p>
                </div>
                <Badge variant="primary">{doc.type.toUpperCase()}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
      {activeTab === "gallery" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {gallery.map((item) => (
            <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden group">
              <Image src={item.url} alt={item.title} fill className="object-cover" unoptimized />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                <div className="p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-white/70">{item.uploadedBy}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {activeTab === "activity" && (
        <Card padding="lg">
          <Timeline
            items={activities.map((a) => ({
              id: a.id,
              title: a.title,
              description: a.description,
              timestamp: a.createdAt,
              user: a.userName,
            }))}
          />
        </Card>
      )}
      {activeTab === "settings" && (
        <Card padding="lg">
          <h3 className="text-base font-semibold text-gray-900 mb-4">הגדרות פרויקט</h3>
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="text-sm text-gray-500">שם פרויקט</label>
              <p className="text-sm font-medium mt-1">{project.name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">מספר חוזה</label>
              <p className="text-sm font-medium mt-1">{project.contractNumber}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">תאריך התחלה</label>
              <p className="text-sm font-medium mt-1">{formatDate(project.startDate)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">תאריך סיום מתוכנן</label>
              <p className="text-sm font-medium mt-1">{formatDate(project.endDate)}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
