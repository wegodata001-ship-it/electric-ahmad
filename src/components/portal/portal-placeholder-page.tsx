"use client";

export function PortalPlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {description ?? "מסך שלד · ייפתח בשלב מאוחר יותר"}
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        Placeholder — אין תוכן עסקי ב־P1
      </div>
    </div>
  );
}
