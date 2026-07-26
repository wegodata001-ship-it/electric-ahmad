import { COMPANY_PROFILE } from "@/config/company";
import { prisma } from "@/lib/prisma";

export type ClientPortalKind =
  | "work_diary"
  | "delivery_note"
  | "measurement_sheet";

export type ClientPortalPayload = {
  company: {
    name: string;
    logoUrl: string;
    address: string;
    phone: string;
  };
  document: {
    kind: ClientPortalKind;
    kindLabel: string;
    number: string;
    title: string;
    status: string;
    statusLabel: string;
    date: string | null;
  };
  project: {
    name: string;
    clientName: string;
    address: string;
    contractNumber: string;
    projectManager: string;
    foreman: string;
    workDate: string | null;
  };
  summary: {
    whatWasDone: string;
    workersCount: number;
    hoursTotal: number;
    roomsCount: number;
    sectionsCount: number;
    itemsCount: number;
  };
  lineItems: { id: string; description: string; quantity: string; unit: string }[];
  measurementGrid?: {
    rooms: { id: string; name: string }[];
    sections: { id: string; code: string; description: string }[];
    cells: { rowId: string; boqItemId: string; quantity: number }[];
  };
  relatedDocuments: {
    id: string;
    kind: string;
    kindLabel: string;
    title: string;
    url: string | null;
    mimeType?: string;
  }[];
  measurementSheets: {
    id: string;
    title: string;
    status: string;
    version: number;
  }[];
  photos: { id: string; name: string; url: string }[];
  attachments: {
    id: string;
    name: string;
    url: string;
    mimeType?: string;
  }[];
  timeline: { id: string; label: string; at: string }[];
  companyNotes: string;
  linkMeta: {
    createdAt: string | null;
    expiresAt: string | null;
    sentBy: string | null;
  };
  alreadySigned: boolean;
  signedPdfUrl?: string | null;
};

const KIND_LABEL: Record<ClientPortalKind, string> = {
  work_diary: "יומן עבודה",
  delivery_note: "תעודת משלוח",
  measurement_sheet: "דף מדידה",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  pending_approval: "ממתין לאישור",
  in_approval: "בבדיקה",
  approved: "מאושר",
  revision: "הוחזר לתיקון",
  sent_to_client: "ממתין לחתימת לקוח",
  signed: "נחתם",
  completed: "הושלם",
  locked: "מאושר",
  in_progress: "בביצוע",
};

function statusLabel(s: string) {
  return STATUS_LABEL[s] || s;
}

function eventLabel(action: string): string | null {
  const map: Record<string, string> = {
    created: "נוצר",
    submit: "נשלח לאישור",
    submitted: "נשלח לאישור",
    approve: "אושר",
    approved: "אושר",
    reject: "הוחזר לתיקון",
    rejected: "הוחזר לתיקון",
    revision: "הוחזר לתיקון",
    resubmit: "נשלח מחדש",
    sent_to_client: "נשלח ללקוח לחתימה",
    client_signed: "נחתם ע״י לקוח",
    signed: "נחתם ע״י לקוח",
  };
  return map[action] || null;
}

async function loadRelated(projectId: string | null | undefined) {
  if (!projectId) {
    return { relatedDocuments: [], measurementSheets: [] };
  }

  const [docs, sheets] = await Promise.all([
    prisma.document.findMany({
      where: {
        projectId,
        OR: [
          {
            sourceType: {
              in: [
                "measurement_sheet",
                "work_diary",
                "delivery_note",
                "partial_invoice",
                "invoice",
              ],
            },
          },
          { folderPath: { contains: "חשבונות" } },
          { folderPath: { contains: "מדידות" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: {
        id: true,
        name: true,
        url: true,
        sourceType: true,
        extension: true,
      },
    }),
    prisma.measurementSheet.findMany({
      where: { projectId },
      orderBy: { sequenceNumber: "asc" },
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        currentVersion: true,
        sequenceNumber: true,
      },
    }),
  ]);

  const kindLabel = (t: string | null) => {
    if (t === "measurement_sheet") return "דף מדידה";
    if (t === "work_diary") return "יומן עבודה";
    if (t === "delivery_note") return "תעודת משלוח";
    if (t === "partial_invoice" || t === "invoice") return "חשבון";
    return "מסמך";
  };

  return {
    relatedDocuments: docs.map((d) => ({
      id: d.id,
      kind: d.sourceType || "document",
      kindLabel: kindLabel(d.sourceType),
      title: d.name,
      url: d.url,
      mimeType: d.extension || undefined,
    })),
    measurementSheets: sheets.map((s) => ({
      id: s.id,
      title: s.title || `דף מדידה ${s.sequenceNumber}`,
      status: statusLabel(s.status),
      version: s.currentVersion,
    })),
  };
}

function companyBlock() {
  return {
    name: COMPANY_PROFILE.name || "מערכת חשמל הזם",
    logoUrl: COMPANY_PROFILE.logoUrl || "/logopng.jpeg",
    address: COMPANY_PROFILE.address || "",
    phone: COMPANY_PROFILE.phone || "",
  };
}

export async function buildDiaryPortal(
  doc: any,
  linkMeta: {
    createdAt?: Date | null;
    expiresAt?: Date | null;
    sentBy?: string | null;
    alreadySigned?: boolean;
  }
): Promise<ClientPortalPayload> {
  const related = await loadRelated(doc.projectId || doc.project?.id);
  const workers = doc.workers || [];
  const hours = workers.reduce(
    (s: number, w: any) => s + (Number(w.hours) || 0),
    0
  );
  const timeline = (doc.events || [])
    .map((e: any) => {
      const label = eventLabel(e.action) || e.message;
      if (!label) return null;
      return {
        id: e.id,
        label,
        at: e.createdAt,
      };
    })
    .filter(Boolean);

  if (doc.status === "sent_to_client" || linkMeta.alreadySigned === false) {
    timeline.push({
      id: "await-sign",
      label: "ממתין לחתימת לקוח",
      at: new Date().toISOString(),
    });
  }

  return {
    company: companyBlock(),
    document: {
      kind: "work_diary",
      kindLabel: KIND_LABEL.work_diary,
      number: doc.documentNumber,
      title: doc.documentNumber,
      status: doc.status,
      statusLabel: statusLabel(doc.status),
      date: doc.workDate || null,
    },
    project: {
      name: doc.project?.name || "—",
      clientName: doc.clientName || doc.project?.contractor || "—",
      address: doc.address || doc.project?.location || "—",
      contractNumber: doc.project?.contractNumber || "—",
      projectManager: doc.project?.ownerName || "—",
      foreman: doc.foreman?.name || "—",
      workDate: doc.workDate || null,
    },
    summary: {
      whatWasDone: doc.workSummary || doc.notes || "—",
      workersCount: workers.length,
      hoursTotal: hours,
      roomsCount: 0,
      sectionsCount: 0,
      itemsCount: (doc.workItems || []).length,
    },
    lineItems: (doc.workItems || []).map((i: any) => ({
      id: i.id,
      description: i.description,
      quantity: String(i.quantity ?? ""),
      unit: i.unit || "יח'",
    })),
    relatedDocuments: related.relatedDocuments,
    measurementSheets: related.measurementSheets,
    photos: (doc.media || [])
      .filter((m: any) => m.url)
      .map((m: any) => ({ id: m.id || m.url, name: m.name || "תמונה", url: m.url })),
    attachments: (doc.attachments || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      mimeType: a.mimeType,
    })),
    timeline,
    companyNotes: doc.notes || "",
    linkMeta: {
      createdAt: linkMeta.createdAt?.toISOString?.() ?? null,
      expiresAt: linkMeta.expiresAt?.toISOString?.() ?? null,
      sentBy: linkMeta.sentBy ?? null,
    },
    alreadySigned: !!linkMeta.alreadySigned || !!doc.clientSignedAt,
    signedPdfUrl: doc.signedPdfUrl || null,
  };
}

export async function buildDeliveryPortal(
  doc: any,
  linkMeta: {
    createdAt?: Date | null;
    expiresAt?: Date | null;
    sentBy?: string | null;
    alreadySigned?: boolean;
  }
): Promise<ClientPortalPayload> {
  const related = await loadRelated(doc.projectId || doc.project?.id);
  const timeline = (doc.events || [])
    .map((e: any) => {
      const label = eventLabel(e.action) || e.message;
      if (!label) return null;
      return { id: e.id, label, at: e.createdAt };
    })
    .filter(Boolean);

  timeline.push({
    id: "await-sign",
    label: "ממתין לחתימת לקוח",
    at: new Date().toISOString(),
  });

  return {
    company: companyBlock(),
    document: {
      kind: "delivery_note",
      kindLabel: KIND_LABEL.delivery_note,
      number: doc.documentNumber,
      title: doc.documentNumber,
      status: doc.status,
      statusLabel: statusLabel(doc.status),
      date: doc.noteDate || null,
    },
    project: {
      name: doc.project?.name || "—",
      clientName: doc.clientName || "—",
      address: doc.address || doc.project?.location || "—",
      contractNumber: doc.project?.contractNumber || "—",
      projectManager: "—",
      foreman: doc.foreman?.name || "—",
      workDate: doc.noteDate || null,
    },
    summary: {
      whatWasDone: doc.notes || "אספקת ציוד / חומרים",
      workersCount: 0,
      hoursTotal: 0,
      roomsCount: 0,
      sectionsCount: 0,
      itemsCount: (doc.items || []).length,
    },
    lineItems: (doc.items || []).map((i: any) => ({
      id: i.id,
      description: i.description,
      quantity: String(i.quantity ?? ""),
      unit: i.unit || "יח'",
    })),
    relatedDocuments: related.relatedDocuments,
    measurementSheets: related.measurementSheets,
    photos: (doc.media || [])
      .filter((m: any) => m.url)
      .map((m: any) => ({ id: m.id || m.url, name: m.name || "תמונה", url: m.url })),
    attachments: (doc.attachments || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      mimeType: a.mimeType,
    })),
    timeline,
    companyNotes: doc.notes || "",
    linkMeta: {
      createdAt: linkMeta.createdAt?.toISOString?.() ?? null,
      expiresAt: linkMeta.expiresAt?.toISOString?.() ?? null,
      sentBy: linkMeta.sentBy ?? null,
    },
    alreadySigned: !!linkMeta.alreadySigned || !!doc.clientSignedAt,
    signedPdfUrl: doc.signedPdfUrl || null,
  };
}

export async function buildMeasurementPortal(
  doc: any,
  linkMeta: {
    createdAt?: Date | null;
    expiresAt?: Date | null;
    sentBy?: string | null;
    alreadySigned?: boolean;
  }
): Promise<ClientPortalPayload> {
  const related = await loadRelated(doc.projectId || doc.project?.id);
  const rooms = doc.rows || [];
  const sectionMap = new Map<string, any>();
  for (const c of doc.cells || []) {
    if (c.boqItem) sectionMap.set(c.boqItemId, c.boqItem);
  }
  const sections = [...sectionMap.values()];

  const timeline = (doc.events || [])
    .map((e: any) => {
      const label = eventLabel(e.action || e.type) || e.message;
      if (!label) return null;
      return { id: e.id, label, at: e.createdAt };
    })
    .filter(Boolean) as { id: string; label: string; at: string }[];

  if (!linkMeta.alreadySigned) {
    timeline.push({
      id: "await-sign",
      label: "ממתין לחתימת לקוח",
      at: new Date().toISOString(),
    });
  }

  return {
    company: companyBlock(),
    document: {
      kind: "measurement_sheet",
      kindLabel: KIND_LABEL.measurement_sheet,
      number: doc.documentNumber || doc.title || doc.id,
      title: doc.title || "דף מדידה",
      status: doc.status,
      statusLabel: statusLabel(doc.status),
      date: doc.updatedAt || null,
    },
    project: {
      name: doc.project?.name || "—",
      clientName: doc.project?.contractor || "—",
      address: doc.project?.location || "—",
      contractNumber: doc.project?.contractNumber || "—",
      projectManager: "—",
      foreman: "—",
      workDate: null,
    },
    summary: {
      whatWasDone: `מדידת ביצוע · ${rooms.length} חדרים · ${sections.length} סעיפים`,
      workersCount: 0,
      hoursTotal: 0,
      roomsCount: rooms.length,
      sectionsCount: sections.length,
      itemsCount: (doc.cells || []).filter((c: any) => Number(c.quantity) > 0)
        .length,
    },
    lineItems: [],
    measurementGrid: {
      rooms: rooms.map((r: any) => ({ id: r.id, name: r.name })),
      sections: sections.map((s: any) => ({
        id: s.id,
        code: s.code || "",
        description: s.description || "",
      })),
      cells: (doc.cells || []).map((c: any) => ({
        rowId: c.rowId,
        boqItemId: c.boqItemId,
        quantity: Number(c.quantity) || 0,
      })),
    },
    relatedDocuments: related.relatedDocuments,
    measurementSheets: related.measurementSheets,
    photos: [],
    attachments: [],
    timeline,
    companyNotes: doc.notes || doc.lastReturnComment || "",
    linkMeta: {
      createdAt: linkMeta.createdAt?.toISOString?.() ?? null,
      expiresAt: linkMeta.expiresAt?.toISOString?.() ?? null,
      sentBy: linkMeta.sentBy ?? null,
    },
    alreadySigned: !!linkMeta.alreadySigned || !!doc.clientSignedAt,
    signedPdfUrl: doc.signedPdfUrl || null,
  };
}
