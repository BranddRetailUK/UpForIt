import { NextRequest, NextResponse } from "next/server";

const CANONICAL_HOST = "www.upforitevents.co.uk";

export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname !== "upforitevents.co.uk") {
    return NextResponse.next();
  }

  const destination = request.nextUrl.clone();
  destination.protocol = "https:";
  destination.hostname = CANONICAL_HOST;
  destination.port = "";
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)"
};
