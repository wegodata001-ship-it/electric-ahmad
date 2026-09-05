import { DriverAppShell } from "@/apps/driver/driver-app-shell";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DriverAppShell>{children}</DriverAppShell>;
}
