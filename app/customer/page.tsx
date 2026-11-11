import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, STATUS_LABEL, when } from "@/lib/format";

export default async function CustomerHome() {
  const user = await requireRole("CUSTOMER");

  const [requests, orders] = await Promise.all([
    db.request.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { bids: { where: { status: "PENDING" } } } } },
    }),
    db.order.findMany({
      where: { customerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { request: { select: { title: true } }, provider: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">My requests</h1>
          <Link href="/customer/requests/new" className="rounded bg-stone-900 px-4 py-2 text-sm text-white">
            New request
          </Link>
        </div>
        {requests.length === 0 ? (
          <p className="mt-4 text-stone-600">No requests yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 rounded border border-stone-200 bg-white">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-stone-500">
                      Budget {money(r.budgetCents)} · posted {when(r.createdAt)}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{STATUS_LABEL[r.status]}</div>
                    {r.status === "OPEN" && <div className="text-xs text-stone-500">{r._count.bids} pending bid(s)</div>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">My orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-stone-600">No orders yet. Accept a bid to start one.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 rounded border border-stone-200 bg-white">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                  <div>
                    <div className="font-medium">{o.request.title}</div>
                    <div className="text-xs text-stone-500">with {o.provider.name} · {money(o.amountCents)}</div>
                  </div>
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">{STATUS_LABEL[o.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
