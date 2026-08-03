import { redirect } from "next/navigation";

/** Manual ops attendance UI removed — QR only */
export default function Page() {
  redirect("/operations/accounts");
}
