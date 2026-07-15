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
  driverPhone?: string | null;
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
  emailSentAt?: Date | null;
  whatsappSentAt?: Date | null;
  currentVersion?: number;
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
    driverPhone: row.driverPhone ?? null,
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
    emailSentAt: row.emailSentAt?.toISOString() ?? null,
    whatsappSentAt: row.whatsappSentAt?.toISOString() ?? null,
    currentVersion: row.currentVersion ?? 1,
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

const FIELD_LABELS: Record<string, string> = {
  date: "תאריך",
  departureTime: "שעת יציאה",
  client: "לקוח",
  projectId: "פרויקט",
  projectName: "פרויקט",
  orderNumber: "מספר הזמנה / עבודה",
  contactName: "איש קשר",
  phone: "טלפון",
  phoneSecondary: "טלפון נוסף",
  address: "כתובת",
  city: "עיר",
  notes: "הערות",
  driverName: "נהג",
  vehicle: "רכב",
  vehicleNumber: "מספר רכב",
  externalCarrier: "מוביל חיצוני",
  deliveryTime: "שעת מסירה",
  destination: "יעד",
  destinationAddress: "כתובת יעד",
  driverNotes: "הערות לנהג",
  items: "פריטים",
};

function norm(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "כן" : "לא";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(0, 10);
  }
  return String(v);
}

function diffDeliveryNotes(
  before: ReturnType<typeof mapNote>,
  after: ReturnType<typeof mapNote>
) {
  const changes: { field: string; label: string; from: string; to: string }[] =
    [];
  const scalarKeys = [
    "date",
    "departureTime",
    "client",
    "projectName",
    "orderNumber",
    "contactName",
    "phone",
    "phoneSecondary",
    "address",
    "city",
    "notes",
    "driverName",
    "vehicle",
    "vehicleNumber",
    "externalCarrier",
    "deliveryTime",
    "destination",
    "destinationAddress",
    "driverNotes",
  ] as const;

  for (const key of scalarKeys) {
    const from = norm(before[key]);
    const to = norm(after[key]);
    if (from !== to) {
      changes.push({
        field: key,
        label: FIELD_LABELS[key] ?? key,
        from: from || "—",
        to: to || "—",
      });
    }
  }

  const beforeItems = JSON.stringify(
    before.items.map((i) => ({
      sku: i.sku,
      description: i.description,
      unit: i.unit,
      quantity: i.quantity,
      packageNumber: i.packageNumber,
      notes: i.notes,
    }))
  );
  const afterItems = JSON.stringify(
    after.items.map((i) => ({
      sku: i.sku,
      description: i.description,
      unit: i.unit,
      quantity: i.quantity,
      packageNumber: i.packageNumber,
      notes: i.notes,
    }))
  );
  if (beforeItems !== afterItems) {
    changes.push({
      field: "items",
      label: "פריטים",
      from: `${before.items.length} שורות`,
      to: `${after.items.length} שורות`,
    });
  }

  return changes;
}

export type CreateDeliveryNoteInput = {
  noteNumber?: string;
  date: string;
  status?: DeliveryNoteStatus;
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
  receiverName?: string;
  receivedAt?: string;
  driverName?: string;
  driverPhone?: string;
  vehicle?: string;
  vehicleNumber?: string;
  externalCarrier?: boolean;
  deliveryTime?: string;
  destination?: string;
  destinationAddress?: string;
  driverNotes?: string;
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
    const autoNoteNumber = `DN-${year}-${String(sequenceNumber).padStart(4, "0")}`;
    const noteNumber = input.noteNumber?.trim() || autoNoteNumber;
    // Future QR / barcode payloads prepared at create time
    const qrCodePayload = `wego:dn:${noteNumber}`;
    const barcodePayload = noteNumber;

    const created = await prisma.deliveryNote.create({
      data: {
        noteNumber,
        sequenceNumber,
        status: input.status ?? "draft",
        date: input.date ? new Date(input.date) : new Date(),
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
        receiverName: input.receiverName?.trim() || null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
        driverName: input.driverName?.trim() || null,
        driverPhone: input.driverPhone?.trim() || null,
        vehicle: input.vehicle?.trim() || null,
        vehicleNumber: input.vehicleNumber?.trim() || null,
        externalCarrier: Boolean(input.externalCarrier),
        deliveryTime: input.deliveryTime?.trim() || null,
        destination: input.destination?.trim() || null,
        destinationAddress: input.destinationAddress?.trim() || null,
        driverNotes: input.driverNotes?.trim() || null,
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

    const mapped = mapNote(created);
    await prisma.deliveryNoteVersion.create({
      data: {
        deliveryNoteId: created.id,
        version: 1,
        changesJson: JSON.stringify([
          {
            field: "_created",
            label: "יצירה",
            from: "",
            to: "תעודה נוצרה",
          },
        ]),
        snapshotJson: JSON.stringify(mapped),
        editedById: userId,
      },
    });

    return mapped;
  }

  static async update(
    id: string,
    input: CreateDeliveryNoteInput,
    userId: string
  ) {
    const existing = await prisma.deliveryNote.findUnique({
      where: { id },
      include: noteInclude,
    });
    if (!existing) throw new Error("תעודת משלוח לא נמצאה");
    if (!input.client?.trim()) throw new Error("לקוח חובה");
    if (!input.items?.length) throw new Error("יש להוסיף לפחות פריט אחד");

    for (const item of input.items) {
      if (!item.description?.trim()) throw new Error("תיאור פריט חובה");
      if (!(Number(item.quantity) > 0)) {
        throw new Error("כמות פריט חייבת להיות חיובית");
      }
    }

    const before = mapNote(existing);
    const nextVersion = (existing.currentVersion ?? 1) + 1;

    await prisma.deliveryNoteItem.deleteMany({
      where: { deliveryNoteId: id },
    });

    const updated = await prisma.deliveryNote.update({
      where: { id },
      data: {
        // noteNumber / sequenceNumber intentionally unchanged
        date: input.date ? new Date(input.date) : existing.date,
        status: input.status ?? existing.status,
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
        receiverName: input.receiverName?.trim() || null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
        driverName: input.driverName?.trim() || null,
        driverPhone: input.driverPhone?.trim() || null,
        vehicle: input.vehicle?.trim() || null,
        vehicleNumber: input.vehicleNumber?.trim() || null,
        externalCarrier: Boolean(input.externalCarrier),
        deliveryTime: input.deliveryTime?.trim() || null,
        destination: input.destination?.trim() || null,
        destinationAddress: input.destinationAddress?.trim() || null,
        driverNotes: input.driverNotes?.trim() || null,
        currentVersion: nextVersion,
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

    const after = mapNote(updated);
    const changes = diffDeliveryNotes(before, after);

    await prisma.deliveryNoteVersion.create({
      data: {
        deliveryNoteId: id,
        version: nextVersion,
        changesJson: JSON.stringify(
          changes.length
            ? changes
            : [
                {
                  field: "_touch",
                  label: "שמירה",
                  from: "",
                  to: "נשמר ללא שינוי שדות",
                },
              ]
        ),
        snapshotJson: JSON.stringify(after),
        editedById: userId,
      },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "DeliveryNote",
      entityId: id,
      userId,
      metadata: {
        noteNumber: existing.noteNumber,
        version: nextVersion,
        changedFields: changes.map((c) => c.field),
      },
    });

    if (existing.projectId || input.projectId) {
      await prisma.activity.create({
        data: {
          projectId: (input.projectId || existing.projectId)!,
          type: "delivery_note_created",
          title: "תעודת משלוח עודכנה",
          description: `עודכנה תעודת משלוח ${existing.noteNumber} (גרסה ${nextVersion})`,
          userId,
          metadata: JSON.stringify({
            deliveryNoteId: id,
            noteNumber: existing.noteNumber,
            version: nextVersion,
          }),
        },
      });
    }

    return after;
  }

  static async listVersions(deliveryNoteId: string) {
    let rows = await prisma.deliveryNoteVersion.findMany({
      where: { deliveryNoteId },
      include: { editedBy: { select: { name: true } } },
      orderBy: { version: "desc" },
    });

    // Backward compatible: seed version 1 for notes created before versioning
    if (rows.length === 0) {
      const note = await this.findById(deliveryNoteId);
      if (note) {
        await prisma.deliveryNoteVersion.create({
          data: {
            deliveryNoteId,
            version: 1,
            changesJson: JSON.stringify([
              {
                field: "_created",
                label: "יצירה",
                from: "",
                to: "תעודה נוצרה",
              },
            ]),
            snapshotJson: JSON.stringify(note),
            editedById: (
              await prisma.deliveryNote.findUnique({
                where: { id: deliveryNoteId },
                select: { createdById: true },
              })
            )!.createdById,
          },
        });
        rows = await prisma.deliveryNoteVersion.findMany({
          where: { deliveryNoteId },
          include: { editedBy: { select: { name: true } } },
          orderBy: { version: "desc" },
        });
      }
    }

    return rows.map((r) => ({
      id: r.id,
      deliveryNoteId: r.deliveryNoteId,
      version: r.version,
      changes: JSON.parse(r.changesJson || "[]") as {
        field: string;
        label: string;
        from: string;
        to: string;
      }[],
      editedById: r.editedById,
      editedByName: r.editedBy.name,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  static async deleteAttachment(deliveryNoteId: string, attachmentId: string) {
    const att = await prisma.deliveryNoteAttachment.findFirst({
      where: { id: attachmentId, deliveryNoteId },
    });
    if (!att) throw new Error("קובץ לא נמצא");
    await prisma.deliveryNoteAttachment.delete({ where: { id: attachmentId } });
    return { ok: true };
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
