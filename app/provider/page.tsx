import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, STATUS_LABEL, when } from "@/lib/format";

export default async function ProviderHome() {
  const user = await requireRole("PROVIDER");

  const [openRequests, myBids, orders, reviews] = await Promise.all([
    // Open requests: only a bid COUNT is exposed, never other providers' offers.
    db.request.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true } }, _count: { select: { bids: true } } },
    }),
    db.bid.findMany({
      where: { providerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { request: { select: { title: true, status: true } }, revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
    }),
    db.order.findMany({
      where: { providerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { request: { select: { title: true } }, customer: { select: { name: true } } },
    }),
    db.review.findMany({ where: { providerId: user.id }, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true } } } }),
  ]);

  const myBidRequestIds = new Set(myBids.map((b) => b.requestId));

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold">Open requests</h1>
        {openRequests.length === 0 ? (
          <p className="mt-4 text-stone-600">Nothing open right now.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 rounded border border-stone-200 bg-white">
            {openRequests.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-stone-500">
                      {r.customer.name} · budget {money(r.budgetCents)} · {when(r.createdAt)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-stone-500">
                    <div>{r._count.bids} bid(s)</div>
                    {myBidRequestIds.has(r.id) && <div className="text-emerald-700">you bid</div>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">My bids</h2>
        {myBids.length === 0 ? (
          <p className="mt-4 text-stone-600">You have not bid yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 rounded border border-stone-200 bg-white">
            {myBids.map((b) => (
              <li key={b.id}>
                <Link href={`/requests/${b.requestId}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                  <div>
                    <div className="font-medium">{b.request.title}</div>
                    <div className="text-xs text-stone-500">{money(b.revisions[0].priceCents)} · rev {b.revisions[0].revisionNumber}</div>
                  </div>
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">{STATUS_LABEL[b.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">My orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-stone-600">No orders yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 rounded border border-stone-200 bg-white">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                  <div>
                    <div className="font-medium">{o.request.title}</div>
                    <div className="text-xs text-stone-500">for {o.customer.name} · {money(o.amountCents)}</div>
                  </div>
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">{STATUS_LABEL[o.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {reviews.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Reviews</h2>
          <ul className="mt-4 space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="rounded border border-stone-200 bg-white p-3 text-sm">
                <span className="text-amber-600">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> by {r.customer.name}
                <p className="mt-1 text-stone-700">{r.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
