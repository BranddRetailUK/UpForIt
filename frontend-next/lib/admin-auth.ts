import type { NextRequest } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "./auth";

export async function getStaffForRequest(request: NextRequest) {
  const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  return user && (user.role === "staff" || user.role === "admin") ? user : null;
}

