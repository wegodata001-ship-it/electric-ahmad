"use client";

import { parseRevisionFeedback } from "@/lib/approvals/parse-revision-feedback";

export function RevisionFeedbackBanner({
  comment,
  dark = false,
}: {
  comment: string | null | undefined;
  dark?: boolean;
}) {
  if (!comment?.trim()) return null;
  const parsed = parseRevisionFeedback(comment);

  return (
    <div
      className={
        dark
          ? "space-y-2 rounded-2xl bg-orange-500/20 px-4 py-3 text-sm text-orange-50"
          : "space-y-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950"
      }
    >
      <p className="font-black">תיקון נדרש</p>
      {parsed.reason && (
        <p>
          <span className={dark ? "text-orange-200/80" : "text-orange-700"}>
            סיבה:{" "}
          </span>
          {parsed.reason}
        </p>
      )}
      {parsed.notes && (
        <p className="whitespace-pre-wrap">{parsed.notes}</p>
      )}
      {parsed.attachmentUrls.length > 0 && (
        <div>
          <p
            className={
              dark
                ? "mb-1 text-xs font-bold text-orange-200/80"
                : "mb-1 text-xs font-bold text-orange-700"
            }
          >
            קבצים מצורפים מהמנהל
          </p>
          <ul className="space-y-1">
            {parsed.attachmentUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline break-all"
                >
                  {url.split("/").pop() || url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
