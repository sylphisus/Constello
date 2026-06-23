import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Gate /admin and the admin APIs behind HTTP Basic auth. The deployed app holds
// no model key; the one thing that must be protected is the surface that writes
// readings — anyone reaching it could publish fabricated artifacts.
export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new NextResponse("ADMIN_PASSWORD not configured.", { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6)); // "user:pass" — username is ignored
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === expected) return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="constello-admin"' },
  });
}
