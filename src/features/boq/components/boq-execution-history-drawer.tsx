"use client";

import { useEffect, useState } from "react";
import { Drawer, Badge, Card } from "@/components/ui";
import type { BoqItem } from "@/types";
import {
  boqExecutionService,
  EXECUTION_STATUS_LABELS,
  type BoqExecutionDto,
} from "@/features/boq/services/boq-execution.service";
import { formatDate, formatNumber, formatRelative } from "@/utils/format";
import { Camera, FileText, Video } from "lucide-react";
import Image from "next/image";

interface Props {
  open: boolean;
  item: BoqItem | null;
  onClose: () => void;
}

export function BoqExecutionHistoryDrawer({ open, item, onClose }: Props) {
  const [rows, setRows] = useState<BoqExecutionDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setLoading(true);
    boqExecutionService
      .getByBoqItem(item.id)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [open, item]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? `היסטוריית ביצוע · ${item.code}` : "היסטוריית ביצוע"}
      size="lg"
    >
      {loading && <p className="text-sm text-gray-400">טוען...</p>}
      {!loading && rows.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          אין דיווחי ביצוע לסעיף זה עדיין
        </p>
      )}

      <div className="relative space-y-4">
        {rows.map((exec, index) => (
          <div key={exec.id} className="relative pr-6">
            {index < rows.length - 1 && (
              <div className="absolute right-[7px] top-6 bottom-[-16px] w-px bg-gray-200" />
            )}
            <div className="absolute right-0 top-2 h-3.5 w-3.5 rounded-full bg-primary-500 border-2 border-white shadow" />
            <Card padding="md">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatNumber(exec.quantity)} {item?.unit}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(exec.executedAt)} ·{" "}
                    {formatRelative(exec.executedAt)}
                  </p>
                </div>
                <Badge className="bg-primary-50 text-primary-700 border-primary-200">
                  {EXECUTION_STATUS_LABELS[exec.status]}
                </Badge>
              </div>
              <div className="text-xs text-gray-600 space-y-0.5 mb-2">
                <p>עובד: {exec.employeeName}</p>
                {exec.foremanName && <p>מנהל עבודה: {exec.foremanName}</p>}
                <p className="text-gray-400">מקור: {exec.source}</p>
              </div>
              {exec.notes && (
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2 mb-2">
                  {exec.notes}
                </p>
              )}
              {(exec.media.length > 0 || exec.attachments.length > 0) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {exec.media
                    .filter((m) => m.type === "image")
                    .slice(0, 4)
                    .map((m) => (
                      <a
                        key={m.id}
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative h-14 w-14 rounded-lg overflow-hidden border border-gray-100"
                      >
                        <Image
                          src={m.url}
                          alt={m.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </a>
                    ))}
                  {exec.media.some((m) => m.type === "video") && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Video className="h-3.5 w-3.5" /> וידאו
                    </span>
                  )}
                  {exec.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary-700"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {a.name}
                    </a>
                  ))}
                  {exec.media.filter((m) => m.type === "image").length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Camera className="h-3.5 w-3.5" />
                      {exec.media.filter((m) => m.type === "image").length}
                    </span>
                  )}
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
