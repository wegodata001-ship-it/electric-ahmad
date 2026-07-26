/** Parse manager reject comment produced by formatRejectComment */

export function parseRevisionFeedback(raw: string | null | undefined): {
  reason: string | null;
  notes: string;
  attachmentUrls: string[];
} {
  if (!raw?.trim()) {
    return { reason: null, notes: "", attachmentUrls: [] };
  }

  const lines = raw.split("\n");
  let reason: string | null = null;
  const noteLines: string[] = [];
  const attachmentUrls: string[] = [];
  let inAttachments = false;

  for (const line of lines) {
    const reasonMatch = line.match(/^\[סיבה:\s*(.+)\]$/);
    if (reasonMatch) {
      reason = reasonMatch[1].trim();
      continue;
    }
    if (line.trim() === "קבצים מצורפים לתיקון:") {
      inAttachments = true;
      continue;
    }
    if (inAttachments) {
      const url = line.replace(/^- /, "").trim();
      if (url) attachmentUrls.push(url);
      continue;
    }
    noteLines.push(line);
  }

  return {
    reason,
    notes: noteLines.join("\n").trim(),
    attachmentUrls,
  };
}

export function latestRejectionComment(
  approvals: { status?: string; comment?: string | null; decidedAt?: string | null }[] | undefined
): string | null {
  if (!approvals?.length) return null;
  const rejected = approvals
    .filter((a) => a.status === "rejected" && a.comment?.trim())
    .sort((a, b) => {
      const ta = a.decidedAt ? new Date(a.decidedAt).getTime() : 0;
      const tb = b.decidedAt ? new Date(b.decidedAt).getTime() : 0;
      return tb - ta;
    });
  return rejected[0]?.comment ?? null;
}
