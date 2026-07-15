"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Modal, Button } from "@/components/ui";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const router = useRouter();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="פרויקט חדש"
      description="העלה PDF — Gemini יזהה את פרטי הפרויקט ואת כתב הכמויות"
      size="md"
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-primary-50 border border-primary-100 p-4 flex gap-3">
          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
            <FileText className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">העלאת PDF בלבד</p>
            <p className="text-xs text-gray-500 mt-1">
              אין צורך למלא פרטים ידנית. המערכת תנתח את החוזה ותציג מסך Review לאישור.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button
            onClick={() => {
              onClose();
              router.push("/projects/new");
            }}
          >
            המשך להעלאת PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}
