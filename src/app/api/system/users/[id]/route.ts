import { NextRequest } from "next/server";
import { requireUserManager } from "@/lib/auth/assert-office";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { updateSystemUserSchema } from "@/lib/validation/user-management";
import {
  SystemUserError,
  SystemUsersRepository,
} from "@/repositories/system-users.repository";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireUserManager();
    const { id } = await context.params;
    const user = await SystemUsersRepository.getById(id);
    if (!user) return apiError("משתמש לא נמצא", 404);
    return apiSuccess(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const admin = await requireUserManager();
    const { id } = await context.params;
    const input = await parseJsonBody(request, updateSystemUserSchema);
    return apiSuccess(
      await SystemUsersRepository.update(id, input, admin.userId)
    );
  } catch (error) {
    if (error instanceof SystemUserError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const admin = await requireUserManager();
    const { id } = await context.params;
    return apiSuccess(
      await SystemUsersRepository.deletePermanently(id, admin.userId)
    );
  } catch (error) {
    if (error instanceof SystemUserError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
