import { redirect } from "next/navigation";

/** מסך הבית של מנהל פרויקט = עץ הפרויקט */
export default function Page() {
  redirect("/project/accounts");
}
