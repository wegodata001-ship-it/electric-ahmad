"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-red-500 mb-4">שגיאה</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">משהו השתבש</h1>
        <p className="text-sm text-gray-500 mb-6">
          אירעה שגיאה בלתי צפויה. נסה שוב.
        </p>
        <Button onClick={reset}>נסה שוב</Button>
      </div>
    </div>
  );
}
