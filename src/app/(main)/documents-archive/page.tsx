import { redirect } from "next/navigation";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import {
  OPERATIONS_MANAGER_ROLE,
  PROJECT_MANAGER_ROLE,
} from "@/lib/auth/roles";

export default async function Page() {
  const user = await requireOfficeUser();
  if (isSystemAdminRole(user.role)) {
    redirect("/system/documents?tab=archive");
  }
  if (user.role === PROJECT_MANAGER_ROLE) {
    redirect("/project/documents?tab=archive");
  }
  if (user.role === OPERATIONS_MANAGER_ROLE) {
    redirect("/operations/documents?tab=archive");
  }
  redirect("/dashboard");
}
