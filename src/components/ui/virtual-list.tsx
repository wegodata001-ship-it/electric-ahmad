"use client";

import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

type VirtualListProps<T> = {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  className?: string;
  /** Fixed viewport height (required for windowing). */
  height: number | string;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Infinite scroll: called near the end when hasMore. */
  onEndReached?: () => void;
  hasMore?: boolean;
  endReachedThreshold?: number;
  loadingMore?: boolean;
  empty?: ReactNode;
};

/**
 * Windowed list — same visual rows, fewer DOM nodes.
 * No design chrome; parent supplies row markup via renderItem.
 */
export function VirtualList<T>({
  items,
  estimateSize = 72,
  overscan = 8,
  className,
  height,
  getKey,
  renderItem,
  onEndReached,
  hasMore = false,
  endReachedThreshold = 8,
  loadingMore = false,
  empty,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const lastTriggered = useRef(0);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (items.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{ height }}
      onScroll={() => {
        if (!hasMore || !onEndReached || loadingMore) return;
        const last = virtualItems[virtualItems.length - 1];
        if (!last) return;
        if (last.index < items.length - endReachedThreshold) return;
        const now = Date.now();
        if (now - lastTriggered.current < 400) return;
        lastTriggered.current = now;
        onEndReached();
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((v) => {
          const item = items[v.index];
          return (
            <div
              key={getKey(item, v.index)}
              data-index={v.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${v.start}px)`,
              }}
            >
              {renderItem(item, v.index)}
            </div>
          );
        })}
      </div>
      {loadingMore && (
        <div className="py-3 text-center text-xs text-stone-400">טוען…</div>
      )}
    </div>
  );
}
