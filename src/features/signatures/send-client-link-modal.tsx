"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle, Smartphone, X } from "lucide-react";
import {
  buildSignShareMessage,
  emailShareLink,
  smsShareLink,
  whatsappShareLink,
  SIGN_KIND_LABEL,
  type SignableDocumentKind,
} from "@/lib/signatures";

type Props = {
  open: boolean;
  onClose: () => void;
  url: string;
  documentNumber: string;
  kind?: SignableDocumentKind;
  phone?: string | null;
  email?: string | null;
};

export function SendClientLinkModal({
  open,
  onClose,
  url,
  documentNumber,
  kind = "delivery_note",
  phone,
  email,
}: Props) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const kindLabel = SIGN_KIND_LABEL[kind];
  const message = buildSignShareMessage({ kindLabel, documentNumber, url });
  const wa = whatsappShareLink(phone || undefined, message);
  const sms = smsShareLink(phone || undefined, message);
  const mail = emailShareLink({
    email,
    subject: `${kindLabel} ${documentNumber} — לחתימה`,
    body: message,
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" dir="rtl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">שלח ללקוח לחתימה</h3>
          <button type="button" onClick={onClose} className="rounded-lg border p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-2 text-sm text-slate-500">
          קישור מאובטח ל־{kindLabel} {documentNumber}
        </p>
        <p className="mb-4 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {url}
        </p>
        <div className="grid gap-2">
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-bold text-white"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <a
            href={sms}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800"
          >
            <Smartphone className="h-4 w-4" />
            SMS
          </a>
          <a
            href={mail}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800"
          >
            <Mail className="h-4 w-4" />
            דוא״ל
          </a>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white"
          >
            <Copy className="h-4 w-4" />
            {copied ? "הועתק ✓" : "העתק קישור"}
          </button>
        </div>
      </div>
    </div>
  );
}
