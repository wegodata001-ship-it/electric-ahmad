import { randomUUID } from "node:crypto";

/** App-side id for raw SQL inserts (Prisma defaults are not applied). */
export function newDbId(): string {
  return randomUUID().replace(/-/g, "");
}
