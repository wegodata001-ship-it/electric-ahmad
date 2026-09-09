import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";
import { prisma } from "../src/lib/prisma";

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";

async function main() {
  const suffix = randomBytes(5).toString("hex");
  const username = `qa-timeline-${suffix}`;
  const password = `Qa!${randomBytes(16).toString("base64url")}`;
  const user = await prisma.user.create({
    data: {
      name: "QA Timeline",
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
    });
    const cookie = login.headers.get("set-cookie");
    if (!login.ok || !cookie) {
      throw new Error(`Timeline QA login failed: ${login.status}`);
    }

    const [api, page] = await Promise.all([
      fetch(`${baseUrl}/api/workflow/timeline?period=all&take=500`, {
        headers: { cookie },
      }),
      fetch(`${baseUrl}/system/workflow`, {
        headers: { cookie },
        redirect: "manual",
      }),
    ]);
    const apiBody = await api.json();
    const payload = apiBody.data ?? apiBody;
    const byKind = new Map<string, (typeof payload.items)[number]>();
    for (const item of payload.items ?? []) {
      if (!byKind.has(item.kind)) byKind.set(item.kind, item);
    }

    const opened: Record<
      string,
      { status: number; location: string | null; finalStatus: number }
    > = {};
    for (const [kind, item] of byKind) {
      const response = await fetch(new URL(item.documentUrl, baseUrl), {
        headers: { cookie },
        redirect: "manual",
      });
      const followed = await fetch(new URL(item.documentUrl, baseUrl), {
        headers: { cookie },
        redirect: "follow",
      });
      opened[kind] = {
        status: response.status,
        location: response.headers.get("location"),
        finalStatus: followed.status,
      };
    }

    console.log(
      JSON.stringify(
        {
          login: login.status,
          timelineApi: api.status,
          timelinePage: page.status,
          eventCount: payload.items?.length ?? 0,
          opened,
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
