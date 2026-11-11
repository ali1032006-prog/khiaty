import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookieOptions";

const SUPABASE_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
const isDev = process.env.NODE_ENV !== "production";

/**
 * Per-request Content-Security-Policy with a nonce. Next.js reads the policy from the request
 * headers and stamps the nonce onto its own inline scripts, so no 'unsafe-inline' for scripts.
 * Dev needs 'unsafe-eval' for React Fast Refresh.
 */
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind/Next inject style tags
    `img-src 'self' blob: data: https://${SUPABASE_HOST}`, // signed photo URLs
    `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`, // Auth + Realtime
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Runs on every request: refreshes the Supabase session cookies (Server Components cannot set
 * cookies) and attaches the CSP.
 */
export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the token with Supabase Auth and triggers a refresh when needed.
  await supabase.auth.getUser();

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
