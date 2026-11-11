"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { confirmPayment } from "@/lib/payments/confirm";

/**
 * Simulates the payment provider. In production this code would live on Stripe's servers:
 * the customer pays there, and Stripe calls our callback with the secret we gave it.
 * Here the action plays the gateway: it reads "the gateway's copy" of the secret (GatewaySession)
 * and hands the confirmation to confirmPayment directly. No HTTP request to ourselves, and no
 * request header is ever used to decide where the secret goes.
 */
export async function simulateGatewayCharge(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const paymentId = String(formData.get("paymentId") ?? "");
  const outcome = formData.get("outcome") === "fail" ? "fail" : "succeed";

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { order: true, gatewaySession: true },
  });
  if (!payment || payment.order.customerId !== user.id) redirect("/customer");
  if (payment.status === "SUCCEEDED" || !payment.gatewaySession) redirect(`/orders/${payment.orderId}`);

  // --- everything below is "the gateway" ---
  const result = await confirmPayment({
    paymentId: payment.id,
    secret: payment.gatewaySession.secret,
    amountCents: payment.amountCents,
    providerRef: `mock_${randomBytes(8).toString("hex")}`,
    status: outcome === "fail" ? "FAILED" : "SUCCEEDED",
  });
  if (!result.ok) console.error("gateway confirmation rejected", result.status, result.error);
  redirect(`/orders/${payment.orderId}`);
}
