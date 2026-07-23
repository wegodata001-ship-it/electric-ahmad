"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { ConversationMessage } from "@/lib/engines/conversation";
import { formatRelative } from "@/utils/format";
import { ActionBarContainer } from "@/components/portal";

export function ConversationCenterPage() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId") ?? "";

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const reload = useCallback(() => {
    if (!documentId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError(null);
    apiClient
      .get<{ documentId: string; messages: ConversationMessage[] }>(
        `/api/workflow/documents/${documentId}/conversation`
      )
      .then((data) => setMessages(data.messages))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function sendMessage() {
    const text = body.trim();
    if (!documentId || !text) return;
    setSending(true);
    setError(null);
    try {
      const message = await apiClient.post<ConversationMessage>(
        `/api/workflow/documents/${documentId}/conversation`,
        { body: text }
      );
      setMessages((prev) => [...prev, message]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחה");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">שיחות מסמך</h1>
        <p className="mt-1 text-sm text-gray-500">
          הודעות נשמרות ב-Timeline (conversation.message)
        </p>
      </div>

      <label className="block text-sm font-semibold text-gray-700">
        מזהה מסמך (documentId)
        <input
          readOnly
          value={documentId}
          placeholder="?documentId=..."
          className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
        />
      </label>

      {!documentId && (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
          הוסף פרמטר documentId בכתובת, למשל{" "}
          <code className="text-xs">?documentId=clx...</code>
        </p>
      )}

      {documentId && (
        <>
          <ActionBarContainer
            actions={[
              {
                id: "refresh",
                label: "רענון",
                icon: RefreshCw,
                onClick: reload,
              },
            ]}
          />

          {error && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {loading && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                טוען...
              </p>
            )}
            {!loading && messages.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                אין הודעות עדיין
              </p>
            )}
            {!loading && messages.length > 0 && (
              <ul className="max-h-[420px] divide-y divide-gray-100 overflow-y-auto">
                {messages.map((msg) => (
                  <li key={msg.id} className="px-4 py-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {msg.actorName ?? "משתמש"}
                      <span className="font-normal text-gray-400">
                        · {formatRelative(msg.createdAt)}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                      {msg.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-gray-100 p-3">
              <div className="flex gap-2">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={2}
                  placeholder="כתוב הודעה..."
                  className="min-h-[44px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={sending || !body.trim()}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--portal-accent,#1d4ed8)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {sending ? "..." : "שלח"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
