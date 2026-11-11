import { z } from "zod";
import { db } from "@/lib/db";
import { transition, TransitionError } from "@/lib/orders/stateMachine";
import { secretMatches } from "./secret";
import { securityEvent } from "@/lib/log";

export const callbackSchema = z.object({
  paymentId: z.string().uuid(),
  secret: z.string().min(20).max(200),
  amountCents: z.number().int().positive(),
  providerRef: z.string().min(1).max(100),
  status: z.enum(["SUCCEEDED", "FAILED"]),
});
export type CallbackPayload = z.infer<typeof callbackSchema>;

export type ConfirmResult = { ok: true } | { ok: false; status: 400 | 401 | 403 | 409; error: string };

/**
 * The single place that decides whether a payment confirmation is genuine and applies it.
 * Used by the HTTP callback route (real gateways) and called directly by the simulated gateway,
 * so the app never has to make an HTTP request to itself.
 */
export async function confirmPayment(input: unknown): Promise<ConfirmResult> {
  const parsed = callbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: "Bad payload" };
  const body = parsed.data;

  const payment = await db.payment.findUnique({ where: { id: body.paymentId } });
  // Same response for "unknown id" and "wrong secret" so an attacker learns nothing.
  if (!payment || !secretMatches(body.secret, payment.callbackSecretHash)) {
    securityEvent("payment.callback.rejected", { paymentId: body.paymentId, reason: "bad secret or id" });
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  // A FAILED attempt may be retried; a SUCCEEDED one is final.
  if (payment.status === "SUCCEEDED") {
    securityEvent("payment.callback.rejected", { paymentId: payment.id, reason: "already succeeded" });
    return { ok: false, status: 409, error: "Already processed" };
  }
  if (payment.amountCents !== body.amountCents) {
    securityEvent("payment.callback.rejected", { paymentId: payment.id, reason: "amount mismatch" });
    return { ok: false, status: 409, error: "Amount mismatch" };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: body.status, providerRef: body.providerRef },
      });
      if (body.status === "SUCCEEDED") {
        await transition(tx, payment.orderId, "PAID", "SYSTEM");
      }
    });
  } catch (e) {
    if (e instanceof TransitionError) return { ok: false, status: e.status, error: e.message };
    throw e;
  }
  return { ok: true };
}
