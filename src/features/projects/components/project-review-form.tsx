"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { projectService } from "@/services";
import { formatCurrency } from "@/utils/format";
import type { ParsedBoqItem, ParsedContractBoqResult, ParsedProjectDetails } from "@/lib/ai/types";
import { cleanBoqDescription } from "@/utils/boq-text";

interface ProjectReviewFormProps {
  projectId: string;
  parseLogId: string;
  documentId: string;
  initialParsed: ParsedContractBoqResult | null;
  missingFields: string[];
  onRetry: () => void;
}

function Field({
  label,
  value,
  onChange,
  required,
  missing,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  required?: boolean;
  missing?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">
        {label} {required && "*"}
        {missing && (
          <span className="text-orange-600 mr-1">(לא זוהה — יש להשלים)</span>
        )}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={missing ? "border-orange-300" : undefined}
        required={required}
      />
    </div>
  );
}

export function ProjectReviewForm({
  projectId,
  parseLogId,
  documentId,
  initialParsed,
  missingFields: initialMissing,
  onRetry,
}: ProjectReviewFormProps) {
  const router = useRouter();
  const [project, setProject] = useState<ParsedProjectDetails>({
    name: initialParsed?.project.name ?? "",
    contractNumber: initialParsed?.project.contractNumber ?? "",
    contractor: initialParsed?.project.contractor ?? "",
    client: initialParsed?.project.client ?? "",
    location: initialParsed?.project.location ?? "",
    date: initialParsed?.project.date ?? "",
    contractValue: initialParsed?.project.contractValue ?? null,
    subtotal: initialParsed?.project.subtotal ?? null,
    vatPercent: initialParsed?.project.vatPercent ?? null,
    vatAmount: initialParsed?.project.vatAmount ?? null,
    totalWithVat: initialParsed?.project.totalWithVat ?? null,
    paymentTerms: initialParsed?.project.paymentTerms ?? "",
    currency: initialParsed?.project.currency ?? "ILS",
    notes: initialParsed?.project.notes ?? "",
  });
  const [items, setItems] = useState<ParsedBoqItem[]>(
    (initialParsed?.items ?? []).map((item) => ({
      ...item,
      description: cleanBoqDescription(item.description) || item.description,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = useMemo(() => new Set(initialMissing), [initialMissing]);

  const totals = useMemo(() => {
    const qty = items.reduce((s, i) => s + (Number(i.contractQuantity) || 0), 0);
    const value = items.reduce((s, i) => {
      if (i.totalPrice != null) return s + Number(i.totalPrice);
      return s + (Number(i.contractQuantity) || 0) * (Number(i.unitPrice) || 0);
    }, 0);
    return { qty, value };
  }, [items]);

  function updateItem(index: number, patch: Partial<ParsedBoqItem>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (
          (patch.contractQuantity != null || patch.unitPrice != null) &&
          next.contractQuantity != null &&
          next.unitPrice != null
        ) {
          next.totalPrice = Number(next.contractQuantity) * Number(next.unitPrice);
        }
        return next;
      })
    );
  }

  async function handleConfirm() {
    setError(null);
    setSaving(true);
    try {
      const result = await projectService.confirmParsed({
        projectId,
        parseLogId,
        project: {
          ...project,
          contractValue: Number(project.contractValue),
        },
        items: items as unknown as Record<string, unknown>[],
      });
      router.push(`/projects/${result.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה באישור הפרויקט");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">בדיקת נתונים מ-Gemini</h1>
          <p className="text-sm text-gray-500 mt-1">
            ערכו רק שדות חסרים או שגויים, ואשרו כדי ליצור את הפרויקט ואת כתב הכמויות
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onRetry} disabled={saving}>
            נסה שוב
          </Button>
          <Button onClick={handleConfirm} loading={saving}>
            אשר וצור פרויקט
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Card padding="lg">
        <h2 className="text-base font-semibold text-gray-900 mb-4">פרטי פרויקט</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            label="שם פרויקט"
            value={project.name ?? ""}
            onChange={(v) => setProject((p) => ({ ...p, name: v }))}
            required
            missing={missing.has("project.name")}
          />
          <Field
            label="מספר חוזה"
            value={project.contractNumber ?? ""}
            onChange={(v) => setProject((p) => ({ ...p, contractNumber: v }))}
            required
            missing={missing.has("project.contractNumber")}
          />
          <Field
            label="קבלן"
            value={project.contractor ?? ""}
            onChange={(v) => setProject((p) => ({ ...p, contractor: v }))}
            required
            missing={missing.has("project.contractor")}
          />
          <Field
            label="לקוח"
            value={project.client ?? ""}
            onChange={(v) => setProject((p) => ({ ...p, client: v }))}
            missing={missing.has("project.client")}
          />
          <Field
            label="מיקום"
            value={project.location ?? ""}
            onChange={(v) => setProject((p) => ({ ...p, location: v }))}
            required
            missing={missing.has("project.location")}
          />
          <Field
            label="תאריך"
            value={project.date ?? ""}
            onChange={(v) => setProject((p) => ({ ...p, date: v }))}
          />
          <Field
            label="שווי חוזה"
            type="number"
            value={project.contractValue ?? ""}
            onChange={(v) =>
              setProject((p) => ({ ...p, contractValue: v ? Number(v) : null }))
            }
            required
            missing={missing.has("project.contractValue")}
          />
          <Field
            label="סכום לפני מע״מ"
            type="number"
            value={project.subtotal ?? ""}
            onChange={(v) =>
              setProject((p) => ({ ...p, subtotal: v ? Number(v) : null }))
            }
            missing={missing.has("project.subtotal")}
          />
          <Field
            label="אחוז מע״מ"
            type="number"
            value={project.vatPercent ?? ""}
            onChange={(v) =>
              setProject((p) => ({ ...p, vatPercent: v ? Number(v) : null }))
            }
            missing={missing.has("project.vatPercent")}
          />
          <Field
            label="סכום מע״מ"
            type="number"
            value={project.vatAmount ?? ""}
            onChange={(v) =>
              setProject((p) => ({ ...p, vatAmount: v ? Number(v) : null }))
            }
            missing={missing.has("project.vatAmount")}
          />
          <Field
            label="סה״כ כולל מע״מ"
            type="number"
            value={project.totalWithVat ?? ""}
            onChange={(v) =>
              setProject((p) => ({
                ...p,
                totalWithVat: v ? Number(v) : null,
              }))
            }
            missing={missing.has("project.totalWithVat")}
          />
          <Field
            label="תנאי תשלום"
            value={project.paymentTerms ?? ""}
            onChange={(v) => setProject((p) => ({ ...p, paymentTerms: v }))}
          />
          <Field
            label="מטבע"
            value={project.currency ?? ""}
            onChange={(v) => setProject((p) => ({ ...p, currency: v }))}
          />
          <Field
            label="הערות"
            value={project.notes ?? ""}
            onChange={(v) => setProject((p) => ({ ...p, notes: v }))}
          />
        </div>
      </Card>

      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">כתב כמויות</h2>
          <p className="text-sm text-gray-500">
            {items.length} סעיפים · סה״כ {formatCurrency(totals.value)}
          </p>
        </div>

        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-xs text-gray-500">
              <tr>
                <th className="text-right px-3 py-2">קוד</th>
                <th className="text-right px-3 py-2">תיאור</th>
                <th className="text-right px-3 py-2">יחידה</th>
                <th className="text-right px-3 py-2">כמות</th>
                <th className="text-right px-3 py-2">מחיר</th>
                <th className="text-right px-3 py-2">סה״כ</th>
                <th className="text-right px-3 py-2">פרק</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-t border-gray-50">
                  <td className="px-2 py-1.5">
                    <Input
                      value={item.code ?? ""}
                      onChange={(e) => updateItem(index, { code: e.target.value })}
                      className="min-w-[80px]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={item.description ?? ""}
                      onChange={(e) =>
                        updateItem(index, { description: e.target.value })
                      }
                      className="min-w-[180px]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={item.unit ?? ""}
                      onChange={(e) => updateItem(index, { unit: e.target.value })}
                      className="min-w-[70px]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={item.contractQuantity ?? ""}
                      onChange={(e) =>
                        updateItem(index, {
                          contractQuantity: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="min-w-[90px]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      value={item.unitPrice ?? ""}
                      onChange={(e) =>
                        updateItem(index, {
                          unitPrice: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="min-w-[100px]"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                    {formatCurrency(Number(item.totalPrice) || 0)}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={item.chapter ?? ""}
                      onChange={(e) => updateItem(index, { chapter: e.target.value })}
                      className="min-w-[100px]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-gray-400 mt-4 text-center">
            לא זוהו סעיפים. אפשר לנסות שוב או להמשיך ידנית אחרי יצירת הפרויקט.
          </p>
        )}

        <p className="text-xs text-gray-400 mt-3">מסמך מקור: {documentId}</p>
      </Card>
    </div>
  );
}
