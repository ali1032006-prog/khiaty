// Local stand-in for the Supabase Auth endpoints Khiaty calls, for verification runs only.
// It answers on /auth/v1/* so @supabase/supabase-js talks to it unchanged. It also writes the
// public."User" profile row on sign-up, which the on_auth_user_created trigger does in Supabase.
// Not covered: Storage (photo upload), Realtime (live chat), email confirmation, MFA.
import http from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import prismaPkg from "@prisma/client";

const PORT = Number(process.env.FAKE_AUTH_PORT ?? 54399);
const STATE = process.env.FAKE_AUTH_STATE; // JSON file in the run dir, so a restart keeps users
const SECRET = process.env.FAKE_AUTH_SECRET;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!STATE || !SECRET || !SERVICE_KEY) throw new Error("FAKE_AUTH_STATE, FAKE_AUTH_SECRET and SUPABASE_SERVICE_ROLE_KEY are required");

const db = new prismaPkg.PrismaClient();
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { users: {}, refresh: {} };
const save = () => writeFileSync(STATE, JSON.stringify(state));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (data) => createHmac("sha256", SECRET).update(data).digest("base64url");

function jwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 })}`;
  return `${body}.${sign(body)}`;
}

function verify(token) {
  const [h, p, s] = String(token).split(".");
  if (!h || !p || !s) return null;
  const want = Buffer.from(sign(`${h}.${p}`));
  const got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (payload.exp < Date.now() / 1000) return null;
  return state.users[payload.sub] ?? null;
}

const publicUser = (u) => Object.fromEntries(Object.entries(u).filter(([k]) => k !== "password"));

function session(user) {
  const refresh_token = randomUUID();
  state.refresh[refresh_token] = user.id;
  save();
  return { access_token: jwt(user), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token, user: publicUser(user) };
}

async function createUser(email, password, metadata) {
  email = String(email ?? "").toLowerCase();
  if (!email || !password) return [422, { code: 422, error_code: "validation_failed", msg: "Email and password are required" }];
  if (Object.values(state.users).some((u) => u.email === email)) return [422, { code: 422, error_code: "user_already_exists", msg: "User already registered" }];
  const now = new Date().toISOString();
  const user = { id: randomUUID(), aud: "authenticated", role: "authenticated", email, password, email_confirmed_at: now, user_metadata: metadata ?? {}, app_metadata: { provider: "email", providers: ["email"] }, identities: [], created_at: now, updated_at: now };
  state.users[user.id] = user;
  save();
  // Same mapping as public.handle_new_auth_user() in supabase/migrations/0002_auth_rls_realtime.sql.
  const role = metadata?.role === "PROVIDER" ? "PROVIDER" : "CUSTOMER";
  await db.user.upsert({ where: { id: user.id }, update: {}, create: { id: user.id, email, name: metadata?.name || email, role } });
  return [200, user];
}

const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer /i, "");
const isAdmin = (req) => bearer(req) === SERVICE_KEY;

async function handle(req, url, body) {
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  const grant = url.searchParams.get("grant_type");

  if (req.method === "GET" && path === "/health") return [200, { name: "fake-auth", users: Object.keys(state.users).length }];

  if (req.method === "POST" && path === "/token" && grant === "password") {
    const user = Object.values(state.users).find((u) => u.email === String(body.email ?? "").toLowerCase());
    if (!user || user.password !== body.password) return [400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }];
    return [200, session(user)];
  }
  if (req.method === "POST" && path === "/token" && grant === "refresh_token") {
    const id = state.refresh[body.refresh_token];
    if (!id || !state.users[id]) return [400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }];
    delete state.refresh[body.refresh_token];
    return [200, session(state.users[id])];
  }
  if (req.method === "POST" && path === "/signup") {
    const [status, user] = await createUser(body.email, body.password, body.data);
    return status === 200 ? [200, session(user)] : [status, user];
  }
  if (req.method === "GET" && path === "/user") {
    const user = verify(bearer(req));
    return user ? [200, publicUser(user)] : [403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT" }];
  }
  if (req.method === "POST" && path === "/logout") return [204, null];

  if (path.startsWith("/admin/")) {
    if (!isAdmin(req)) return [401, { code: 401, msg: "service role key required" }];
    if (req.method === "GET" && path === "/admin/users") return [200, { users: Object.values(state.users).map(publicUser), aud: "authenticated" }];
    if (req.method === "POST" && path === "/admin/users") {
      const [status, user] = await createUser(body.email, body.password, body.user_metadata);
      return status === 200 ? [200, publicUser(user)] : [status, user];
    }
    const del = path.match(/^\/admin\/users\/([^/]+)$/);
    if (req.method === "DELETE" && del) {
      const user = state.users[del[1]];
      if (!user) return [404, { code: 404, error_code: "user_not_found", msg: "User not found" }];
      delete state.users[del[1]];
      save();
      return [200, publicUser(user)];
    }
  }
  return [404, { code: 404, msg: `fake-auth does not implement ${req.method} ${path}` }];
}

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    let status, payload;
    try {
      [status, payload] = await handle(req, new URL(req.url, `http://${req.headers.host}`), raw ? JSON.parse(raw) : {});
    } catch (e) {
      [status, payload] = [500, { code: 500, msg: String(e?.message ?? e) }];
    }
    if (status >= 400) console.error(`fake-auth ${req.method} ${req.url} -> ${status}`);
    res.writeHead(status, { "content-type": "application/json", "x-total-count": String(Object.keys(state.users).length) });
    res.end(payload === null ? "" : JSON.stringify(payload));
  })
  .listen(PORT, "127.0.0.1", () => console.log(`fake-auth ready on http://127.0.0.1:${PORT}`));
