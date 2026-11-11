"use client";

import { useActionState } from "react";
import { register } from "@/lib/actions/auth";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-sm">
        Name
        <input name="name" required className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        Email
        <input name="email" type="email" required className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        Password (8+ characters)
        <input name="password" type="password" minLength={8} required className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <fieldset className="text-sm">
        <legend className="mb-1">I am a</legend>
        <label className="mr-4"><input type="radio" name="role" value="CUSTOMER" defaultChecked /> Customer</label>
        <label><input type="radio" name="role" value="PROVIDER" /> Tailor (provider)</label>
      </fieldset>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.info && <p className="text-sm text-emerald-700">{state.info}</p>}
      <button disabled={pending} className="w-full rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
