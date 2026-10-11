import { NextResponse } from "next/server";
import {
  SUBCONTRACTOR_SESSION_COOKIE,
  subcontractorSessionCookieOptions,
} from "@/lib/auth/subcontractor-cookie";

export async function POST() {
  const res = NextResponse.json({ success: true, data: { ok: true } });
  res.cookies.set(SUBCONTRACTOR_SESSION_COOKIE, "", {
    ...subcontractorSessionCookieOptions(0),
    maxAge: 0,
  });
  return res;
}
