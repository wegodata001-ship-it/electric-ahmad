-- Preserve user history while introducing explicit login lifecycle states.
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

ALTER TABLE "User"
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Login identifiers are case-insensitive in application code, so enforce the
-- same invariant in PostgreSQL. Existing exact-case unique constraints remain.
CREATE UNIQUE INDEX "User_email_ci_key" ON "User" (lower("email"));
CREATE UNIQUE INDEX "User_username_ci_key"
  ON "User" (lower("username"))
  WHERE "username" IS NOT NULL;

ALTER TYPE "AuditAction" ADD VALUE 'USER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ROLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PROJECT_ASSIGNMENT_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_REACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET';
