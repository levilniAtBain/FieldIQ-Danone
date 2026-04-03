import { NextRequest } from "next/server";

const SESSION_COOKIE = "fieldiq_session";

// Use a raw Response with a relative Location header.
// NextResponse.redirect() requires an absolute URL and builds it from req.url,
// which inside Docker is http://0.0.0.0:3000 — not the client-visible address.
// A relative Location: /login is resolved by the browser against the URL it
// actually used, so it works correctly regardless of the proxy setup.
function logoutResponse() {
  const isProduction = process.env.NODE_ENV === "production";
  const cookie = [
    `${SESSION_COOKIE}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(isProduction ? ["Secure"] : []),
  ].join("; ");

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Set-Cookie": cookie,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(_req: NextRequest) {
  return logoutResponse();
}

export async function GET(_req: NextRequest) {
  return logoutResponse();
}
