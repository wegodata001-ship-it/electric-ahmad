import { redirect } from "next/navigation";

/** מסך הבית של מנהל תפעול = עץ הפרויקט */
export default function Page() {
  redirect("/operations/accounts");
}
