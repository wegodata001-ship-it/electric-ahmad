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
  History,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import type { BoqItem } from "@/types";
import { Badge, Button, Pagination, useToast } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/utils/format";
import {
  BOQ_KIND_LABELS,
  BOQ_STATUS_COLORS,
  BOQ_STATUS_LABELS,
} from "@/constants";
import { cn } from "@/lib/utils";
import { boqService } from "@/features/boq/services/boq.service";
import { BoqItemFormModal } from "./boq-item-form-modal";
import { BoqItemHistoryModal } from "./boq-item-history-modal";

interface BoqTableProps {
  items: BoqItem[];
  showProject?: boolean;
  onItemsChanged?: () => void;
}

export function BoqTable({ items, onItemsChanged }: BoqTableProps) {
  const toast = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "regular" | "exceptional">("all");
  const [rows, setRows] = useState(items);
  const [editItem, setEditItem] = useState<BoqItem | null>(null);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);

  useEffect(() => {
    setRows(items);
  }, [items]);

  const visibleRows = useMemo(() => {
    if (kindFilter === "all") return rows;
    return rows.filter((r) =>
      kindFilter === "exceptional"
        ? r.itemKind === "exceptional"
        : r.itemKind !== "exceptional"
    );
  }, [rows, kindFilter]);

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
        size: 90,
        cell: ({ row, getValue }) => (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-mono text-gray-600">
              {getValue() as string}
            </span>
            {row.original.itemKind === "exceptional" && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">
                <Star className="h-2.5 w-2.5" />
                חריג
              </span>
            )}
          </div>
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
        accessorKey: "unitPrice",
        header: "מחיר יחידה",
        size: 100,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-900">
            {formatCurrency(getValue() as number)}
          </span>
        ),
      },
      {
        id: "total",
        header: "סה״כ",
        size: 110,
        accessorFn: (row) => row.contractQuantity * row.unitPrice,
        cell: ({ getValue }) => (
          <span className="text-sm font-semibold text-gray-900">
            {formatCurrency(getValue() as number)}
          </span>
        ),
      },
      {
        accessorKey: "itemKind",
        header: "סוג סעיף",
        size: 90,
        cell: ({ getValue }) => {
          const kind = (getValue() as BoqItem["itemKind"]) || "regular";
          return (
            <Badge
              className={
                kind === "exceptional"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-gray-50 text-gray-600 border-gray-200"
              }
            >
              {BOQ_KIND_LABELS[kind]}
            </Badge>
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
        size: 180,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditItem(item)}
                title="ערוך"
              >
                <Pencil className="h-3.5 w-3.5" />
                ערוך
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHistoryItemId(item.id)}
                title="היסטוריה"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleDelete(item)}
                title="מחק"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function handleDelete(item: BoqItem) {
    if (!window.confirm(`למחוק את הסעיף ${item.code}? המחיקה תישמר בהיסטוריה.`)) {
      return;
    }
    try {
      await boqService.remove(item.id);
      toast.success("הסעיף נמחק");
      onItemsChanged?.();
    } catch (e: any) {
      toast.error(e.message || "שגיאה במחיקה");
    }
  }

  const table = useReactTable({
    data: visibleRows,
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
      <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="חיפוש בסעיפים..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full max-w-sm h-11 md:h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
        <select
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm bg-white"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
        >
          <option value="all">כל הסוגים</option>
          <option value="regular">רגילים</option>
          <option value="exceptional">חריגים</option>
        </select>
      </div>

      <div className="md:hidden space-y-3 p-3">
        {table.getRowModel().rows.map((row) => {
          const item = row.original;
          return (
            <article
              key={row.id}
              className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs text-gray-500">{item.code}</p>
                    {item.itemKind === "exceptional" && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                        חריג
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold text-gray-900">{item.description}</p>
                </div>
                <Badge className={BOQ_STATUS_COLORS[item.status]}>
                  {BOQ_STATUS_LABELS[item.status]}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-2 text-xs">
                <div>
                  <p className="text-gray-400">כמות</p>
                  <p className="font-semibold">
                    {formatNumber(item.contractQuantity)} {item.unit}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">מחיר</p>
                  <p className="font-semibold">{formatCurrency(item.unitPrice)}</p>
                </div>
                <div>
                  <p className="text-gray-400">סה״כ</p>
                  <p className="font-semibold">
                    {formatCurrency(item.contractQuantity * item.unitPrice)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                <Button size="sm" className="w-full" onClick={() => setEditItem(item)}>
                  <Pencil className="h-4 w-4" />
                  ערוך
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setHistoryItemId(item.id)}
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-red-600"
                  onClick={() => handleDelete(item)}
                >
                  <Trash2 className="h-4 w-4" />
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-400">קטגוריה</p>
                          <p className="font-medium">{row.original.category || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">סוג</p>
                          <p className="font-medium">
                            {BOQ_KIND_LABELS[row.original.itemKind || "regular"]}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-400">הערות</p>
                          <p className="font-medium whitespace-pre-wrap">
                            {row.original.notes || "—"}
                          </p>
                        </div>
                      </div>
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

      <BoqItemFormModal
        open={!!editItem}
        mode="edit"
        item={editItem}
        onClose={() => setEditItem(null)}
        onSubmit={async (values) => {
          if (!editItem) return;
          await boqService.update(editItem.id, values);
          toast.success("הסעיף עודכן");
          onItemsChanged?.();
        }}
      />

      <BoqItemHistoryModal
        open={!!historyItemId}
        itemId={historyItemId}
        onClose={() => setHistoryItemId(null)}
      />
    </div>
  );
}
