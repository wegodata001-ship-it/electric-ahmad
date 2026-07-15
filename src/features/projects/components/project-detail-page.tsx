"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Users, FileText, ArrowRight, ClipboardList, Receipt, Package } from "lucide-react";
import { projectService } from "@/services";
import { employeeService } from "@/features/employees/services/employee.service";
import { documentService } from "@/features/documents/services/document.service";
import { activityService } from "@/features/activity/services/activity.service";
import type { Project, Employee, Document, Activity } from "@/types";
import {
  Card,
  Badge,
  CircularProgress,
  Progress,
  Tabs,
  Timeline,
  Avatar,
  Button,
} from "@/components/ui";
import { formatCurrency, formatNumber, formatDate } from "@/utils/format";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/constants";
import { projectTabs } from "@/config/navigation";

interface ProjectDetailPageProps {
  projectId: string;
}

export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    projectService.getById(projectId).then((p) => {
      if (!p) return;
      setProject(p);
    });
    employeeService.getByProject(projectId).then(setEmployees);
    documentService.getByProject(projectId).then(setDocuments);
    activityService.getByProject(projectId).then(setActivities);
  }, [projectId]);

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = projectTabs.map((tab) => ({
    ...tab,
    count:
      tab.id === "employees"
        ? employees.length
        : tab.id === "documents"
          ? documents.length
          : undefined,
  }));

  const hasValidImage =
    typeof project.imageUrl === "string" &&
    project.imageUrl.trim().length > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לפרויקטים
      </Link>

      <div className="relative rounded-2xl overflow-hidden h-48">
        {hasValidImage ? (
          <Image
            src={project.imageUrl}
            alt={project.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
            <div className="text-center">
              <ClipboardList className="h-16 w-16 text-primary-600 mx-auto mb-2" />
              <p className="text-sm text-primary-700 font-medium">{project.name}</p>
            </div>
          </div>
        )}
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

      <div className="flex gap-2 flex-wrap">
        <Link href={`/boq?projectId=${project.id}`}>
          <Button variant="outline" size="sm">
            <ClipboardList className="h-4 w-4" />
            כתב כמויות
          </Button>
        </Link>
        <Link href={`/invoices/new?projectId=${project.id}`}>
          <Button variant="outline" size="sm">
            <Receipt className="h-4 w-4" />
            חשבון חדש
          </Button>
        </Link>
        <Link href={`/delivery-notes/new?projectId=${project.id}`}>
          <Button variant="outline" size="sm">
            <Package className="h-4 w-4" />
            תעודת משלוח
          </Button>
        </Link>
        <Link href={`/reports`}>
          <Button variant="outline" size="sm">
            דיווחים
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "קבלן", value: project.contractor },
          { label: "מיקום", value: project.location, icon: MapPin },
          { label: "מנהל עבודה", value: project.foremanName },
          {
            label: "עובדים",
            value: `${project.employeeCount} עובדים`,
            icon: Users,
          },
        ].map((item) => (
          <Card key={item.label} padding="sm">
            <p className="text-xs text-gray-400 mb-1">{item.label}</p>
            <p className="text-sm font-medium text-gray-900">{item.value}</p>
          </Card>
        ))}
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {(activeTab === "overview" || activeTab === "status") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card padding="lg">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              סטטוס והתקדמות
            </h3>
            <Progress value={project.progress} size="lg" showLabel />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div>
                <p className="text-xs text-gray-400">שווי חוזה</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(project.contractValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">שווי שבוצע</p>
                <p className="text-lg font-semibold text-primary-600">
                  {formatCurrency(project.completedValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">התקדמות כספית</p>
                <p className="text-lg font-semibold">
                  {formatNumber(project.financialProgress ?? 0)}%
                </p>
              </div>
            </div>
            {project.description && (
              <p className="text-sm text-gray-600 mt-6 whitespace-pre-wrap">
                {project.description}
              </p>
            )}
          </Card>
          <Card padding="lg">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              פעילות אחרונה
            </h3>
            <Timeline
              items={activities.slice(0, 6).map((a) => ({
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
                  <p className="text-sm font-medium">
                    {formatNumber(emp.completedQuantity)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">פתוח</p>
                  <p className="text-sm font-medium">
                    {formatNumber(emp.openQuantity)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.length === 0 && (
            <Card padding="lg">
              <p className="text-sm text-gray-400 text-center">אין מסמכים בפרויקט</p>
            </Card>
          )}
          {documents.map((doc) => (
            <Card key={doc.id} hover>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {doc.uploadedBy} · {formatDate(doc.uploadedAt)}
                  </p>
                </div>
                <Badge variant="primary">{doc.type.toUpperCase()}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
