import type { BoqItem, BoqItemStatus } from "@/types";
import { BOQ_ITEMS } from "@/constants";
import { projects } from "./projects";
import { generateId, pick, randomInt, seededRandom } from "./generators";

function getStatus(completed: number, total: number): BoqItemStatus {
  if (completed === 0) return "not_started";
  if (completed >= total) return "completed";
  return "in_progress";
}

export function generateBoqItems(): BoqItem[] {
  const rand = seededRandom(200);
  const items: BoqItem[] = [];
  let globalIndex = 0;

  projects.forEach((project) => {
    const itemCount = randomInt(10, 15, rand);

    for (let i = 0; i < itemCount; i++) {
      const template = BOQ_ITEMS[i % BOQ_ITEMS.length];
      const contractQuantity = randomInt(10, 200, rand);
      const completedQuantity = randomInt(0, contractQuantity, rand);
      const remainingQuantity = contractQuantity - completedQuantity;
      const unitPrice = randomInt(50, 5000, rand);
      const completedValue = completedQuantity * unitPrice;
      const remainingValue = remainingQuantity * unitPrice;
      const progress = contractQuantity > 0 ? (completedQuantity / contractQuantity) * 100 : 0;

      globalIndex++;
      items.push({
        id: generateId("boq", globalIndex),
        projectId: project.id,
        code: `${template.code}`,
        description: template.description,
        unit: template.unit,
        contractQuantity,
        completedQuantity,
        remainingQuantity,
        unitPrice,
        completedValue,
        remainingValue,
        progress: Math.round(progress * 10) / 10,
        status: getStatus(completedQuantity, contractQuantity),
        level: 0,
        createdAt: project.createdAt,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  return items;
}

export const boqItems = generateBoqItems();
