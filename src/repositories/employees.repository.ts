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
}
