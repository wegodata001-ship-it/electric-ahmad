import { prisma } from "@/lib/prisma";
import { AuditRepository } from "./audit.repository";
import { DocumentsRepository } from "./documents.repository";
import {
  canApproveDocuments,
  roleGradeLabel,
} from "@/lib/auth/document-permissions";
import { isFieldManagerRole, isOfficeRole } from "@/lib/auth/roles";
import type { DeliveryNoteStatus, Prisma } from "@prisma/client";
import {
  buildPageInfo,
  encodeTimeIdCursor,
  type ListPageInfo,
  type ListSortDir,
} from "@/lib/api/list-query";
import {
  assertCanSoftDelete,
  LEGACY_DN_EDITABLE_STATUSES,
  LEGACY_DN_LOCKED_STATUSES,
} from "@/lib/workflow/document-guards";

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
  receiverSignatureUrl?: string | null;
  employeeSignatureUrl?: string | null;
  employeeSignedName?: string | null;
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
    receiverSignatureUrl: row.receiverSignatureUrl ?? null,
    employeeSignatureUrl: row.employeeSignatureUrl ?? null,
    employeeSignedName: row.employeeSignedName ?? null,
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
  receiverSignatureUrl?: string | null;
  employeeSignatureUrl?: string | null;
  employeeSignedName?: string | null;
  senderSigned?: boolean;
  receiverSigned?: boolean;
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

/** Slim list-row shape (server pagination). Matches enough of `DeliveryNote` for card lists. */
export type DeliveryNoteListItem = {
  id: string;
  noteNumber: string;
  sequenceNumber: number;
  status: DeliveryNoteStatus;
  date: string;
  client: string;
  clientId: string | null;
  projectId: string | null;
  projectName: string | null;
  orderNumber: string | null;
  contactName: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  city: string | null;
  receiverSigned: boolean;
  receiverSignatureUrl: string | null;
  currentVersion: number;
  items: { quantity: number }[];
  createdAt: string;
  updatedAt: string;
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

  /**
   * Server-paginated list for card/table UIs.
   * Slim shape — includes project name + `items:[{quantity}]` so existing
   * `.items.length` and `.items.reduce(...quantity)` cards keep working.
   * No attachments loaded.
   */
  static async listPage(opts: {
    projectId?: string;
    q?: string | null;
    status?: string | null;
    take: number;
    skip: number;
    sort?: string | null;
    dir?: ListSortDir;
  }): Promise<{
    items: DeliveryNoteListItem[];
    total: number;
    pageInfo: ListPageInfo;
  }> {
    const take = Math.max(1, Math.min(opts.take, 200));
    const skip = Math.max(0, opts.skip);
    const dir: ListSortDir = opts.dir === "asc" ? "asc" : "desc";

    const where: Prisma.DeliveryNoteWhereInput = {};
    if (opts.projectId) where.projectId = opts.projectId;
    if (opts.status && opts.status !== "all") {
      where.status = opts.status as DeliveryNoteStatus;
    }
    const q = opts.q?.trim();
    if (q) {
      where.OR = [
        { noteNumber: { contains: q, mode: "insensitive" } },
        { client: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { orderNumber: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.DeliveryNoteOrderByWithRelationInput[] = (() => {
      const s = opts.sort ?? "date";
      switch (s) {
        case "updatedAt":
          return [{ updatedAt: dir }, { id: dir }];
        case "createdAt":
          return [{ createdAt: dir }, { id: dir }];
        case "noteNumber":
          return [{ sequenceNumber: dir }, { id: dir }];
        case "date":
        default:
          return [{ date: dir }, { id: dir }];
      }
    })();

    const [rows, total] = await Promise.all([
      prisma.deliveryNote.findMany({
        where,
        select: {
          id: true,
          noteNumber: true,
          sequenceNumber: true,
          status: true,
          date: true,
          client: true,
          clientId: true,
          projectId: true,
          orderNumber: true,
          contactName: true,
          phone: true,
          phoneSecondary: true,
          city: true,
          receiverSigned: true,
          receiverSignatureUrl: true,
          currentVersion: true,
          createdAt: true,
          updatedAt: true,
          project: { select: { name: true } },
          items: { select: { quantity: true } },
        },
        orderBy,
        take,
        skip,
      }),
      prisma.deliveryNote.count({ where }),
    ]);

    const items: DeliveryNoteListItem[] = rows.map((row) => ({
      id: row.id,
      noteNumber: row.noteNumber,
      sequenceNumber: row.sequenceNumber,
      status: row.status,
      date: row.date.toISOString(),
      client: row.client,
      clientId: row.clientId,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
      orderNumber: row.orderNumber,
      contactName: row.contactName,
      phone: row.phone,
      phoneSecondary: row.phoneSecondary,
      city: row.city,
      receiverSigned: row.receiverSigned,
      receiverSignatureUrl: row.receiverSignatureUrl,
      currentVersion: row.currentVersion ?? 1,
      items: row.items.map((i) => ({ quantity: Number(i.quantity) })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    const last = rows[rows.length - 1];
    const nextCursor = last
      ? encodeTimeIdCursor(
          opts.sort === "updatedAt"
            ? last.updatedAt
            : opts.sort === "createdAt"
              ? last.createdAt
              : last.date,
          last.id
        )
      : null;

    const page = take > 0 ? Math.floor(skip / take) + 1 : 1;
    const pageInfo = buildPageInfo({
      take,
      skip,
      page,
      fetchedCount: rows.length,
      returnedCount: rows.length,
      total,
      nextCursor,
    });

    return { items, total, pageInfo };
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
        receiverSignatureUrl: input.receiverSignatureUrl || null,
        employeeSignatureUrl: input.employeeSignatureUrl || null,
        employeeSignedName: input.employeeSignedName?.trim() || null,
        senderSigned: Boolean(
          input.senderSigned ?? Boolean(input.employeeSignatureUrl)
        ),
        receiverSigned: Boolean(
          input.receiverSigned ?? Boolean(input.receiverSignatureUrl)
        ),
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
    if (LEGACY_DN_LOCKED_STATUSES.includes(existing.status)) {
      throw new Error("תעודת המשלוח נעולה לעריכה");
    }
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

    // `input.status` is intentionally IGNORED — status transitions must go
    // through the dedicated complete / send / receive endpoints so the
    // workflow lock cannot be bypassed via a PATCH.
    void input.status;

    const updated = await prisma.deliveryNote.update({
      where: { id },
      data: {
        // noteNumber / sequenceNumber intentionally unchanged
        date: input.date ? new Date(input.date) : existing.date,
        status: existing.status,
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
        receiverSignatureUrl: input.receiverSignatureUrl || null,
        employeeSignatureUrl: input.employeeSignatureUrl || null,
        employeeSignedName: input.employeeSignedName?.trim() || null,
        senderSigned: Boolean(
          input.senderSigned ?? Boolean(input.employeeSignatureUrl)
        ),
        receiverSigned: Boolean(
          input.receiverSigned ?? Boolean(input.receiverSignatureUrl)
        ),
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

  static async delete(id: string, userId: string) {
    const existing = await prisma.deliveryNote.findUnique({ where: { id } });
    if (!existing) throw new Error("תעודת משלוח לא נמצאה");

    assertCanSoftDelete(String(existing.status), null, {
      entityLabel: "תעודת משלוח",
      editableStatuses: LEGACY_DN_EDITABLE_STATUSES,
    });

    await prisma.deliveryNote.delete({ where: { id } });

    await AuditRepository.log({
      action: "DELETE",
      entityType: "DeliveryNote",
      entityId: id,
      userId,
      metadata: { noteNumber: existing.noteNumber },
    });

    return { ok: true };
  }

  /** Ensure PDF document exists under תעודות משלוח */
  static async saveDocument(id: string, userId: string, printBaseUrl?: string) {
    const note = await prisma.deliveryNote.findUnique({ where: { id } });
    if (!note) throw new Error("תעודת משלוח לא נמצאה");
    if (!note.projectId) {
      throw new Error("לא ניתן לשמור במסמכים ללא פרויקט מקושר");
    }

    const folderPath = "תעודות משלוח";
    const printPath = `/print/delivery-notes/${id}`;
    const url = printBaseUrl
      ? `${printBaseUrl.replace(/\/$/, "")}${printPath}`
      : printPath;
    const docName = `תעודת משלוח ${note.noteNumber}.pdf`;

    const existing = await prisma.document.findFirst({
      where: {
        projectId: note.projectId,
        folderPath,
        path: `print/delivery-notes/${id}`,
      },
    });
    if (existing) {
      return {
        document: {
          id: existing.id,
          name: existing.name,
          folderPath: existing.folderPath,
          url: existing.url,
        },
        created: false,
      };
    }

    const doc = await DocumentsRepository.create(
      {
        projectId: note.projectId,
        name: docName,
        type: "pdf",
        extension: "pdf",
        size: 0,
        bucket: "documents",
        path: `print/delivery-notes/${id}`,
        url,
        folderPath,
        sourceType: "delivery_note",
        sourceId: id,
      },
      userId
    );

    return {
      document: {
        id: doc.id,
        name: doc.name,
        folderPath: doc.folderPath,
        url: doc.url,
      },
      created: true,
    };
  }

  /**
   * סיום תעודה: נעילה + שמירה אוטומטית במסמכי הפרויקט
   */
  static async complete(id: string, userId: string, printBaseUrl?: string) {
    const note = await prisma.deliveryNote.findUnique({ where: { id } });
    if (!note) throw new Error("תעודת משלוח לא נמצאה");
    if (note.status === "locked" || note.status === "sent" || note.status === "delivered") {
      throw new Error("התעודה כבר הושלמה או נשלחה");
    }
    if (note.status === "cancelled") {
      throw new Error("לא ניתן לסיים תעודה שבוטלה");
    }
    if (!note.projectId) {
      throw new Error("יש לשייך את התעודה לפרויקט לפני הסיום");
    }

    await prisma.deliveryNote.update({
      where: { id },
      data: { status: "locked", updatedById: userId },
    });

    const docResult = await this.saveDocument(id, userId, printBaseUrl);

    await prisma.activity.create({
      data: {
        projectId: note.projectId,
        type: "document_uploaded",
        title: "תעודת משלוח הושלמה",
        description: `תעודה ${note.noteNumber} ננעלה ונשמרה במסמכי הפרויקט`,
        userId,
        metadata: JSON.stringify({ deliveryNoteId: id }),
      },
    });

    return {
      note: await this.findById(id),
      document: docResult.document,
    };
  }

  static async listRecipients(projectId?: string | null) {
    const users = await prisma.user.findMany({
      where: { passwordHash: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employee: {
          select: {
            phone: true,
            email: true,
            role: true,
            isDeleted: true,
            status: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    void projectId;

    return users
      .filter((u) => {
        if (canApproveDocuments(u.role)) return true;
        if (isOfficeRole(u.role) || isFieldManagerRole(u.role)) return true;
        if (u.employee && !u.employee.isDeleted) return true;
        return false;
      })
      .map((u) => {
        const emp = u.employee && !u.employee.isDeleted ? u.employee : null;
        let roleLabel = roleGradeLabel(u.role);
        if (emp?.role === "foreman") roleLabel = "מנהל עבודה";
        else if (emp?.role === "manager") roleLabel = "מנהל";
        else if (canApproveDocuments(u.role)) {
          roleLabel = roleGradeLabel(u.role) || "מנהל פרויקט";
        }

        return {
          id: u.id,
          kind: "user" as const,
          fullName: u.name,
          roleLabel,
          phone: emp?.phone || "",
          email: emp?.email || u.email || "",
          status:
            emp?.status === "inactive"
              ? ("inactive" as const)
              : ("active" as const),
        };
      });
  }

  static async sendToRecipients(
    id: string,
    userId: string,
    options: {
      recipientIds: string[];
      includeClient?: boolean;
      notifyInApp?: boolean;
      sendWhatsApp?: boolean;
      sendEmail?: boolean;
    }
  ) {
    const note = await prisma.deliveryNote.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!note) throw new Error("תעודת משלוח לא נמצאה");
    if (note.status === "draft") {
      throw new Error("יש לסיים את התעודה לפני השליחה");
    }
    if (note.status === "cancelled") {
      throw new Error("לא ניתן לשלוח תעודה שבוטלה");
    }

    const recipients = await this.listRecipients(note.projectId);
    const selected = recipients.filter((r) =>
      options.recipientIds.includes(r.id)
    );
    if (!selected.length && !options.includeClient) {
      throw new Error("יש לבחור לפחות נמען אחד");
    }

    const notifyInApp = options.notifyInApp !== false;
    const printUrl = `/print/delivery-notes/${id}`;

    if (notifyInApp && note.projectId) {
      for (const r of selected) {
        await prisma.notification.create({
          data: {
            userId: r.id,
            projectId: note.projectId,
            type: "document",
            title: "תעודת משלוח חדשה",
            message: `תעודת משלוח ${note.noteNumber}${
              note.project?.name ? ` — ${note.project.name}` : ""
            } נשלחה אליך`,
            link: printUrl,
          },
        });
      }
    }

    await prisma.deliveryNote.update({
      where: { id },
      data: {
        status: "sent",
        whatsappSentAt: options.sendWhatsApp ? new Date() : undefined,
        emailSentAt: options.sendEmail ? new Date() : undefined,
        updatedById: userId,
      },
    });

    if (note.projectId) {
      await prisma.activity.create({
        data: {
          projectId: note.projectId,
          type: "status_changed",
          title: "תעודת משלוח נשלחה",
          description: `תעודה ${note.noteNumber} נשלחה ל־${
            selected.map((s) => s.fullName).join(", ") || "נמענים"
          }`,
          userId,
          metadata: JSON.stringify({
            deliveryNoteId: id,
            recipientIds: selected.map((s) => s.id),
            includeClient: Boolean(options.includeClient),
          }),
        },
      });
    }

    const message = encodeURIComponent(
      `תעודת משלוח ${note.noteNumber}\nלקוח: ${note.client}\n${
        note.project?.name ? `פרויקט: ${note.project.name}\n` : ""
      }\nקישור:\n${printUrl}`
    );

    const withPhone = [
      ...selected.filter((s) => s.phone),
      ...(options.includeClient && note.phone
        ? [{ phone: note.phone, fullName: note.contactName || note.client }]
        : []),
    ];
    const withEmail = [
      ...selected.filter((s) => s.email),
      ...(options.includeClient && note.phoneSecondary
        ? []
        : []),
    ];
    // Client email not always on note — use phone for WA primarily

    const firstPhone = withPhone[0]?.phone?.replace(/\D/g, "") || "";
    const firstEmail = withEmail[0]?.email || "";

    return {
      note: await this.findById(id),
      channels: {
        whatsappUrl:
          options.sendWhatsApp && firstPhone
            ? `https://wa.me/${
                firstPhone.startsWith("972")
                  ? firstPhone
                  : firstPhone.replace(/^0/, "972")
              }?text=${message}`
            : options.sendWhatsApp && options.includeClient && note.phone
              ? `https://wa.me/${note.phone.replace(/\D/g, "").replace(/^0/, "972")}?text=${message}`
              : null,
        emailUrl:
          options.sendEmail && firstEmail
            ? `mailto:${firstEmail}?subject=${encodeURIComponent(
                `תעודת משלוח ${note.noteNumber}`
              )}&body=${message}`
            : null,
      },
    };
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
