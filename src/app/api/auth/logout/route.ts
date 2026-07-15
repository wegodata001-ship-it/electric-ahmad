import { NextResponse } from "next/server";
import {
  OFFICE_SESSION_COOKIE,
  officeSessionCookieOptions,
} from "@/lib/auth/office-cookie";

export async function POST() {
  const res = NextResponse.json({ success: true, data: { ok: true } });
  res.cookies.set(OFFICE_SESSION_COOKIE, "", {
    ...officeSessionCookieOptions(0),
    maxAge: 0,
  });
  return res;
}
