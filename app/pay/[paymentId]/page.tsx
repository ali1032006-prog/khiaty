import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { simulateGatewayCharge } from "@/lib/actions/payments";

/** The "hosted checkout page" of our pretend payment provider. */
export default async function PayPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const user = await requireRole("CUSTOMER");
  const { paymentId } = await params;
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { request: { select: { title: true } }, provider: { select: { name: true } } } } },
  });
  if (!payment || payment.order.customerId !== user.id) notFound();
  if (payment.status !== "PENDING") redirect(`/orders/${payment.orderId}`);

  return (
    <div className="mx-auto max-w-md rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 p-6">
      <div className="text-xs uppercase tracking-wide text-indigo-700">MockPay · secure checkout (simulated)</div>
      <h1 className="mt-2 text-xl font-semibold">Pay {money(payment.amountCents)}</h1>
      <p className="mt-1 text-sm text-stone-700">
        {payment.order.request.title} · to {payment.order.provider.name}
      </p>
      <div className="mt-6 space-y-3 rounded bg-white p-4 text-sm text-stone-500">
        <div className="rounded border border-stone-200 px-3 py-2">4242 4242 4242 4242 (fake card, nothing is stored)</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-stone-200 px-3 py-2">12 / 34</div>
          <div className="rounded border border-stone-200 px-3 py-2">123</div>
        </div>
      </div>
      <form action={simulateGatewayCharge} className="mt-6 flex gap-3">
        <input type="hidden" name="paymentId" value={payment.id} />
        <button name="outcome" value="succeed" className="flex-1 rounded bg-indigo-700 px-4 py-2 text-white">
          Pay {money(payment.amountCents)}
        </button>
        <button name="outcome" value="fail" className="rounded border border-stone-300 bg-white px-4 py-2">
          Simulate failure
        </button>
      </form>
      <p className="mt-4 text-xs text-stone-500">
        After you click, the gateway confirms the payment to Khiaty through a server callback. The order
        only becomes &ldquo;paid&rdquo; when that callback is verified.
      </p>
    </div>
  );
}
