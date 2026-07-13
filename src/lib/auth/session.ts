import { prisma } from "@/lib/prisma";
import type { User } from "@/types";

const SYSTEM_USER_EMAIL = "admin@wego-electric.co.il";

export async function getCurrentUser(): Promise<User & { dbId: string }> {
  const user = await prisma.user.findUnique({
    where: { email: SYSTEM_USER_EMAIL },
  });

  if (!user) {
    throw new Error("משתמש מערכת לא נמצא. הרץ prisma db seed");
  }

  return {
    id: user.id,
    dbId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? "",
  };
}

export interface AuthContext {
  userId: string;
  userName: string;
}

export async function getAuthContext(): Promise<AuthContext> {
  const user = await getCurrentUser();
  return { userId: user.dbId, userName: user.name };
}
