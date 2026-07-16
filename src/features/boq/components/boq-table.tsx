"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ClipboardPlus,
  History,
} from "lucide-react";
import type { BoqItem } from "@/types";
import { Badge, Button, Progress, Pagination } from "@/components/ui";
import { formatNumber, formatPercent } from "@/utils/format";
import { BOQ_STATUS_LABELS, BOQ_STATUS_COLORS } from "@/constants";
import { cn } from "@/lib/utils";
import { BoqExecutionDrawer } from "./boq-execution-drawer";
import { BoqExecutionHistoryDrawer } from "./boq-execution-history-drawer";

interface BoqTableProps {
  items: BoqItem[];
  showProject?: boolean;
  onItemsChanged?: () => void;
}

export function BoqTable({ items, onItemsChanged }: BoqTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [reportItem, setReportItem] = useState<BoqItem | null>(null);
  const [historyItem, setHistoryItem] = useState<BoqItem | null>(null);
  const [rows, setRows] = useState(items);

  useEffect(() => {
    setRows(items);
  }, [items]);

  const columns = useMemo<ColumnDef<BoqItem>[]>(
    () => [
      {
        id: "expand",
        header: "",
        size: 40,
        cell: ({ row }) => (
          <button
            onClick={() => row.toggleExpanded()}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {row.getIsExpanded() ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
        ),
      },
      {
        accessorKey: "code",
        header: "קוד",
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-sm font-mono text-gray-600">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "description",
        header: "תיאור",
        cell: ({ getValue }) => (
          <span className="text-sm font-medium text-gray-900 line-clamp-2">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "unit",
        header: "יחידה",
        size: 60,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-500">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "contractQuantity",
        header: "כמות חוזה",
        size: 90,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-900">
            {formatNumber(getValue() as number)}
          </span>
        ),
      },
      {
        id: "executedQuantity",
        accessorFn: (row) => row.executedQuantity ?? row.completedQuantity,
        header: "בוצע",
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-sm font-medium text-primary-600">
            {formatNumber(getValue() as number)}
          </span>
        ),
      },
      {
        accessorKey: "remainingQuantity",
        header: "נותר",
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-600">
            {formatNumber(getValue() as number)}
          </span>
        ),
      },
      {
        accessorKey: "invoicedQuantity",
        header: "חויב",
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-700">
            {formatNumber((getValue() as number) ?? 0)}
          </span>
        ),
      },
      {
        accessorKey: "availableForInvoice",
        header: "זמין לחשבון",
        size: 95,
        cell: ({ getValue }) => (
          <span className="text-sm font-medium text-emerald-700">
            {formatNumber((getValue() as number) ?? 0)}
          </span>
        ),
      },
      {
        accessorKey: "progress",
        header: "אחוז ביצוע",
        size: 120,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <div className="flex items-center gap-2">
              <Progress value={val} size="sm" className="w-16" />
              <span className="text-xs text-gray-500">{formatPercent(val)}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "סטטוס",
        size: 90,
        cell: ({ getValue }) => {
          const status = getValue() as BoqItem["status"];
          return (
            <Badge className={BOQ_STATUS_COLORS[status]}>
              {BOQ_STATUS_LABELS[status]}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "פעולות",
        size: 200,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                onClick={() => setReportItem(item)}
                title="דווח ביצוע בשטח"
              >
                <ClipboardPlus className="h-3.5 w-3.5" />
                דווח ביצוע
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHistoryItem(item)}
                title="היסטוריית ביצוע"
              >
                <History className="h-3.5 w-3.5" />
                היסטוריה
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, expanded, globalFilter },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      {toast && (
        <div className="px-4 py-2 bg-primary-50 text-primary-800 text-sm border-b border-primary-100 flex justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-primary-600">
            סגור
          </button>
        </div>
      )}

      <div className="p-3 sm:p-4 border-b border-gray-100">
        <input
          type="text"
          placeholder="חיפוש בסעיפים..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full max-w-sm h-11 md:h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>

      <div className="md:hidden space-y-3 p-3">
        {table.getRowModel().rows.map((row) => {
          const item = row.original;
          const executed = item.executedQuantity ?? item.completedQuantity;

          return (
            <article
              key={row.id}
              className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-gray-500">{item.code}</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {item.description}
                  </p>
                </div>
                <Badge className={BOQ_STATUS_COLORS[item.status]}>
                  {BOQ_STATUS_LABELS[item.status]}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-2">
                <Stat label="חוזה" value={`${formatNumber(item.contractQuantity)} ${item.unit}`} />
                <Stat label="בוצע" value={formatNumber(executed)} accent />
                <Stat label="נותר" value={formatNumber(item.remainingQuantity)} />
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>התקדמות</span>
                  <span>{formatPercent(item.progress)}</span>
                </div>
                <Progress value={item.progress} size="sm" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setReportItem(item)}
                >
                  <ClipboardPlus className="h-4 w-4" />
                  דיווח
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setHistoryItem(item)}
                >
                  <History className="h-4 w-4" />
                  היסטוריה
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-gray-100 bg-gray-50/50"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getCanSort() && (
                        <ChevronsUpDown className="h-3 w-3 text-gray-300" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  className={cn(
                    "border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                    row.getIsExpanded() && "bg-gray-50/30"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3 align-top">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-3 bg-gray-50/60">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <Stat
                          label="חוזה"
                          value={formatNumber(row.original.contractQuantity)}
                        />
                        <Stat
                          label="בוצע"
                          value={formatNumber(
                            row.original.executedQuantity ??
                              row.original.completedQuantity
                          )}
                          accent
                        />
                        <Stat
                          label="חויב"
                          value={formatNumber(row.original.invoicedQuantity ?? 0)}
                        />
                        <Stat
                          label="זמין לחשבון"
                          value={formatNumber(
                            row.original.availableForInvoice ?? 0
                          )}
                          good
                        />
                        <Stat
                          label="נותר מחוזה"
                          value={formatNumber(row.original.remainingQuantity)}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        כמויות בוצעו רק מדיווחי ביצוע · חיוב רק מכמות זמינה · כמות
                        חוזה קבועה
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 sm:p-4 border-t border-gray-100">
        <Pagination
          currentPage={table.getState().pagination.pageIndex + 1}
          totalPages={table.getPageCount()}
          onPageChange={(page) => table.setPageIndex(page - 1)}
        />
      </div>

      <BoqExecutionDrawer
        open={!!reportItem}
        item={reportItem}
        onClose={() => setReportItem(null)}
        onSaved={() => {
          setToast("דיווח הביצוע נשמר ועודכן בכתב הכמויות");
          onItemsChanged?.();
        }}
      />
      <BoqExecutionHistoryDrawer
        open={!!historyItem}
        item={historyItem}
        onClose={() => setHistoryItem(null)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  good,
}: {
  label: string;
  value: string;
  accent?: boolean;
  good?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p
        className={cn(
          "font-semibold",
          accent && "text-primary-700",
          good && "text-emerald-700"
        )}
      >
        {value}
      </p>
    </div>
  );
}
