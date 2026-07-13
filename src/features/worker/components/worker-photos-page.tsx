"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { employeeService } from "@/features/employees/services/employee.service";
import { reportService } from "@/features/reports/services/report.service";

export function WorkerPhotosPage() {
  const [photos, setPhotos] = useState<{ url: string; title: string; date: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employeeService.getAll().then((employees) => {
      const worker = employees.find((e) => e.role === "worker") ?? employees[0];
      if (!worker) {
        setLoading(false);
        return;
      }
      reportService.getByEmployee(worker.id).then((reports) => {
        const allPhotos = reports
          .filter((r) => r.photoUrls.length > 0)
          .flatMap((r) =>
            r.photoUrls.map((url) => ({
              url,
              title: r.boqItemDescription,
              date: r.reportedAt,
            }))
          );
        setPhotos(allPhotos);
        setLoading(false);
      });
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">התמונות שלי</h1>
        <p className="text-sm text-gray-500 mt-1">{photos.length} תמונות</p>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">אין תמונות עדיין</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
              <Image src={photo.url} alt={photo.title} fill className="object-cover" unoptimized />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
