import type { NextRequest } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "./auth";

export async function getAdminForRequest(request: NextRequest) {
  const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  return user?.role === "admin" ? user : null;
}
