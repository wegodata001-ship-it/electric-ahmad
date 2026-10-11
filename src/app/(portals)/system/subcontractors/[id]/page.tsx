"use client";

import { useParams } from "next/navigation";
import { SubcontractorCard } from "@/features/subcontractors/components/subcontractor-card";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <SubcontractorCard id={String(params.id)} />;
}
