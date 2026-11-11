import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { transition, TransitionError } from "@/lib/orders/stateMachine";

const schema = z.object({
  paymentId: z.string().uuid(),
  secret: z.string().min(20),
  amountCents: z.number().int().positive(),
  providerRef: z.string().min(1).max(100),
  status: z.enum(["SUCCEEDED", "FAILED"]),
});

/**
 * Payment confirmation callback ("webhook"). No user session is involved: this is a
 * machine-to-machine call. Trust comes from the per-payment secret, which only the gateway has.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  const body = parsed.data;

  const payment = await db.payment.findUnique({ where: { id: body.paymentId } });
  // Same response for "unknown id" and "wrong secret" so an attacker learns nothing.
  if (!payment || payment.callbackSecret !== body.secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (payment.status !== "PENDING") {
    return NextResponse.json({ error: "Already processed" }, { status: 409 });
  }
  if (payment.amountCents !== body.amountCents) {
    return NextResponse.json({ error: "Amount mismatch" }, { status: 409 });
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
    if (e instanceof TransitionError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
