"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MessageSquare, Send } from "lucide-react";
import {
  WHATSAPP_CHANNEL_LABELS,
  buildWhatsAppShareUrl,
  defaultWhatsAppMessage,
  type WhatsAppChannel,
} from "@/lib/engines/whatsapp-hub";
import { ActionBarContainer } from "@/components/portal";

export function WhatsAppHubPage() {
  const [channel, setChannel] = useState<WhatsAppChannel>("external");
  const [phone, setPhone] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [link, setLink] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState(() =>
    defaultWhatsAppMessage("external", {})
  );

  const shareUrl = useMemo(
    () => buildWhatsAppShareUrl({ channel, phone, message }),
    [channel, phone, message]
  );

  function applyTemplate(nextChannel: WhatsAppChannel) {
    setChannel(nextChannel);
    setMessage(
      defaultWhatsAppMessage(nextChannel, {
        documentNumber: documentNumber || undefined,
        link: link || undefined,
        recipientName: recipientName || undefined,
      })
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">WhatsApp Hub</h1>
        <p className="mt-1 text-sm text-gray-500">
          שליחה פנימית או חיצונית דרך מנוע WhatsApp משותף
        </p>
      </div>

      <ActionBarContainer
        actions={[
          {
            id: "internal",
            label: "תבנית פנימית",
            icon: MessageSquare,
            variant: channel === "internal" ? "primary" : "default",
            onClick: () => applyTemplate("internal"),
          },
          {
            id: "external",
            label: "תבנית חיצונית",
            icon: Send,
            variant: channel === "external" ? "primary" : "default",
            onClick: () => applyTemplate("external"),
          },
          {
            id: "open",
            label: "פתח WhatsApp",
            icon: ExternalLink,
            href: shareUrl,
            variant: "primary",
          },
        ]}
      />

      <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            סוג שליחה
            <select
              value={channel}
              onChange={(e) => applyTemplate(e.target.value as WhatsAppChannel)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="internal">{WHATSAPP_CHANNEL_LABELS.internal}</option>
              <option value="external">{WHATSAPP_CHANNEL_LABELS.external}</option>
            </select>
          </label>

          <label className="block text-sm font-semibold text-gray-700">
            טלפון (אופציונלי)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0501234567"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-semibold text-gray-700">
            מספר מסמך
            <input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-semibold text-gray-700">
            קישור
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-semibold text-gray-700">
            שם נמען
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            הודעה
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <p className="break-all text-[11px] text-gray-400">{shareUrl}</p>
        </div>
      </div>
    </div>
  );
}
