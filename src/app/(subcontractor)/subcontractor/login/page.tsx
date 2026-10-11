import { redirect } from "next/navigation";
import { unifiedLoginHref } from "@/lib/auth/login-redirect";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function Page({ searchParams }: Props) {
  const { next } = await searchParams;
  redirect(unifiedLoginHref(next));
}
