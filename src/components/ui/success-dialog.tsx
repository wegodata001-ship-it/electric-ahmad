"use client";

import { Modal } from "./modal";
import { Button } from "./button";
import { CheckCircle } from "lucide-react";

interface SuccessDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  itemCount?: number;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function SuccessDialog({
  open,
  onClose,
  title,
  message,
  itemCount,
  primaryAction,
  secondaryAction,
}: SuccessDialogProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="text-center py-6">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        
        <p className="text-sm text-gray-600 mb-1">{message}</p>
        
        {itemCount !== undefined && (
          <p className="text-sm font-medium text-gray-700 mb-6">
            נוספו {itemCount} סעיפים שבוצעו
          </p>
        )}

        <div className="mt-6">
          <p className="text-sm text-gray-700 font-medium mb-4">
            מה תרצה לעשות עכשיו?
          </p>

          <div className="flex flex-col gap-3">
            {primaryAction && (
              <Button
                onClick={() => {
                  primaryAction.onClick();
                  onClose();
                }}
                variant="primary"
                className="w-full"
              >
                {primaryAction.label}
              </Button>
            )}

            {secondaryAction && (
              <Button
                onClick={() => {
                  secondaryAction.onClick();
                  onClose();
                }}
                variant="secondary"
                className="w-full"
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
