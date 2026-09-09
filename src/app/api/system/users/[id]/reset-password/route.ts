import { NextRequest } from "next/server";
import { requireUserManager } from "@/lib/auth/assert-office";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { resetSystemUserPasswordSchema } from "@/lib/validation/user-management";
import {
  SystemUserError,
  SystemUsersRepository,
} from "@/repositories/system-users.repository";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const admin = await requireUserManager();
    const { id } = await context.params;
    const { password } = await parseJsonBody(
      request,
      resetSystemUserPasswordSchema
    );
    return apiSuccess(
      await SystemUsersRepository.resetPassword(id, password, admin.userId)
    );
  } catch (error) {
    if (error instanceof SystemUserError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
