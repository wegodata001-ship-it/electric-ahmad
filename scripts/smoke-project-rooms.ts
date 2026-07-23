import { PrismaClient } from "@prisma/client";
import { ProjectRoomsRepository } from "../src/repositories/project-rooms.repository";

const p = new PrismaClient();

async function main() {
  const project = await p.project.findFirst({ where: { status: "active" } });
  if (!project) throw new Error("no project");
  await ProjectRoomsRepository.ensureMigrated(project.id);
  const before = await ProjectRoomsRepository.list(project.id, {
    includeHidden: true,
  });
  const room = await ProjectRoomsRepository.create(project.id, {
    name: `חדר חשמל ${Date.now()}`,
    floor: "א",
    code: "E-1",
  });
  const after = await ProjectRoomsRepository.list(project.id, {
    includeHidden: true,
  });
  const sheets = await p.measurementSheet.findMany({
    where: { projectId: project.id },
    include: { rows: { where: { projectRoomId: room.id } } },
  });
  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        before: before.length,
        after: after.length,
        room,
        syncedSheets: sheets.map((s) => ({ id: s.id, rows: s.rows.length })),
      },
      null,
      2
    )
  );
  await ProjectRoomsRepository.softDelete(room.id);
  console.log("deleted ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
