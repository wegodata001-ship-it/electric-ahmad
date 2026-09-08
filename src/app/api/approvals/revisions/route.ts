import { requireOfficeUser } from "@/lib/auth/office-session";
import { requireFieldManager } from "@/lib/auth/field-session";
import { isFieldManagerRole } from "@/lib/auth/roles";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * מסמכים שחזרו לתיקון — רק מה שהמשתמש רשאי לערוך.
 */
export async function GET() {
  try {
    let userId: string;
    let role: string;

    try {
      const office = await requireOfficeUser();
      userId = office.userId;
      role = office.role;
    } catch {
      const field = await requireFieldManager();
      userId = field.userId;
      role = field.role;
    }

    // Editors: field creator, or office roles that can touch documents
    if (
      !isFieldManagerRole(role) &&
      !canApproveDocuments(role)
    ) {
      return apiError("אין הרשאה לצפייה בתיקונים", 403);
    }

    const sheets = await MeasurementSheetsRepository.listNeedingFix(
      userId,
      role
    );

    return apiSuccess({
      items: sheets,
      count: sheets.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
