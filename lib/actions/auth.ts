"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export type ActionState = { error?: string; info?: string } | undefined;

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });
  // Supabase returns one generic error for unknown email and wrong password.
  if (error || !data.user) return { error: "Incorrect email or password." };

  const profile = await db.user.findUnique({ where: { id: data.user.id } });
  if (!profile) {
    await supabase.auth.signOut();
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

export async function register(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the form: password needs 8+ characters." };

  const supabase = await createSupabaseServer();
  // name and role travel as user metadata; the `on_auth_user_created` trigger turns them into a User row.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
    options: { data: { name: parsed.data.name, role: parsed.data.role } },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    // Email confirmation is switched on in the Supabase dashboard.
    return { info: "Check your email to confirm your account, then log in." };
  }
  redirect(homeFor(parsed.data.role));
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
