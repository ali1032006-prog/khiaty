"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-sm">
        Email
        <input name="email" type="email" required className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        Password
        <input name="password" type="password" required className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-stone-600">
        No account? <Link href="/register" className="underline">Register</Link>
      </p>
    </form>
  );
}
