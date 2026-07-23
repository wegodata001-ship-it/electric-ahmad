import { whatsappShareUrl } from "@/lib/documents/sign-tokens";

export type WhatsAppChannel = "internal" | "external";

export type WhatsAppShareRequest = {
  channel: WhatsAppChannel;
  phone?: string | null;
  message: string;
};

export const WHATSAPP_CHANNEL_LABELS: Record<WhatsAppChannel, string> = {
  internal: "פנימי (משתמש מערכת)",
  external: "חיצוני (לקוח / גורם חיצוני)",
};

/** Single WhatsApp Hub entry — wraps wa.me share URL builder. */
export function buildWhatsAppShareUrl(req: WhatsAppShareRequest): string {
  return whatsappShareUrl(req.phone, req.message);
}

export function defaultWhatsAppMessage(
  channel: WhatsAppChannel,
  context: { documentNumber?: string; link?: string; recipientName?: string }
): string {
  const name = context.recipientName?.trim();
  const greeting = name ? `שלום ${name},` : "שלום,";
  const doc = context.documentNumber ? ` (${context.documentNumber})` : "";
  const link = context.link ? `\n${context.link}` : "";

  if (channel === "internal") {
    return `${greeting}\n\nמסמך${doc} ממתין לטיפולך.${link}\n\nתודה.`;
  }

  return `${greeting}\n\nמצורף מסמך${doc} לבדיקתך ולחתימה.${link}\n\nתודה.`;
}
