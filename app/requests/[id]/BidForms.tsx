"use client";

import { useActionState } from "react";
import { placeBid, reviseBid } from "@/lib/actions/bids";

function OfferFields() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Price (USD)
          <input name="price" type="number" min="1" step="0.01" required className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          Timeline (days)
          <input name="timelineDays" type="number" min="1" max="365" required className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm">
        Note to customer
        <textarea name="note" required rows={3} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
    </>
  );
}

export function PlaceBidForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(placeBid, undefined);
  return (
    <form action={action} className="space-y-3 rounded border border-stone-200 bg-white p-4">
      <h3 className="font-medium">Place your bid</h3>
      <input type="hidden" name="requestId" value={requestId} />
      <OfferFields />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50">
        {pending ? "Submitting…" : "Submit bid"}
      </button>
    </form>
  );
}

export function ReviseBidForm({ bidId }: { bidId: string }) {
  const [state, action, pending] = useActionState(reviseBid, undefined);
  return (
    <form action={action} className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-medium">Your bid was declined. Revise it</h3>
      <input type="hidden" name="bidId" value={bidId} />
      <OfferFields />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50">
        {pending ? "Submitting…" : "Submit revision"}
      </button>
    </form>
  );
}
