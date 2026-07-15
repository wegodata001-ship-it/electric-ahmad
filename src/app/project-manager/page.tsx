import { redirect } from "next/navigation";

/** Alias entry — middleware enforces auth; when reached, go to dashboard. */
export default function ProjectManagerEntryPage() {
  redirect("/dashboard");
}
