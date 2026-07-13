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
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import type { BoqItem } from "@/types";
import { Badge, Progress, Pagination } from "@/components/ui";
import { formatCurrency, formatNumber, formatPercent } from "@/utils/format";
import { BOQ_STATUS_LABELS, BOQ_STATUS_COLORS } from "@/constants";
import { cn } from "@/lib/utils";
import { reportService } from "@/features/reports/services/report.service";
import type { WorkReport } from "@/types";
import { Avatar } from "@/components/ui";
import { formatRelative } from "@/utils/format";

function BoqRowDetail({ item }: { item: BoqItem }) {
  const [reports, setReports] = useState<WorkReport[]>([]);

  useEffect(() => {
    reportService.getAll().then((data) => {
      setReports(data.filter((r) => r.boqItemId === item.id).slice(0, 5));
    });
  }, [item.id]);

  return (
    <div className="p-4 bg-gray-50/80 border-t border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">דיווחים אחרונים</h4>
          {reports.length === 0 ? (
            <p className="text-sm text-gray-400">אין דיווחים לסעיף זה</p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={r.employeeName} size="sm" />
                  <span className="text-gray-700">
                    {r.employeeName} - {r.quantity} {r.unit}
                  </span>
                  <span className="text-xs text-gray-400 mr-auto">{formatRelative(r.reportedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">פירוט כמויות</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">כמות חוזה</span>
              <span className="font-medium">{formatNumber(item.contractQuantity)} {item.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">בוצע</span>
              <span className="font-medium text-primary-600">{formatNumber(item.completedQuantity)} {item.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">נותר</span>
              <span className="font-medium">{formatNumber(item.remainingQuantity)} {item.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">מחיר יחידה</span>
              <span className="font-medium">{formatCurrency(item.unitPrice)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BoqTableProps {
  items: BoqItem[];
  showProject?: boolean;
}

export function BoqTable({ items, showProject = false }: BoqTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<BoqItem>[]>(
    () => [
      {
        id: "expand",
        header: "",
        size: 40,
        cell: ({ row }) => (
          <button onClick={() => row.toggleExpanded()} className="p-1 hover:bg-gray-100 rounded">
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
          <span className="text-sm font-mono text-gray-600">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "description",
        header: "תיאור",
        cell: ({ getValue }) => (
          <span className="text-sm font-medium text-gray-900">{getValue() as string}</span>
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
          <span className="text-sm text-gray-900">{formatNumber(getValue() as number)}</span>
        ),
      },
      {
        accessorKey: "completedQuantity",
        header: "בוצע",
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-sm font-medium text-primary-600">{formatNumber(getValue() as number)}</span>
        ),
      },
      {
        accessorKey: "remainingQuantity",
        header: "נותר",
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-600">{formatNumber(getValue() as number)}</span>
        ),
      },
      {
        accessorKey: "progress",
        header: "אחוז",
        size: 100,
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
        accessorKey: "completedValue",
        header: "שווי שבוצע",
        size: 100,
        cell: ({ getValue }) => (
          <span className="text-sm text-primary-600">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        accessorKey: "remainingValue",
        header: "שווי נותר",
        size: 100,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-600">{formatCurrency(getValue() as number)}</span>
        ),
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
    ],
    []
  );

  const table = useReactTable({
    data: items,
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
      <div className="p-4 border-b border-gray-100">
        <input
          type="text"
          placeholder="חיפוש בסעיפים..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full max-w-sm h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-100 bg-gray-50/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
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
                  key={row.id}
                  className={cn(
                    "border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                    row.getIsExpanded() && "bg-gray-50/30"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr key={`${row.id}-expanded`}>
                    <td colSpan={columns.length}>
                      <BoqRowDetail item={row.original} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-100">
        <Pagination
          currentPage={table.getState().pagination.pageIndex + 1}
          totalPages={table.getPageCount()}
          onPageChange={(page) => table.setPageIndex(page - 1)}
        />
      </div>
    </div>
  );
}
