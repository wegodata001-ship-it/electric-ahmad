"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SuccessDialog } from "@/components/ui/success-dialog";
import { useToast } from "@/components/ui";
import { Loader2, Save } from "lucide-react";
import { formatNumber } from "@/utils/format";

type BoqItemForReport = {
  id: string;
  code: string;
  description: string;
  unit: string;
  contractQuantity: number;
  completedQuantity: number;
  remainingQuantity: number;
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
};

type ExecutionReportModalProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  boqItems: BoqItemForReport[];
  foremen: Employee[];
  onSuccess: () => void;
};

export function ExecutionReportModal({
  open,
  onClose,
  projectId,
  boqItems,
  onSuccess,
}: ExecutionReportModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [savedItemCount, setSavedItemCount] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const handleQuantityChange = (boqItemId: string, value: string) => {
    setQuantities((prev) => ({
      ...prev,
      [boqItemId]: value,
    }));
  };

  const filledItems = useMemo(() => {
    return Object.entries(quantities).filter(
      ([_, value]) => value && parseFloat(value) > 0
    );
  }, [quantities]);

  const handleSubmit = async () => {
    try {
      if (filledItems.length === 0) {
        toast.error("יש למלא לפחות כמות אחת");
        return;
      }

      setLoading(true);

      const items = filledItems.map(([boqItemId, quantity]) => ({
        boqItemId,
        quantity: parseFloat(quantity),
        notes: "",
      }));

      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(`/api/projects/${projectId}/execution-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedAt: today,
          foremanId: undefined,
          notes: "",
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "שגיאה ביצירת דיווח");
      }

      await response.json();
      
      // Update BOQ data
      onSuccess();
      
      // Show success dialog
      setSavedItemCount(items.length);
      handleClose();
      setShowSuccessDialog(true);
    } catch (error: any) {
      console.error("Error creating execution report:", error);
      toast.error(error.message || "שגיאה ביצירת דיווח");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setQuantities({});
      onClose();
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="➕ הוסף דיווח ביצוע"
        size="xl"
      >
        <div className="flex flex-col max-h-[70vh]">
          <div className="flex-1 overflow-y-auto">
            {/* Simple Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">סעיף</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">תיאור</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">יחידה</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">כמות חוזה</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">בוצע עד היום</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">נותר</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 bg-primary-50">
                      כמות שבוצעה
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {boqItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm text-gray-900 font-mono">{item.code}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{item.description}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{item.unit}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{formatNumber(item.contractQuantity)}</td>
                      <td className="px-3 py-2 text-sm text-primary-600 font-medium">
                        {formatNumber(item.completedQuantity)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">{formatNumber(item.remainingQuantity)}</td>
                      <td className="px-3 py-2 bg-primary-50">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={item.remainingQuantity}
                          placeholder="0"
                          value={quantities[item.id] || ""}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="w-24 text-center"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {filledItems.length > 0 ? `${filledItems.length} סעיפים למלא` : "לא מולאו סעיפים"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                ביטול
              </Button>
              <Button onClick={handleSubmit} disabled={loading || filledItems.length === 0}>
                {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                <Save className="h-4 w-4 ml-2" />
                שמור דיווח
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <SuccessDialog
        open={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
        title="הדיווח נשמר בהצלחה"
        message="מה תרצה לעשות עכשיו?"
        itemCount={savedItemCount}
        primaryAction={{
          label: "צור חשבון עכשיו",
          onClick: () => {
            setShowSuccessDialog(false);
            router.push(`/invoices/new?projectId=${projectId}`);
          },
        }}
        secondaryAction={{
          label: "המשך עבודה",
          onClick: () => setShowSuccessDialog(false),
        }}
      />
    </>
  );
}
