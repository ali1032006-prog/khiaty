"use server";

import { z } from "zod";
import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { securityEvent } from "@/lib/log";

export type ActionState = { error?: string; info?: string } | undefined;

const MIN = 60_000;
/** Logs never contain the raw email; a short hash is enough to correlate attempts. */
const emailTag = (email: string) => createHash("sha256").update(email).digest("hex").slice(0, 12);

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const email = parsed.data.email.toLowerCase();
  const ip = await clientIp();

  // Throttle per account AND per client, so neither a single target nor a single attacker
  // can burn through guesses. Same generic message either way.
  const perAccount = checkRateLimit(`login:acct:${email}`, 5, 15 * MIN);
  const perClient = checkRateLimit(`login:ip:${ip}`, 30, 15 * MIN);
  if (!perAccount.ok || !perClient.ok) {
    securityEvent("auth.login.throttled", { emailTag: emailTag(email), ip });
    const wait = Math.ceil(Math.max(perAccount.retryAfterSec, perClient.retryAfterSec) / 60);
    return { error: `Too many attempts. Try again in about ${wait} minute(s).` };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  // One generic error for unknown email and wrong password.
  if (error || !data.user) {
    securityEvent("auth.login.failed", { emailTag: emailTag(email), ip });
    return { error: "Incorrect email or password." };
  }

  const profile = await db.user.findUnique({ where: { id: data.user.id } });
  if (!profile) {
    await supabase.auth.signOut();
    securityEvent("auth.login.noprofile", { userId: data.user.id });
    return { error: "Account has no profile. Contact support." };
  }
  redirect(homeFor(profile.role));
}

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum(["CUSTOMER", "PROVIDER"]),
});

const REGISTER_NEUTRAL = "Thanks. If this email was not already registered, your account is ready: log in to continue.";

export async function register(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the form: password needs 8+ characters." };
  const email = parsed.data.email.toLowerCase();
  const ip = await clientIp();

  const limit = checkRateLimit(`register:ip:${ip}`, 10, 60 * MIN);
  if (!limit.ok) {
    securityEvent("auth.register.throttled", { ip });
    return { error: "Too many sign-ups from this connection. Try again later." };
  }

  const supabase = await createSupabaseServer();
  // name and role travel as user metadata; the `on_auth_user_created` trigger turns them into a User row.
  const { data, error } = await supabase.auth.signUp({
    email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name, role: parsed.data.role } },
  });
  if (error) {
    // The real reason (e.g. "User already registered") stays in the server log.
    securityEvent("auth.register.failed", { emailTag: emailTag(email), ip, provider: error.message });
    return { info: REGISTER_NEUTRAL };
  }
  if (!data.session) return { info: REGISTER_NEUTRAL + " (Check your inbox if email confirmation is on.)" };
  redirect(homeFor(parsed.data.role));
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
