"use client";

import { DocumentActionBar, type DocumentAction } from "./document-action-bar";

export { DocumentActionBar, type DocumentAction };

/** Unified action bar slot for document / portal pages */
export function ActionBarContainer({
  children,
  actions,
}: {
  children?: React.ReactNode;
  actions?: DocumentAction[];
}) {
  const hasActions = actions && actions.some((a) => !a.hidden);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
      {hasActions ? (
        <DocumentActionBar actions={actions} />
      ) : (
        children ?? (
          <span className="text-xs text-gray-400">
            Action Bar — אין פעולות זמינות
          </span>
        )
      )}
    </div>
  );
}
