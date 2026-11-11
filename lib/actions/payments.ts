"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

/**
 * Simulates the payment provider. In production this code would live on Stripe's servers:
 * the customer pays there, and Stripe calls our callback with a signed payload.
 * Here, the server action plays the gateway and calls our callback over HTTP with the
 * payment's secret. The browser only ever asks "charge me"; it never gets to confirm.
 */
export async function simulateGatewayCharge(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const paymentId = String(formData.get("paymentId") ?? "");
  const outcome = formData.get("outcome") === "fail" ? "fail" : "succeed";

  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment || payment.order.customerId !== user.id) redirect("/customer");
  if (payment.status !== "PENDING") redirect(`/orders/${payment.orderId}`);

  // --- everything below is "the gateway" ---
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const res = await fetch(`${origin}/api/payments/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: payment.id,
      secret: payment.callbackSecret,
      amountCents: payment.amountCents,
      providerRef: `mock_${randomBytes(8).toString("hex")}`,
      status: outcome === "fail" ? "FAILED" : "SUCCEEDED",
    }),
  });
  // Whatever the callback decided is now in the DB; just show the order.
  if (!res.ok) console.error("gateway callback rejected", res.status, await res.text());
  redirect(`/orders/${payment.orderId}`);
}
