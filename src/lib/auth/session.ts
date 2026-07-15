import type { User } from "@/types";
import {
  OfficeAuthError,
  requireOfficeUser,
} from "@/lib/auth/office-session";

export interface AuthContext {
  userId: string;
  userName: string;
}

/**
 * Auth context for office APIs — reads the office session cookie.
 * Replaces the previous hardcoded admin stub.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const session = await requireOfficeUser();
  return { userId: session.userId, userName: session.userName };
}

export async function getCurrentUser(): Promise<User & { dbId: string }> {
  const session = await requireOfficeUser();
  return {
    id: session.userId,
    dbId: session.userId,
    name: session.userName,
    email: session.email,
    role: session.role,
    avatarUrl: session.avatarUrl,
  };
}

export { OfficeAuthError };
