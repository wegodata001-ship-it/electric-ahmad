import { NextRequest } from "next/server";
import { ForemenRepository } from "@/repositories/foremen.repository";
import { createFieldManagerAccount } from "@/lib/auth/create-field-manager";
import {
  requireOfficeAuth,
  requirePermission,
} from "@/lib/auth/assert-office";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    await requireOfficeAuth();
    const list = await ForemenRepository.listSummaries();
    return apiSuccess(list);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Create field manager Employee + FIELD_MANAGER system user. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requirePermission("manage_employees");
    const body = await request.json();

    if (
      !body.firstName ||
      !body.lastName ||
      !body.phone ||
      !body.username ||
      !body.password
    ) {
      return apiError("שם, טלפון, שם משתמש וסיסמה הם שדות חובה");
    }

    const created = await createFieldManagerAccount(
      {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        email: body.email,
        username: body.username,
        password: body.password,
        projectIds: body.projectIds,
      },
      userId
    );

    return apiSuccess(created, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
