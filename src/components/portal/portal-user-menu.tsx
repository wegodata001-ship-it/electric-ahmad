"use client";

import { LogOut, UserRound } from "lucide-react";

type Props = {
  userName?: string | null;
  onLogout: () => void;
  loggingOut?: boolean;
};

export function PortalUserMenu({ userName, onLogout, loggingOut }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 rounded-xl border border-gray-200 px-2.5 py-1.5 sm:flex">
        <UserRound className="h-4 w-4 text-gray-400" />
        <span className="max-w-[10rem] truncate text-xs font-medium text-gray-700">
          {userName || "משתמש"}
        </span>
      </div>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">
          {loggingOut ? "…" : "יציאה"}
        </span>
      </button>
    </div>
  );
}
