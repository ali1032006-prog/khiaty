"use client";

import { useActionState } from "react";
import { createRequest } from "@/lib/actions/requests";

export function NewRequestForm() {
  const [state, action, pending] = useActionState(createRequest, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-sm">
        Title
        <input name="title" required minLength={3} maxLength={120} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" placeholder="Hem and taper two pairs of trousers" />
      </label>
      <label className="block text-sm">
        Description
        <textarea name="description" required minLength={10} rows={5} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        Budget (USD)
        <input name="budget" type="number" min="1" step="0.01" required className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        Reference photo (optional, JPEG/PNG/WebP, under 3 MB)
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Posting…" : "Post request"}
      </button>
    </form>
  );
}
