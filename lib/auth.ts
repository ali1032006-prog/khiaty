import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { createSupabaseServer } from "./supabase/server";

/**
 * Who is signed in? Supabase Auth answers "which auth user" (verified against the Auth server,
 * not just decoded from the cookie); our User table answers "what role, what name".
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return db.user.findUnique({ where: { id: data.user.id } });
}

/** Hard gate: throws a redirect to /login if nobody is signed in. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Hard gate: the caller must be signed in AND have the given role. */
export async function requireRole(role: Role): Promise<User> {
  const user = await requireUser();
  if (user.role !== role) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role) {
  return role === "CUSTOMER" ? "/customer" : "/provider";
}
