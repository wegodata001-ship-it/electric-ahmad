"use client";

import { useEffect, useState } from "react";
import { Drawer, Button, Card, Input, Progress, Badge } from "@/components/ui";
import type { BoqItem, Employee } from "@/types";
import { employeeService } from "@/features/employees/services/employee.service";
import {
  boqExecutionService,
  EXECUTION_STATUS_LABELS,
  type ExecutionStatus,
} from "@/features/boq/services/boq-execution.service";
import { formatNumber, formatPercent } from "@/utils/format";
import { Camera, FileText, Video } from "lucide-react";

interface BoqExecutionDrawerProps {
  open: boolean;
  item: BoqItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function BoqExecutionDrawer({
  open,
  item,
  onClose,
  onSaved,
}: BoqExecutionDrawerProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [quantity, setQuantity] = useState("");
  const [executedAt, setExecutedAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [employeeId, setEmployeeId] = useState("");
  const [foremanId, setForemanId] = useState("");
  const [status, setStatus] = useState<ExecutionStatus>("in_progress");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    setQuantity("");
    setExecutedAt(new Date().toISOString().slice(0, 10));
    setStatus("in_progress");
    setNotes("");
    setImages([]);
    setVideos([]);
    setDocs([]);
    setError(null);

    employeeService.getByProject(item.projectId).then((list) => {
      setEmployees(list);
      const workers = list.filter((e) => e.role === "worker" || e.role === "foreman");
      const foremen = list.filter(
        (e) => e.role === "foreman" || e.role === "manager"
      );
      setEmployeeId(workers[0]?.id ?? list[0]?.id ?? "");
      setForemanId(foremen[0]?.id ?? "");
    });
  }, [open, item]);

  if (!item) return null;

  const executed = item.executedQuantity ?? item.completedQuantity;
  const remaining = item.remainingQuantity;

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      const qty = Number(quantity);
      if (!(qty > 0)) throw new Error("יש להזין כמות שבוצעה");
      if (!employeeId) throw new Error("יש לבחור עובד מבצע");

      const execution = await boqExecutionService.create({
        projectId: item.projectId,
        boqItemId: item.id,
        employeeId,
        foremanId: foremanId || null,
        quantity: qty,
        executedAt,
        status,
        notes,
        source: "office",
      });

      const files = [...images, ...videos, ...docs];
      for (const file of files) {
        await boqExecutionService.uploadFile(execution.id, file);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירת דיווח");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="דווח ביצוע" size="xl">
      <div className="space-y-5">
        <Card padding="md" className="bg-primary-50/40 border-primary-100">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-mono text-gray-500">{item.code}</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {item.description}
              </p>
              <p className="text-xs text-gray-500 mt-1">יחידה: {item.unit}</p>
            </div>
            <Badge className="bg-white text-primary-700 border-primary-200">
              {formatPercent(item.progress)}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm mb-3">
            <div>
              <p className="text-xs text-gray-500">כמות חוזה</p>
              <p className="font-semibold">{formatNumber(item.contractQuantity)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">בוצע עד היום</p>
              <p className="font-semibold text-primary-700">
                {formatNumber(executed)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">נותר</p>
              <p className="font-semibold">{formatNumber(remaining)}</p>
            </div>
          </div>
          <Progress value={item.progress} size="lg" showLabel />
        </Card>

        <Card padding="lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">ביצוע חדש</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                כמות שבוצעה *
              </label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                step="any"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                תאריך ביצוע
              </label>
              <Input
                type="date"
                value={executedAt}
                onChange={(e) => setExecutedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                עובד מבצע *
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">בחר עובד</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                מנהל עבודה
              </label>
              <select
                value={foremanId}
                onChange={(e) => setForemanId(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">ללא</option>
                {employees
                  .filter(
                    (e) =>
                      e.role === "foreman" ||
                      e.role === "manager" ||
                      e.role === "engineer"
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">
                שלב ביצוע
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ExecutionStatus)}
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg"
              >
                {(
                  [
                    "not_started",
                    "in_progress",
                    "partially_completed",
                    "completed",
                    "finished",
                  ] as ExecutionStatus[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {EXECUTION_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">הערות</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y"
                placeholder="פרטי ביצוע, הערות שטח..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <FilePicker
              icon={<Camera className="h-4 w-4" />}
              label="תמונות"
              accept="image/*"
              files={images}
              onChange={setImages}
            />
            <FilePicker
              icon={<Video className="h-4 w-4" />}
              label="סרטונים"
              accept="video/*"
              files={videos}
              onChange={setVideos}
            />
            <FilePicker
              icon={<FileText className="h-4 w-4" />}
              label="מסמכים"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              files={docs}
              onChange={setDocs}
            />
          </div>
        </Card>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end sticky bottom-0 bg-white pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSave} loading={saving}>
            שמור דיווח
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function FilePicker({
  icon,
  label,
  accept,
  files,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  accept: string;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <div className="border border-dashed border-gray-200 rounded-lg p-3">
      <label className="flex flex-col items-center gap-1 cursor-pointer text-sm text-gray-600">
        {icon}
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">
          {files.length ? `${files.length} קבצים` : "לחץ לבחירה"}
        </span>
        <input
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(Array.from(e.target.files ?? []))}
        />
      </label>
    </div>
  );
}
