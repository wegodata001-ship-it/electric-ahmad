import type { Employee } from "@/types";
import { FIRST_NAMES, LAST_NAMES } from "@/constants";
import { generateId, pick, randomInt, seededRandom } from "./generators";

const ROLES: Employee["role"][] = ["worker", "worker", "worker", "worker", "foreman", "engineer", "manager"];
const STATUSES: Employee["status"][] = ["active", "active", "active", "active", "on_leave", "inactive"];

export function generateEmployees(count = 20): Employee[] {
  const rand = seededRandom(42);
  const employees: Employee[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = pick(FIRST_NAMES, rand);
    const lastName = pick(LAST_NAMES, rand);
    const role = pick(ROLES, rand);
    const status = pick(STATUSES, rand);
    const completedQuantity = randomInt(10, 500, rand);
    const openQuantity = randomInt(0, 100, rand);

    employees.push({
      id: generateId("emp", i + 1),
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      phone: `05${randomInt(0, 9, rand)}-${String(randomInt(1000000, 9999999, rand))}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@wego-electric.co.il`,
      role,
      status,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${firstName}${lastName}&backgroundColor=2563eb`,
      projectIds: [],
      completedQuantity,
      openQuantity,
      joinedAt: new Date(2023, randomInt(0, 11, rand), randomInt(1, 28, rand)).toISOString(),
    });
  }

  return employees;
}

export const employees = generateEmployees(20);
