import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, STATUS_LABEL, when } from "@/lib/format";
import { ACTION_LABEL, TRANSITIONS, chatUnlocked } from "@/lib/orders/stateMachine";
import { advanceOrder } from "@/lib/actions/orders";
import { Chat } from "./Chat";
import { ReviewForm } from "./ReviewForm";

const STAGES = ["ACCEPTED", "PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      request: { select: { id: true, title: true } },
      customer: { select: { id: true, name: true } },
      provider: { select: { id: true, name: true } },
      payment: true,
      review: true,
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  // Only the two parties may see an order. Everyone else gets a 404, not a 403, to avoid confirming it exists.
  if (!order || (order.customerId !== user.id && order.providerId !== user.id)) notFound();

  const next = TRANSITIONS[order.status];
  const canAdvance = next && next.by === user.role;
  const stageIdx = STAGES.indexOf(order.status);

  return (
    <div className="space-y-8">
      <section className="rounded border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              <Link href={`/requests/${order.request.id}`} className="hover:underline">{order.request.title}</Link>
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {order.customer.name} ↔ {order.provider.name} · {money(order.amountCents)}
            </p>
          </div>
          <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">{STATUS_LABEL[order.status]}</span>
        </div>

        <ol className="mt-5 flex gap-2 text-xs">
          {STAGES.map((s, i) => (
            <li key={s} className={`flex-1 rounded px-2 py-1 text-center ${i <= stageIdx ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"}`}>
              {STATUS_LABEL[s]}
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {order.status === "ACCEPTED" && user.role === "CUSTOMER" && order.payment && (
            <Link href={`/pay/${order.payment.id}`} className="rounded bg-indigo-700 px-4 py-2 text-sm text-white">
              Pay {money(order.amountCents)}
            </Link>
          )}
          {order.status === "ACCEPTED" && user.role === "PROVIDER" && (
            <p className="text-sm text-stone-600">Waiting for the customer to pay.</p>
          )}
          {order.payment?.status === "FAILED" && order.status === "ACCEPTED" && (
            <p className="text-sm text-red-600">Last payment attempt failed.</p>
          )}
          {canAdvance && (
            <form action={advanceOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="to" value={next.to} />
              <button className="rounded bg-emerald-700 px-4 py-2 text-sm text-white">{ACTION_LABEL[next.to]}</button>
            </form>
          )}
          {next && !canAdvance && order.status !== "ACCEPTED" && (
            <p className="text-sm text-stone-600">
              Waiting for the {next.by === "CUSTOMER" ? "customer" : "tailor"} to {ACTION_LABEL[next.to]?.toLowerCase()}.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Chat</h2>
        {chatUnlocked(order.status) ? (
          <div className="mt-3">
            <Chat
              orderId={order.id}
              meId={user.id}
              initial={order.messages.map((m) => ({ id: m.id, body: m.body, senderId: m.senderId, createdAt: m.createdAt.toISOString() }))}
              names={{ [order.customer.id]: order.customer.name, [order.provider.id]: order.provider.name }}
            />
          </div>
        ) : (
          <p className="mt-3 rounded border border-dashed border-stone-300 p-4 text-sm text-stone-600">
            Chat unlocks after the order is paid.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Review</h2>
        <div className="mt-3">
          {order.review ? (
            <div className="rounded border border-stone-200 bg-white p-4 text-sm">
              <span className="text-amber-600">{"★".repeat(order.review.rating)}{"☆".repeat(5 - order.review.rating)}</span>
              <p className="mt-1">{order.review.comment}</p>
              <p className="mt-1 text-xs text-stone-500">{when(order.review.createdAt)}</p>
            </div>
          ) : order.status === "COMPLETED" && user.role === "CUSTOMER" ? (
            <ReviewForm orderId={order.id} />
          ) : (
            <p className="text-sm text-stone-600">The customer can review once the order is completed.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">History</h2>
        <ul className="mt-3 space-y-1 text-sm text-stone-600">
          {order.events.map((e) => (
            <li key={e.id}>
              {when(e.createdAt)} · {e.fromStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : ""}{STATUS_LABEL[e.toStatus]}
              {" "}by {e.actor?.name ?? "payment gateway"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
