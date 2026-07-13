"use client";

import { cn } from "@/lib/utils";
import { formatRelative } from "@/utils/format";

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  icon?: React.ReactNode;
  user?: string;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-primary-50 border border-primary-200 flex items-center justify-center flex-shrink-0">
              {item.icon || <div className="h-2 w-2 rounded-full bg-primary-500" />}
            </div>
            {index < items.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
          </div>
          <div className="pb-6 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-medium text-gray-900">{item.title}</p>
              <span className="text-xs text-gray-400">{formatRelative(item.timestamp)}</span>
            </div>
            {item.description && (
              <p className="text-sm text-gray-500">{item.description}</p>
            )}
            {item.user && (
              <p className="text-xs text-gray-400 mt-1">{item.user}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
