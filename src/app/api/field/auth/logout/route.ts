import { NextResponse } from "next/server";
import {
  FIELD_SESSION_COOKIE,
  fieldSessionCookieOptions,
} from "@/lib/auth/field-cookie";

export async function POST() {
  const res = NextResponse.json({ success: true, data: { ok: true } });
  res.cookies.set(FIELD_SESSION_COOKIE, "", {
    ...fieldSessionCookieOptions(0),
    maxAge: 0,
  });
  return res;
}
