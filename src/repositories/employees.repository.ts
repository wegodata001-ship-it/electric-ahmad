import { prisma } from "@/lib/prisma";
import { mapEmployee } from "@/lib/mappers";

export class EmployeesRepository {
  static async findAll() {
    const rows = await prisma.employee.findMany({
      include: { projectLinks: true },
      orderBy: { firstName: "asc" },
    });
    return rows.map(mapEmployee);
  }

  static async findById(id: string) {
    const row = await prisma.employee.findUnique({
      where: { id },
      include: { projectLinks: true },
    });
    return row ? mapEmployee(row) : null;
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.employee.findMany({
      where: { projectLinks: { some: { projectId } } },
      include: { projectLinks: true },
    });
    return rows.map(mapEmployee);
  }

  static async findActive() {
    const rows = await prisma.employee.findMany({
      where: { status: "active" },
      include: { projectLinks: true },
    });
    return rows.map(mapEmployee);
  }

  /** Find or create a foreman employee by name (needed when DB is empty). */
  static async ensureForeman(fullName: string) {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || "מנהל";
    const lastName = parts.slice(1).join(" ") || "עבודה";

    const existing = await prisma.employee.findFirst({
      where: {
        firstName,
        lastName,
        role: { in: ["foreman", "manager"] },
      },
    });

    if (existing) return existing;

    return prisma.employee.create({
      data: {
        firstName,
        lastName,
        phone: "050-0000000",
        email: `foreman.${Date.now()}@wego-electric.co.il`,
        role: "foreman",
        status: "active",
        joinedAt: new Date(),
      },
    });
  }
}
