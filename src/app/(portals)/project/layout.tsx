import { ProjectAppShell } from "@/apps/project/project-app-shell";

export default function ProjectPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProjectAppShell>{children}</ProjectAppShell>;
}
