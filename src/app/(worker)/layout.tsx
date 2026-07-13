import { WorkerLayout } from "@/components/layout/worker-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <WorkerLayout>{children}</WorkerLayout>;
}
