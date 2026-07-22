"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, MapPin, Plus, Users } from "lucide-react";
import { projectService } from "@/services";
import type { Project } from "@/types";
import { Card, Badge, CircularProgress, Button, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/constants";

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80";

export function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    projectService.getAll().then(setProjects);
  }, []);

  const filtered =
    filter === "all" ? projects : projects.filter((p) => p.status === filter);

  const filters = [
    { id: "all", label: "\u05d4\u05db\u05dc" },
    { id: "active", label: "\u05e4\u05e2\u05d9\u05dc" },
    { id: "completed", label: "\u05d4\u05d5\u05e9\u05dc\u05dd" },
    { id: "on_hold", label: "\u05de\u05d5\u05e9\u05d4\u05d4" },
    { id: "planning", label: "\u05d1\u05ea\u05db\u05e0\u05d5\u05df" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {"\u05e4\u05e8\u05d5\u05d9\u05e7\u05d8\u05d9\u05dd"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {projects.length}{" "}
            {"\u05e4\u05e8\u05d5\u05d9\u05e7\u05d8\u05d9\u05dd \u05d1\u05de\u05e2\u05e8\u05db\u05ea"}
          </p>
        </div>
        <Button
          className="hidden md:inline-flex"
          onClick={() => router.push("/projects/new")}
        >
          <Plus className="h-4 w-4" />
          {"\u05e4\u05e8\u05d5\u05d9\u05e7\u05d8 \u05d7\u05d3\u05e9"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f.id
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6 text-gray-400" />}
          title={"\u05d0\u05d9\u05df \u05e4\u05e8\u05d5\u05d9\u05e7\u05d8\u05d9\u05dd \u05e2\u05d3\u05d9\u05d9\u05df"}
          description={
            "\u05e6\u05d5\u05e8 \u05e4\u05e8\u05d5\u05d9\u05e7\u05d8 \u05d7\u05d3\u05e9 \u05d5\u05d4\u05e2\u05dc\u05d4 PDF \u05d7\u05d5\u05d6\u05d4 / \u05db\u05ea\u05d1 \u05db\u05de\u05d5\u05d9\u05d5\u05ea \u05db\u05d3\u05d9 \u05dc\u05d4\u05ea\u05d7\u05d9\u05dc \u05dc\u05e2\u05d1\u05d5\u05d3"
          }
          action={
            <Button onClick={() => router.push("/projects/new")}>
              <Plus className="h-4 w-4" />
              {"\u05e4\u05e8\u05d5\u05d9\u05e7\u05d8 \u05d7\u05d3\u05e9"}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/invoices?projectId=${project.id}`}>
                <Card hover padding="none" className="overflow-hidden">
                  <div className="relative h-32 sm:h-40 w-full bg-gray-100">
                    <Image
                      src={project.imageUrl || PLACEHOLDER_IMAGE}
                      alt={project.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute top-3 left-3">
                      <Badge className={PROJECT_STATUS_COLORS[project.status]}>
                        {PROJECT_STATUS_LABELS[project.status]}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 sm:p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {project.name}
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      {project.contractNumber}
                    </p>

                    <div className="flex items-center justify-between mb-4">
                      <CircularProgress
                        value={project.progress}
                        size={56}
                        strokeWidth={4}
                      />
                      <div className="text-left space-y-1">
                        <div>
                          <p className="text-xs text-gray-400">
                            {"\u05e9\u05d5\u05d5\u05d9 \u05d7\u05d5\u05d6\u05d4"}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(project.contractValue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">
                            {"\u05e9\u05d1\u05d5\u05e6\u05e2"}
                          </p>
                          <p className="text-sm font-medium text-primary-600">
                            {formatCurrency(project.completedValue)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {project.location.split(" - ")[0]}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {project.employeeCount}{" "}
                        {"\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd"}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label={"\u05e4\u05e8\u05d5\u05d9\u05e7\u05d8 \u05d7\u05d3\u05e9"}
        onClick={() => router.push("/projects/new")}
        className="fixed bottom-5 left-5 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-transform active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
