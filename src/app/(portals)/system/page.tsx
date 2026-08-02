import { redirect } from "next/navigation";

/** מסך הבית של ADMIN = עץ הפרויקט (לא Dashboard כללי) */
export default function Page() {
  redirect("/system/accounts");
}
