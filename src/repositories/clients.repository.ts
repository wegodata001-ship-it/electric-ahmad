import { prisma } from "@/lib/prisma";

function mapClient(row: {
  id: string;
  clientNumber: string | null;
  name: string;
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    clientNumber: row.clientNumber,
    name: row.name,
    companyName: row.companyName,
    contactName: row.contactName,
    phone: row.phone,
    phoneSecondary: row.phoneSecondary,
    address: row.address,
    city: row.city,
    email: row.email,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CreateClientInput = {
  name: string;
  clientNumber?: string;
  companyName?: string;
  contactName?: string;
  phone?: string;
  phoneSecondary?: string;
  address?: string;
  city?: string;
  email?: string;
  notes?: string;
};

export class ClientsRepository {
  /** Import unique project contractors / DN client names into Client cards (idempotent). */
  static async syncFromExistingData(userId: string) {
    const [projects, notes] = await Promise.all([
      prisma.project.findMany({
        where: { deletedAt: null },
        select: { contractor: true, location: true },
        distinct: ["contractor"],
      }),
      prisma.deliveryNote.findMany({
        select: { client: true, contactName: true, phone: true, address: true, city: true },
        distinct: ["client"],
      }),
    ]);

    const names = new Set<string>();
    for (const p of projects) {
      const n = p.contractor?.trim();
      if (n) names.add(n);
    }
    for (const n of notes) {
      const name = n.client?.trim();
      if (name) names.add(name);
    }

    for (const name of names) {
      const existing = await prisma.client.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (existing) continue;

      const fromNote = notes.find(
        (n) => n.client.trim().toLowerCase() === name.toLowerCase()
      );
      const fromProject = projects.find(
        (p) => p.contractor.trim().toLowerCase() === name.toLowerCase()
      );

      await prisma.client.create({
        data: {
          name,
          contactName: fromNote?.contactName ?? null,
          phone: fromNote?.phone ?? null,
          address: fromNote?.address ?? fromProject?.location ?? null,
          city: fromNote?.city ?? null,
          ownerId: userId,
          createdById: userId,
          updatedById: userId,
        },
      });
    }
  }

  static async findAll(query?: string) {
    const q = query?.trim();
    const rows = await prisma.client.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
              { contactName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { phoneSecondary: { contains: q, mode: "insensitive" } },
              { clientNumber: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      take: 80,
    });
    return rows.map(mapClient);
  }

  static async findById(id: string) {
    const row = await prisma.client.findUnique({ where: { id } });
    return row ? mapClient(row) : null;
  }

  static async findByName(name: string) {
    const row = await prisma.client.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
    });
    return row ? mapClient(row) : null;
  }

  static async create(input: CreateClientInput, userId: string) {
    if (!input.name?.trim()) throw new Error("שם לקוח חובה");

    const created = await prisma.client.create({
      data: {
        name: input.name.trim(),
        clientNumber: input.clientNumber?.trim() || null,
        companyName: input.companyName?.trim() || null,
        contactName: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        phoneSecondary: input.phoneSecondary?.trim() || null,
        address: input.address?.trim() || null,
        city: input.city?.trim() || null,
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
      },
    });
    return mapClient(created);
  }

  static async update(id: string, input: Partial<CreateClientInput>, userId: string) {
    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.clientNumber !== undefined
          ? { clientNumber: input.clientNumber.trim() || null }
          : {}),
        ...(input.companyName !== undefined
          ? { companyName: input.companyName.trim() || null }
          : {}),
        ...(input.contactName !== undefined
          ? { contactName: input.contactName.trim() || null }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
        ...(input.phoneSecondary !== undefined
          ? { phoneSecondary: input.phoneSecondary.trim() || null }
          : {}),
        ...(input.address !== undefined
          ? { address: input.address.trim() || null }
          : {}),
        ...(input.city !== undefined ? { city: input.city.trim() || null } : {}),
        ...(input.email !== undefined ? { email: input.email.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
        updatedById: userId,
      },
    });
    return mapClient(updated);
  }
}
