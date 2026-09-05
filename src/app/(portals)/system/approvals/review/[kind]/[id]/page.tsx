import { ApprovalReviewPage } from "@/features/approvals/components/approval-review-page";

export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  return (
    <ApprovalReviewPage
      kind={kind as "work_diary" | "delivery_note" | "measurement_sheet"}
      documentId={id}
      backHref="/system/approvals"
    />
  );
}
