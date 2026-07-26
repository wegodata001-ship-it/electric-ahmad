import { redirect } from "next/navigation";

/** PM no longer uses ERP accounts tree — approvals app instead */
export default function Page() {
  redirect("/project/documents");
}
