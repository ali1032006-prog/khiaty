/**
 * Auth cookie flags. @supabase/ssr defaults to httpOnly: false so a browser client can read the
 * session; we do not need that (the chat gets a short-lived token from the server), so the
 * refresh and access tokens stay out of reach of page JavaScript.
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
