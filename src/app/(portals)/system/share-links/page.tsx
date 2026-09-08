import { redirect } from "next/navigation";

export default function Page() {
  redirect("/system/documents?tab=shares");
}
