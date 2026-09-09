import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";
import { prisma } from "../src/lib/prisma";

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";

async function main() {
  await prisma.externalShareLink.updateMany({
    where: { title: { startsWith: "QA " }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const suffix = randomBytes(5).toString("hex");
  const username = `qa-share-${suffix}`;
  const password = `Qa!${randomBytes(16).toString("base64url")}`;
  const document = await prisma.document.findFirst({
    where: {
      url: {
        startsWith: "http",
        not: { contains: "localhost" },
      },
    },
    select: { id: true, name: true, projectId: true },
    orderBy: { createdAt: "desc" },
  });
  if (!document) throw new Error("No existing document available for QA");

  const user = await prisma.user.create({
    data: {
      name: "QA Share Link",
      username,
      email: `${username}@test.wego.invalid`,
      passwordHash: await hashPassword(password),
      role: "SYSTEM_MANAGER",
      status: "ACTIVE",
    },
  });

  try {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
      redirect: "manual",
    });
    if (!login.ok) throw new Error(`Login failed: HTTP ${login.status}`);
    const cookie = login.headers.get("set-cookie");
    if (!cookie) throw new Error("Login did not create a session cookie");

    const create = await fetch(`${baseUrl}/api/external-share`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        entityType: "document",
        entityId: document.id,
        projectId: document.projectId,
        title: `QA ${document.name}`,
        expiresInDays: 30,
      }),
    });
    const createdBody = await create.json();
    if (!create.ok) {
      throw new Error(
        `Create failed: HTTP ${create.status} ${JSON.stringify(createdBody)}`
      );
    }
    const created = createdBody.data ?? createdBody;
    if (!created.url || !created.publicId || !created.url.includes("?t=")) {
      throw new Error("Created URL is missing its secure token");
    }

    const publicPage = await fetch(created.url, { redirect: "manual" });
    const publicUrl = new URL(created.url);
    const publicApiUrl = new URL(
      `/api/external-share/public/${created.publicId}${publicUrl.search}`,
      baseUrl
    );
    const resolve = await fetch(publicApiUrl);
    const resolvedBody = await resolve.json();
    const resolved = resolvedBody.data ?? resolvedBody;
    const documentOpen = resolved.document?.url
      ? await fetch(new URL(resolved.document.url, baseUrl), {
          redirect: "manual",
        })
      : null;
    const withoutToken = await fetch(
      `${baseUrl}/api/external-share/public/${created.publicId}`
    );

    if (!resolve.ok || resolved.document?.name !== document.name) {
      throw new Error(
        `Wrong document resolved: HTTP ${resolve.status} ${JSON.stringify(resolvedBody)}`
      );
    }
    if (withoutToken.status !== 403) {
      throw new Error(`publicId-only request returned ${withoutToken.status}`);
    }

    await prisma.externalShareLink.update({
      where: { id: created.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expired = await fetch(publicApiUrl);
    const expiredBody = await expired.json();

    const revoke = await fetch(
      `${baseUrl}/api/external-share/${created.id}/revoke`,
      { method: "POST", headers: { cookie } }
    );
    const revoked = await fetch(publicApiUrl);
    const revokedBody = await revoked.json();

    console.log(
      JSON.stringify(
        {
          createShareLink: create.status,
          secureTokenInUrl: true,
          publicSharePage: publicPage.status,
          publicApiWithoutLogin: resolve.status,
          documentResolved:
            resolved.document?.name === document.name ? "PASS" : "FAIL",
          correctDocumentName: resolved.document?.name,
          resolvedDocumentUrl: resolved.document?.url,
          documentOpenWithoutLogin: documentOpen?.status ?? null,
          documentOpenRedirect: documentOpen?.headers.get("location") ?? null,
          publicIdAloneRejected: withoutToken.status,
          expiredStatus: expired.status,
          expiredMessage: expiredBody.error,
          revokeStatus: revoke.status,
          revokedStatus: revoked.status,
          revokedMessage: revokedBody.error,
          preservedQaLinkId: created.id,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

void main().finally(() => prisma.$disconnect());
