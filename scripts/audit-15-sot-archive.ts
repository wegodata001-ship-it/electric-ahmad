import { WorkDiariesRepository } from "../src/repositories/work-diaries.repository";

async function main() {
  const items = await WorkDiariesRepository.archive({
    projectId: "cmrngypyq0001jx04vqi6h04p",
    take: 10,
  });
  const row = items.find((i: any) => i.id === "cmrw5rufz0002r15cozecgv8h");
  console.log("ARCHIVE_ROW", JSON.stringify(row, null, 2));
  const listed = await WorkDiariesRepository.list({
    projectId: "cmrngypyq0001jx04vqi6h04p",
    take: 10,
  });
  const listRow = listed.find((i: any) => i.id === "cmrw5rufz0002r15cozecgv8h");
  console.log("LIST_ROW", JSON.stringify(listRow, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
