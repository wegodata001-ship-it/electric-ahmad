import { prisma } from "../src/lib/prisma";
import { ProjectControlHubRepository } from "../src/repositories/project-control-hub.repository";

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SYSTEM_MANAGER", "ADMIN", "מנהל מערכת"] } },
    select: { id: true, role: true, name: true },
  });
  if (!admin) throw new Error("No admin user");

  const tree = await ProjectControlHubRepository.tree({
    userId: admin.id,
    role: admin.role,
  });

  const projectIds = new Set(tree.clients.flatMap((c) => c.projects.map((p) => p.id)));
  const siteProjects = tree.clients.flatMap((c) =>
    c.projects.filter((p) => p.sites.some((s) => s.projectId === undefined || true))
  );

  console.log(
    JSON.stringify(
      {
        admin: admin.role,
        clients: tree.totals.clients,
        projects: tree.totals.projects,
        sites: tree.totals.sites,
        uniqueProjects: projectIds.size,
        clientsWithProjects: tree.clients.filter((c) => c.projectCount > 0).length,
      },
      null,
      2
    )
  );

  if (tree.totals.projects !== projectIds.size) {
    throw new Error("Duplicate projects across clients");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
