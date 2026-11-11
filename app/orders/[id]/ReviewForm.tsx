"use client";

import { useActionState } from "react";
import { createReview } from "@/lib/actions/reviews";

export function ReviewForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(createReview, undefined);
  return (
    <form action={action} className="space-y-3 rounded border border-stone-200 bg-white p-4">
      <h3 className="font-medium">Leave a review</h3>
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block text-sm">
        Rating
        <select name="rating" defaultValue="5" className="mt-1 rounded border border-stone-300 px-3 py-2">
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        Comment
        <textarea name="comment" required rows={3} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50">Submit review</button>
    </form>
  );
}
