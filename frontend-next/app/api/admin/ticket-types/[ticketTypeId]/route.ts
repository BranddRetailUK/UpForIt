import { NextRequest, NextResponse } from "next/server";
import { getStaffForRequest } from "../../../../../lib/admin-auth";
import { assertSameOrigin } from "../../../../../lib/request";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const staff = await getStaffForRequest(request);
    if (!staff) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
    return NextResponse.json({ error: "Ticket tiers now advance automatically from paid sales." }, { status: 409 });
  } catch (error) {
    console.error("Tier update failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Tier update failed." }, { status: 500 });
  }
}
