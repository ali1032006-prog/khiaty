import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, STATUS_LABEL, when } from "@/lib/format";
import { acceptBid, declineBid } from "@/lib/actions/bids";
import { PlaceBidForm, ReviseBidForm } from "./BidForms";
import { signedPhotoUrl } from "@/lib/storage";

type Props = { params: Promise<{ id: string }> };

export default async function RequestPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const request = await db.request.findUnique({
    where: { id },
    include: { customer: { select: { name: true } }, order: { select: { id: true } } },
  });
  if (!request) notFound();
  // A customer may only open their own requests. Providers may open any (they need to browse to bid).
  if (user.role === "CUSTOMER" && request.customerId !== user.id) notFound();

  // Access was checked above; only now do we mint a short-lived link to the private photo.
  const photoUrl = request.photoPath ? await signedPhotoUrl(request.photoPath) : null;

  return (
    <div className="space-y-8">
      <section className="rounded border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{request.title}</h1>
            <p className="mt-1 text-sm text-stone-500">
              by {request.customer.name} · budget {money(request.budgetCents)} · {when(request.createdAt)}
            </p>
          </div>
          <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">{STATUS_LABEL[request.status]}</span>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-stone-800">{request.description}</p>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Reference" className="mt-4 max-h-80 rounded border border-stone-200" />
        )}
        {request.order && (
          <p className="mt-4 text-sm">
            This request has an order. <Link href={`/orders/${request.order.id}`} className="underline">Open order</Link>
          </p>
        )}
      </section>

      {user.role === "CUSTOMER" ? <CustomerBids requestId={id} open={request.status === "OPEN"} /> : <ProviderBids requestId={id} providerId={user.id} open={request.status === "OPEN"} />}
    </div>
  );
}

/** Customer sees every bid with full revision history and can accept/decline pending ones. */
async function CustomerBids({ requestId, open }: { requestId: string; open: boolean }) {
  const bids = await db.bid.findMany({
    where: { requestId },
    include: { provider: { select: { name: true } }, revisions: { orderBy: { revisionNumber: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <section>
      <h2 className="text-xl font-semibold">Bids ({bids.length})</h2>
      {bids.length === 0 && <p className="mt-3 text-stone-600">No bids yet.</p>}
      <ul className="mt-4 space-y-4">
        {bids.map((bid) => {
          const [latest, ...older] = bid.revisions;
          return (
            <li key={bid.id} className="rounded border border-stone-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{bid.provider.name}</div>
                  <div className="mt-1 text-lg">{money(latest.priceCents)} <span className="text-sm text-stone-500">· {latest.timelineDays} day(s)</span></div>
                  <p className="mt-1 text-sm text-stone-700">{latest.note}</p>
                  <div className="mt-1 text-xs text-stone-500">Revision {latest.revisionNumber} · {when(latest.createdAt)}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">{STATUS_LABEL[bid.status]}</span>
                  {open && bid.status === "PENDING" && (
                    <div className="flex gap-2">
                      <form action={acceptBid}>
                        <input type="hidden" name="bidId" value={bid.id} />
                        <button className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white">Accept</button>
                      </form>
                      <form action={declineBid}>
                        <input type="hidden" name="bidId" value={bid.id} />
                        <button className="rounded border border-stone-300 px-3 py-1.5 text-sm">Decline</button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
              {older.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-stone-600">Earlier revisions ({older.length})</summary>
                  <ul className="mt-2 space-y-2 border-l-2 border-stone-200 pl-3">
                    {older.map((r) => (
                      <li key={r.id} className="text-stone-600">
                        <span className="font-medium text-stone-800">{money(r.priceCents)}</span> · {r.timelineDays} day(s) · rev {r.revisionNumber} · {when(r.createdAt)}
                        <div>{r.note}</div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Blind bidding: the provider's query fetches only a COUNT of other bids plus their own bid.
 * Other providers' amounts never leave the server.
 */
async function ProviderBids({ requestId, providerId, open }: { requestId: string; providerId: string; open: boolean }) {
  const [count, mine] = await Promise.all([
    db.bid.count({ where: { requestId } }),
    db.bid.findUnique({
      where: { requestId_providerId: { requestId, providerId } },
      include: { revisions: { orderBy: { revisionNumber: "desc" } } },
    }),
  ]);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">
        {count} bid{count === 1 ? "" : "s"} submitted
        <span className="ml-2 text-sm font-normal text-stone-500">(amounts are hidden from other tailors)</span>
      </h2>
      {mine ? (
        <div className="rounded border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Your bid</h3>
            <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">{STATUS_LABEL[mine.status]}</span>
          </div>
          <ul className="mt-2 space-y-2 text-sm">
            {mine.revisions.map((r, i) => (
              <li key={r.id} className={i === 0 ? "" : "text-stone-500"}>
                <span className="font-medium">{money(r.priceCents)}</span> · {r.timelineDays} day(s) · rev {r.revisionNumber} · {when(r.createdAt)}
                <div>{r.note}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        open && <PlaceBidForm requestId={requestId} />
      )}
      {mine && mine.status === "DECLINED" && open && <ReviseBidForm bidId={mine.id} />}
    </section>
  );
}
