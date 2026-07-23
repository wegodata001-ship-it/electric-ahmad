"use client";

import Link from "next/link";
import { BookOpen, Truck, FileText } from "lucide-react";

/** Field Documents Hub — entry to existing field document modules */
export function FieldDocumentsPage() {
  const cards = [
    {
      href: "/field/work-diaries",
      title: "יומני עבודה",
      desc: "טיוטות, שליחה לאישור וחתימת לקוח",
      icon: BookOpen,
    },
    {
      href: "/field/delivery-notes",
      title: "תעודות משלוח",
      desc: "תעודות שטח ומעקב סטטוס",
      icon: Truck,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">מסמכי שטח</h1>
        <p className="mt-1 text-sm text-gray-500">
          Documents Hub — גישה למסמכים דרך המודולים הקיימים (ללא מנוע מקביל)
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="flex items-start gap-3 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm transition hover:border-teal-300"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{c.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{c.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="flex items-center gap-2 text-xs text-gray-400">
        <FileText className="h-3.5 w-3.5" />
        ארכיון משרדי מלא זמין ב־Portal תפעול / פרויקט
      </p>
    </div>
  );
}
