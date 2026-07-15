import { prisma } from "@/lib/prisma";
import { AuditRepository } from "./audit.repository";
import type { DeliveryNoteStatus } from "@prisma/client";

function mapNote(row: {
  id: string;
  noteNumber: string;
  sequenceNumber: number;
  status: DeliveryNoteStatus;
  date: Date;
  departureTime: string | null;
  client: string;
  clientId: string | null;
  projectId: string | null;
  project?: { name: string } | null;
  orderNumber: string | null;
  contactName: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  driverName: string | null;
  vehicle: string | null;
  vehicleNumber: string | null;
  externalCarrier: boolean;
  deliveryTime: string | null;
  destination: string | null;
  destinationAddress: string | null;
  driverNotes: string | null;
  senderSigned: boolean;
  receiverSigned: boolean;
  receiverName: string | null;
  receivedAt: Date | null;
  equipmentCheckedIntact: boolean;
  receivedComplete: boolean;
  receivedWithNotes: boolean;
  receiptNotes: string | null;
  qrCodePayload: string | null;
  barcodePayload: string | null;
  url: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    sku: string | null;
    description: string;
    unit: string;
    quantity: { toString(): string } | number;
    packageNumber: string | null;
    serialNumber: string | null;
    notes: string | null;
    sortOrder: number;
  }[];
  attachments: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    kind: string;
    url: string;
    createdAt: Date;
  }[];
}) {
  return {
    id: row.id,
    noteNumber: row.noteNumber,
    sequenceNumber: row.sequenceNumber,
    status: row.status,
    date: row.date.toISOString(),
    departureTime: row.departureTime,
    client: row.client,
    clientId: row.clientId,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    orderNumber: row.orderNumber,
    contactName: row.contactName,
    phone: row.phone,
    phoneSecondary: row.phoneSecondary,
    address: row.address,
    city: row.city,
    notes: row.notes,
    driverName: row.driverName,
    vehicle: row.vehicle,
    vehicleNumber: row.vehicleNumber,
    externalCarrier: row.externalCarrier,
    deliveryTime: row.deliveryTime,
    destination: row.destination,
    destinationAddress: row.destinationAddress,
    driverNotes: row.driverNotes,
    senderSigned: row.senderSigned,
    receiverSigned: row.receiverSigned,
    receiverName: row.receiverName,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    equipmentCheckedIntact: row.equipmentCheckedIntact,
    receivedComplete: row.receivedComplete,
    receivedWithNotes: row.receivedWithNotes,
    receiptNotes: row.receiptNotes,
    qrCodePayload: row.qrCodePayload,
    barcodePayload: row.barcodePayload,
    url: row.url,
    items: row.items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        sku: item.sku,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        packageNumber: item.packageNumber,
        serialNumber: item.serialNumber,
        notes: item.notes ?? undefined,
        sortOrder: item.sortOrder,
      })),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      kind: a.kind,
      url: a.url,
      createdAt: a.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const noteInclude = {
  project: {
    select: {
      name: true,
      contractor: true,
      location: true,
      foreman: { select: { firstName: true, lastName: true, phone: true } },
    },
  },
  items: true,
  attachments: true,
} as const;

export type CreateDeliveryNoteInput = {
  date: string;
  departureTime?: string;
  client: string;
  clientId?: string | null;
  projectId?: string | null;
  orderNumber?: string;
  contactName?: string;
  phone?: string;
  phoneSecondary?: string;
  address?: string;
  city?: string;
  notes?: string;
  driverName?: string;
  vehicle?: string;
  vehicleNumber?: string;
  externalCarrier?: boolean;
  deliveryTime?: string;
  destination?: string;
  destinationAddress?: string;
  driverNotes?: string;
  senderSigned?: boolean;
  receiverSigned?: boolean;
  receiverName?: string;
  receivedAt?: string | null;
  equipmentCheckedIntact?: boolean;
  receivedComplete?: boolean;
  receivedWithNotes?: boolean;
  receiptNotes?: string;
  status?: DeliveryNoteStatus;
  items: {
    sku?: string;
    description: string;
    unit: string;
    quantity: number;
    packageNumber?: string;
    serialNumber?: string;
    notes?: string;
  }[];
};

export class DeliveryNotesRepository {
  static async nextSequence(): Promise<number> {
    const latest = await prisma.deliveryNote.findFirst({
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return (latest?.sequenceNumber ?? 0) + 1;
  }

  static async findAll() {
    const rows = await prisma.deliveryNote.findMany({
      include: noteInclude,
      orderBy: { date: "desc" },
    });
    return rows.map(mapNote);
  }

  static async findById(id: string) {
    const row = await prisma.deliveryNote.findUnique({
      where: { id },
      include: noteInclude,
    });
    return row ? mapNote(row) : null;
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.deliveryNote.findMany({
      where: { projectId },
      include: noteInclude,
      orderBy: { date: "desc" },
    });
    return rows.map(mapNote);
  }

  static async create(input: CreateDeliveryNoteInput, userId: string) {
    if (!input.client?.trim()) throw new Error("לקוח חובה");
    if (!input.items?.length) throw new Error("יש להוסיף לפחות פריט אחד");

    for (const item of input.items) {
      if (!item.description?.trim()) throw new Error("תיאור פריט חובה");
      if (!(Number(item.quantity) > 0)) {
        throw new Error("כמות פריט חייבת להיות חיובית");
      }
    }

    const sequenceNumber = await this.nextSequence();
    const year = new Date(input.date || Date.now()).getFullYear();
    const noteNumber = `DN-${year}-${String(sequenceNumber).padStart(4, "0")}`;
    // Future QR / barcode payloads prepared at create time
    const qrCodePayload = `wego:dn:${noteNumber}`;
    const barcodePayload = noteNumber;

    const created = await prisma.deliveryNote.create({
      data: {
        noteNumber,
        sequenceNumber,
        status: input.status ?? "issued",
        date: input.date ? new Date(input.date) : new Date(),
        departureTime: input.departureTime?.trim() || null,
        client: input.client.trim(),
        clientId: input.clientId || null,
        projectId: input.projectId || null,
        orderNumber: input.orderNumber?.trim() || null,
        contactName: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        phoneSecondary: input.phoneSecondary?.trim() || null,
        address: input.address?.trim() || null,
        city: input.city?.trim() || null,
        notes: input.notes?.trim() || null,
        driverName: input.driverName?.trim() || null,
        vehicle: input.vehicle?.trim() || null,
        vehicleNumber: input.vehicleNumber?.trim() || null,
        externalCarrier: Boolean(input.externalCarrier),
        deliveryTime: input.deliveryTime?.trim() || null,
        destination: input.destination?.trim() || null,
        destinationAddress: input.destinationAddress?.trim() || null,
        driverNotes: input.driverNotes?.trim() || null,
        senderSigned: Boolean(input.senderSigned),
        receiverSigned: Boolean(input.receiverSigned),
        receiverName: input.receiverName?.trim() || null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
        equipmentCheckedIntact: Boolean(input.equipmentCheckedIntact),
        receivedComplete: Boolean(input.receivedComplete),
        receivedWithNotes: Boolean(input.receivedWithNotes),
        receiptNotes: input.receiptNotes?.trim() || null,
        qrCodePayload,
        barcodePayload,
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
        items: {
          create: input.items.map((item, index) => ({
            sku: item.sku?.trim() || null,
            description: item.description.trim(),
            unit: item.unit?.trim() || "יח'",
            quantity: Number(item.quantity),
            packageNumber: item.packageNumber?.trim() || null,
            serialNumber: item.serialNumber?.trim() || null,
            notes: item.notes?.trim() || null,
            sortOrder: index + 1,
          })),
        },
      },
      include: noteInclude,
    });

    if (input.projectId) {
      await prisma.activity.create({
        data: {
          projectId: input.projectId,
          type: "delivery_note_created",
          title: "תעודת משלוח חדשה",
          description: `נוצרה תעודת משלוח ${noteNumber} ללקוח ${input.client.trim()}`,
          userId,
          metadata: JSON.stringify({ deliveryNoteId: created.id, noteNumber }),
        },
      });
    }

    await AuditRepository.log({
      action: "CREATE",
      entityType: "DeliveryNote",
      entityId: created.id,
      userId,
      metadata: { noteNumber, itemCount: input.items.length },
    });

    return mapNote(created);
  }

  static async addAttachment(
    deliveryNoteId: string,
    data: {
      name: string;
      mimeType: string;
      size: number;
      kind: string;
      bucket: string;
      path: string;
      url: string;
    }
  ) {
    const attachment = await prisma.deliveryNoteAttachment.create({
      data: { deliveryNoteId, ...data },
    });
    return {
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: attachment.kind,
      url: attachment.url,
      createdAt: attachment.createdAt.toISOString(),
    };
  }
}
