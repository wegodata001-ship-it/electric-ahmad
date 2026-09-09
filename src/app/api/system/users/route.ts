import { NextRequest } from "next/server";
import { requireUserManager } from "@/lib/auth/assert-office";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { createSystemUserSchema } from "@/lib/validation/user-management";
import {
  SystemUserError,
  SystemUsersRepository,
} from "@/repositories/system-users.repository";

export async function GET() {
  try {
    await requireUserManager();
    return apiSuccess({ users: await SystemUsersRepository.list() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireUserManager();
    const input = await parseJsonBody(request, createSystemUserSchema);
    const user = await SystemUsersRepository.create(input, admin.userId);
    return apiSuccess(
      {
        user,
        temporaryCredentials: {
          username: input.username.trim().toLowerCase(),
          password: input.password,
        },
      },
      201
    );
  } catch (error) {
    if (error instanceof SystemUserError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
