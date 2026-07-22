"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { boqService } from "@/features/boq/services/boq.service";
import type { BoqItem } from "@/types";
import { BoqTable } from "@/features/boq/components/boq-table";
import { BoqItemFormModal } from "@/features/boq/components/boq-item-form-modal";
import { Button, Card, useToast } from "@/components/ui";
import { formatCurrency } from "@/utils/format";

export function ProjectBoqPanel({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<BoqItem[]>([]);
  const [showExceptionalModal, setShowExceptionalModal] = useState(false);

  function reload() {
    return boqService.getByProject(projectId).then(setItems);
  }

  useEffect(() => {
    reload().catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totalContract = items.reduce(
    (s, i) => s + i.contractQuantity * i.unitPrice,
    0
  );
  const exceptionalCount = items.filter((i) => i.itemKind === "exceptional").length;

  async function createExceptional(values: {
    code: string | null;
    description: string;
    unit: string;
    contractQuantity: number;
    unitPrice: number;
    category: string | null;
    notes: string | null;
    itemKind: "regular" | "exceptional";
    status: BoqItem["status"];
  }) {
    await boqService.create({
      projectId,
      ...values,
      itemKind: "exceptional",
    });
    toast.success("סעיף חריג נוסף");
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">כתב כמויות</h2>
          <p className="text-sm text-gray-500">ניהול סעיפים · עריכה והוספה</p>
        </div>
        <Button onClick={() => setShowExceptionalModal(true)}>
          <Plus className="h-4 w-4" />
          הוסף סעיף חריג
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card padding="md">
          <p className="text-xs text-gray-400">סעיפים</p>
          <p className="text-lg font-bold">{items.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-400">חריגים</p>
          <p className="text-lg font-bold text-amber-700">{exceptionalCount}</p>
        </Card>
        <Card padding="md" className="col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-400">שווי חוזה</p>
          <p className="text-lg font-bold text-primary-700">
            {formatCurrency(totalContract)}
          </p>
        </Card>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <BoqTable items={items} onItemsChanged={reload} />
      </div>

      <BoqItemFormModal
        open={showExceptionalModal}
        mode="create-exceptional"
        onClose={() => setShowExceptionalModal(false)}
        onSubmit={createExceptional}
      />
    </div>
  );
}
