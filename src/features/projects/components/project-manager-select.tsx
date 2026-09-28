"use client";

import { useEffect, useState } from "react";
import { projectService } from "@/services";

type Manager = { id: string; name: string };

export function ProjectManagerSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (ownerId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    projectService
      .listProjectManagers()
      .then((data) => {
        if (!cancelled) setManagers(data.items);
      })
      .catch(() => {
        if (!cancelled) setManagers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <select
      value={value}
      disabled={disabled || loading}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
      }
    >
      <option value="">טרם הוקצה מנהל פרויקט</option>
      {managers.map((manager) => (
        <option key={manager.id} value={manager.id}>
          {manager.name}
        </option>
      ))}
    </select>
  );
}
